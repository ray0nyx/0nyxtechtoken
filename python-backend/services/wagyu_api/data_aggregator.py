"""
Multi-source data aggregator for WagyuTech API
Aggregates data from DexScreener, Jupiter, Birdeye, QuickNode, Moralis, Raydium
"""

import asyncio
import aiohttp
import os
import ssl
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    import certifi
    CERTIFI_AVAILABLE = True
except ImportError:
    CERTIFI_AVAILABLE = False
    logger.warning("certifi not available. SSL certificate verification may fail in production.")

# API Keys from environment
DEXSCREENER_API_URL = "https://api.dexscreener.com/latest"
JUPITER_API_URL = "https://quote-api.jup.ag/v6"
JUPITER_PRICE_API_URL = "https://price.jup.ag/v4"
BIRDEYE_API_URL = "https://public-api.birdeye.so/v1"
BIRDEYE_API_KEY = os.getenv("BIRDEYE_API_KEY")
# QuickNode RPC endpoint for Solana mainnet
QUICKNODE_RPC_URL = os.getenv("QUICKNODE_RPC_URL", "https://misty-alien-panorama.soneium-mainnet.quiknode.pro/31ceef5941b0811baf68fff3e4884c002c2a9b2e")
MORALIS_API_KEY = os.getenv("MORALIS_API_KEY")
MORALIS_API_URL = "https://deep-index.moralis.io/api/v2.2"
RAYDIUM_API_URL = "https://api.raydium.io/v2"

# Cache for API responses (simple in-memory cache, should use Redis in production)
_data_cache: Dict[str, tuple[Any, float]] = {}
CACHE_TTL = 5  # 5 seconds for price data


class DataAggregator:
    """Multi-source data aggregator with fallback chain"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.birdeye_key = BIRDEYE_API_KEY
        self.birdeye_key = BIRDEYE_API_KEY
    
    async def __aenter__(self):
        # Configure SSL context for production compatibility
        if CERTIFI_AVAILABLE:
            try:
                ssl_context = ssl.create_default_context(cafile=certifi.where())
                connector = aiohttp.TCPConnector(ssl=ssl_context)
                self.session = aiohttp.ClientSession(connector=connector)
            except Exception as e:
                logger.warning(f"Failed to create SSL context with certifi: {e}. Using default SSL context.")
                self.session = aiohttp.ClientSession()
        else:
            # Fallback to default SSL context if certifi not available
            self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached data if not expired"""
        if key in _data_cache:
            data, timestamp = _data_cache[key]
            if (datetime.now().timestamp() - timestamp) < CACHE_TTL:
                return data
            del _data_cache[key]
        return None
    
    def _set_cached(self, key: str, data: Any):
        """Cache data with timestamp"""
        _data_cache[key] = (data, datetime.now().timestamp())
    
    async def fetch_token_data(self, symbol: str, token_address: Optional[str] = None, is_pump_fun: bool = False) -> Optional[Dict[str, Any]]:
        """
        Fetch token data from multiple sources with priority:
        For Pump.fun tokens: Birdeye → DexScreener → Jupiter → Moralis
        For regular tokens: DexScreener → Birdeye → Jupiter → Moralis
        """
        cache_key = f"token_data_{symbol}_{token_address or ''}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        # For Pump.fun tokens, prioritize Birdeye
        if is_pump_fun and token_address:
            try:
                data = await self.fetch_pump_fun_price(token_address)
                if data:
                    self._set_cached(cache_key, data)
                    return data
            except Exception as e:
                logger.warning(f"Pump.fun price fetch failed for {symbol}: {e}")
        
        # If token address is provided, try Jupiter first (best for real-time prices)
        if token_address:
            try:
                data = await self._fetch_jupiter_price_via_rpc(token_address)
                if data:
                    self._set_cached(cache_key, data)
                    return data
            except Exception as e:
                logger.warning(f"Jupiter RPC failed for {symbol}: {e}")
        
        # Try DexScreener (best for meme coins and comprehensive data)
        try:
            data = await self._fetch_from_dexscreener(symbol)
            if data:
                self._set_cached(cache_key, data)
                # If we got token address from DexScreener, also try Jupiter for price
                if data.get('address') and not token_address:
                    try:
                        jupiter_data = await self._fetch_jupiter_price_via_rpc(
                            data['address'], 
                            data.get('symbol', '').split('/')[-1] if '/' in data.get('symbol', '') else 'SOL',
                            None
                        )
                        if jupiter_data:
                            # Merge Jupiter price data with DexScreener comprehensive data
                            data['price'] = jupiter_data.get('price', data.get('price'))
                            data['price_usd'] = jupiter_data.get('price_usd', data.get('price_usd'))
                            data['source'] = 'jupiter+dexscreener'
                    except Exception as e:
                        logger.debug(f"Jupiter price merge failed: {e}")
                return data
        except Exception as e:
            logger.warning(f"DexScreener failed for {symbol}: {e}")
        
        # Try Jupiter (without address - will try to resolve)
        try:
            data = await self._fetch_from_jupiter(symbol)
            if data:
                self._set_cached(cache_key, data)
                return data
        except Exception as e:
            logger.warning(f"Jupiter failed for {symbol}: {e}")
        
        # Try Birdeye
        try:
            data = await self._fetch_from_birdeye(symbol)
            if data:
                self._set_cached(cache_key, data)
                return data
        except Exception as e:
            logger.warning(f"Birdeye failed for {symbol}: {e}")
        
        # Try Moralis
        try:
            data = await self._fetch_from_moralis(symbol)
            if data:
                self._set_cached(cache_key, data)
                return data
        except Exception as e:
            logger.warning(f"Moralis failed for {symbol}: {e}")
        
        return None
    
    async def _fetch_from_dexscreener(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch from DexScreener API"""
        if not self.session:
            return None
        
        # Search for the token
        search_url = f"{DEXSCREENER_API_URL}/dex/search?q={symbol}"
        async with self.session.get(search_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
            if response.status == 200:
                data = await response.json()
                if data.get('pairs') and len(data['pairs']) > 0:
                    pair = data['pairs'][0]
                    return {
                        'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                        'name': pair['baseToken'].get('name'),
                        'address': pair['baseToken']['address'],
                        'price': Decimal(str(pair.get('priceUsd', pair.get('priceNative', 0)))),
                        'price_usd': Decimal(str(pair.get('priceUsd', 0))),
                        'change_24h': Decimal(str(pair.get('priceChange', {}).get('h24', 0))),
                        'volume_24h': Decimal(str(pair.get('volume', {}).get('h24', 0))),
                        'liquidity': Decimal(str(pair.get('liquidity', {}).get('usd', 0))),
                        'market_cap': Decimal(str(pair.get('marketCap', 0))) if pair.get('marketCap') else None,
                        'fdv': Decimal(str(pair.get('fdv', 0))) if pair.get('fdv') else None,
                        'pair_address': pair.get('pairAddress'),
                        'chain': pair.get('chainId', 'solana'),
                        'dex': pair.get('dexId'),
                        'source': 'dexscreener',
                    }
        return None
    
    async def _fetch_from_jupiter(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch from Jupiter API (price quotes)"""
        if not self.session:
            return None
        
        # First try to get token address from DexScreener search
        try:
            search_url = f"{DEXSCREENER_API_URL}/dex/search?q={symbol}"
            async with self.session.get(search_url, timeout=aiohttp.ClientTimeout(total=3)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('pairs') and len(data['pairs']) > 0:
                        pair = data['pairs'][0]
                        token_address = pair['baseToken']['address']
                        quote_token = pair['quoteToken']['symbol']
                        
                        # Now fetch price from Jupiter Price API
                        return await self._fetch_jupiter_price_via_rpc(token_address, quote_token, pair)
        except Exception as e:
            logger.warning(f"Jupiter token address lookup failed: {e}")
        
        return None
    
    async def _fetch_jupiter_price_via_rpc(
        self, 
        token_address: str, 
        quote_token: str = "SOL",
        pair_data: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Fetch price from Jupiter Price API v4 using token address"""
        if not self.session:
            return None
        
        try:
            # Jupiter Price API v4 endpoint
            url = f"{JUPITER_PRICE_API_URL}/price"
            params = {"ids": token_address}
            
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    price_data = data.get('data', {}).get(token_address)
                    
                    if price_data:
                        price_usd = Decimal(str(price_data.get('price', 0)))
                        
                        # If it's a SOL pair, we need to get SOL price and convert
                        if quote_token == "SOL":
                            # Get SOL price
                            sol_price_data = data.get('data', {}).get('So11111111111111111111111111111111111111112')
                            if sol_price_data:
                                sol_price = Decimal(str(sol_price_data.get('price', 0)))
                                price_native = price_usd / sol_price if sol_price > 0 else Decimal('0')
                            else:
                                # Fallback: use pair data if available
                                price_native = Decimal(str(pair_data.get('priceNative', 0))) if pair_data else price_usd
                        else:
                            price_native = price_usd
                        
                        return {
                            'symbol': f"{pair_data.get('baseToken', {}).get('symbol', 'UNKNOWN')}/{quote_token}" if pair_data else f"TOKEN/{quote_token}",
                            'name': pair_data.get('baseToken', {}).get('name') if pair_data else None,
                            'address': token_address,
                            'price': price_native if quote_token == "SOL" else price_usd,
                            'price_usd': price_usd,
                            'change_24h': Decimal(str(pair_data.get('priceChange', {}).get('h24', 0))) if pair_data else Decimal('0'),
                            'volume_24h': Decimal(str(pair_data.get('volume', {}).get('h24', 0))) if pair_data else Decimal('0'),
                            'liquidity': Decimal(str(pair_data.get('liquidity', {}).get('usd', 0))) if pair_data else Decimal('0'),
                            'market_cap': Decimal(str(pair_data.get('marketCap', 0))) if pair_data and pair_data.get('marketCap') else None,
                            'fdv': Decimal(str(pair_data.get('fdv', 0))) if pair_data and pair_data.get('fdv') else None,
                            'pair_address': pair_data.get('pairAddress') if pair_data else None,
                            'chain': 'solana',
                            'dex': pair_data.get('dexId') if pair_data else None,
                            'source': 'jupiter',
                        }
        except Exception as e:
            logger.warning(f"Jupiter Price API error: {e}")
        
        return None
    
    async def _fetch_from_birdeye(self, symbol: str, token_address: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Fetch from Birdeye API - best for Pump.fun and Solana meme coins"""
        if not BIRDEYE_API_KEY or not self.session:
            return None
        
        # If no token address provided, try to get it from DexScreener
        if not token_address:
            try:
                search_url = f"{DEXSCREENER_API_URL}/dex/search?q={symbol}"
                async with self.session.get(search_url, timeout=aiohttp.ClientTimeout(total=3)) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('pairs') and len(data['pairs']) > 0:
                            token_address = data['pairs'][0]['baseToken']['address']
            except Exception as e:
                logger.warning(f"DexScreener lookup for Birdeye failed: {e}")
                return None
        
        if not token_address:
            return None
        
        headers = {"X-API-KEY": BIRDEYE_API_KEY}
        
        try:
            # Fetch token price
            price_url = f"{BIRDEYE_API_URL}/token/price"
            params = {"address": token_address}
            
            async with self.session.get(price_url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status != 200:
                    logger.warning(f"Birdeye price API returned {response.status}")
                    return None
                    
                price_data = await response.json()
                
            # Fetch token overview for additional data
            overview_url = f"{BIRDEYE_API_URL}/token/overview"
            async with self.session.get(overview_url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                overview_data = await response.json() if response.status == 200 else {}
            
            price = Decimal(str(price_data.get('data', {}).get('value', 0)))
            overview = overview_data.get('data', {})
            
            # Get SOL price to convert USD to SOL if needed
            sol_price = Decimal('0')
            try:
                sol_params = {"address": "So11111111111111111111111111111111111111112"}
                async with self.session.get(price_url, params=sol_params, headers=headers, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status == 200:
                        sol_data = await resp.json()
                        sol_price = Decimal(str(sol_data.get('data', {}).get('value', 0)))
            except Exception:
                pass
            
            price_native = price / sol_price if sol_price > 0 else price
            
            return {
                'symbol': overview.get('symbol', symbol),
                'name': overview.get('name'),
                'address': token_address,
                'price': price_native,
                'price_usd': price,
                'change_24h': Decimal(str(overview.get('priceChange24h', 0))),
                'volume_24h': Decimal(str(overview.get('volume24h', 0))),
                'liquidity': Decimal(str(overview.get('liquidity', 0))),
                'market_cap': Decimal(str(overview.get('mc', 0))) if overview.get('mc') else None,
                'fdv': None,
                'pair_address': None,
                'chain': 'solana',
                'dex': 'birdeye',
                'source': 'birdeye',
            }
        except Exception as e:
            logger.warning(f"Birdeye API error: {e}")
        
        return None
    
    def _is_pump_fun_token(self, pair_data: Dict[str, Any]) -> bool:
        """Detect if token is from Pump.fun"""
        dex_id = pair_data.get('dex', '').lower()
        pair_address = pair_data.get('pair_address', '').lower()
        # Pump.fun program ID prefix
        pump_fun_indicators = ['pump', 'pumpfun', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P']
        return any(ind in dex_id or ind in pair_address for ind in pump_fun_indicators)
    
    async def fetch_pump_fun_price(self, token_address: str) -> Optional[Dict[str, Any]]:
        """Fetch price specifically for Pump.fun tokens - prioritizes Birdeye"""
        # Try Birdeye first (best for Pump.fun)
        try:
            data = await self._fetch_from_birdeye(None, token_address)
            if data:
                return data
        except Exception as e:
            logger.warning(f"Birdeye failed for Pump.fun token: {e}")
        
        # Fallback to DexScreener
        try:
            search_url = f"{DEXSCREENER_API_URL}/dex/tokens/{token_address}"
            if self.session:
                async with self.session.get(search_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('pairs') and len(data['pairs']) > 0:
                            pair = data['pairs'][0]
                            return {
                                'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                                'name': pair['baseToken'].get('name'),
                                'address': token_address,
                                'price': Decimal(str(pair.get('priceNative', 0))),
                                'price_usd': Decimal(str(pair.get('priceUsd', 0))),
                                'change_24h': Decimal(str(pair.get('priceChange', {}).get('h24', 0))),
                                'volume_24h': Decimal(str(pair.get('volume', {}).get('h24', 0))),
                                'liquidity': Decimal(str(pair.get('liquidity', {}).get('usd', 0))),
                                'source': 'dexscreener',
                            }
        except Exception as e:
            logger.warning(f"DexScreener fallback failed: {e}")
        
        return None
    
    async def _fetch_from_moralis(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch from Moralis API"""
        if not MORALIS_API_KEY or not self.session:
            return None
        
        try:
            # Moralis Solana token price endpoint
            url = f"{MORALIS_API_URL}/solana/token/{symbol}/price"
            headers = {"X-API-Key": MORALIS_API_KEY}
            
            async with self.session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'symbol': symbol,
                        'price': Decimal(str(data.get('usdPrice', 0))),
                        'price_usd': Decimal(str(data.get('usdPrice', 0))),
                        'change_24h': Decimal('0'),  # Moralis doesn't provide 24h change directly
                        'volume_24h': Decimal('0'),
                        'liquidity': Decimal('0'),
                        'source': 'moralis',
                    }
        except Exception as e:
            logger.warning(f"Moralis API error: {e}")
        
        return None
    
    async def fetch_price(self, symbol: str) -> Optional[Decimal]:
        """Fetch current price for a token"""
        token_data = await self.fetch_token_data(symbol)
        if token_data:
            return token_data.get('price_usd') or token_data.get('price')
        return None
    
    async def fetch_ohlcv(self, symbol: str, timeframe: str = '1h', limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch OHLCV data"""
        # Try DexScreener first
        try:
            if not self.session:
                return []
            
            # DexScreener doesn't have direct OHLCV endpoint
            # Would need to use pair address and fetch from other sources
            # For now, return empty - would need Birdeye or backend data
            return []
        except Exception as e:
            logger.error(f"Error fetching OHLCV: {e}")
            return []
    
    async def fetch_liquidity(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch liquidity data"""
        token_data = await self.fetch_token_data(symbol)
        if token_data and token_data.get('liquidity'):
            return {
                'liquidity_usd': token_data['liquidity'],
                'liquidity_ratio': None,  # Would need market cap to calculate
                'timestamp': datetime.now(),
            }
        return None
    
    async def fetch_holder_distribution(self, token_address: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch holder distribution"""
        birdeye_key = os.getenv("BIRDEYE_API_KEY")
        if not birdeye_key or not self.session:
            return []
        
        try:
            url = f"{BIRDEYE_API_URL}/token/holders"
            params = {"address": token_address, "limit": limit}
            headers = {"X-API-KEY": birdeye_key}
            
            async with self.session.get(url, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('data', {}).get('items'):
                        return [
                            {
                                'address': item['address'],
                                'balance': Decimal(str(item.get('balance', 0))),
                                'usd_value': Decimal(str(item.get('value', 0))),
                                'percentage': Decimal(str(item.get('percent', 0))),
                            }
                            for item in data['data']['items']
                        ]
        except Exception as e:
            logger.warning(f"Birdeye holder fetch failed: {e}")
        
        return []
    
    async def search_tokens(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search for tokens"""
        if not self.session:
            return []
        
        try:
            # Use DexScreener search
            url = f"{DEXSCREENER_API_URL}/dex/search?q={query}"
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('pairs'):
                        tokens = []
                        for pair in data['pairs'][:limit]:
                            tokens.append({
                                'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                                'name': pair['baseToken'].get('name'),
                                'address': pair['baseToken']['address'],
                                'price': Decimal(str(pair.get('priceUsd', pair.get('priceNative', 0)))),
                                'change_24h': Decimal(str(pair.get('priceChange', {}).get('h24', 0))),
                                'volume_24h': Decimal(str(pair.get('volume', {}).get('h24', 0))),
                                'liquidity': Decimal(str(pair.get('liquidity', {}).get('usd', 0))),
                                'pair_address': pair.get('pairAddress'),
                            })
                        return tokens
        except Exception as e:
            logger.error(f"Error searching tokens: {e}")
        
        return []
    
    async def fetch_trending_tokens(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Fetch trending tokens"""
        # Use DexScreener - they have trending endpoint or we can sort by volume
        # For now, search for common tokens and sort by volume
        common_tokens = ['BONK', 'WIF', 'POPCAT', 'MYRO', 'SAMO']
        all_tokens = []
        
        for token in common_tokens:
            tokens = await self.search_tokens(token, 5)
            all_tokens.extend(tokens)
        
        # Remove duplicates and sort by volume
        unique_tokens = {}
        for token in all_tokens:
            symbol = token['symbol']
            if symbol not in unique_tokens or token['volume_24h'] > unique_tokens[symbol]['volume_24h']:
                unique_tokens[symbol] = token
        
        # Sort by volume descending
        sorted_tokens = sorted(unique_tokens.values(), key=lambda x: x['volume_24h'], reverse=True)
        return sorted_tokens[:limit]
    
    async def fetch_new_tokens(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch newest tokens from DexScreener - sorted by creation time"""
        if not self.session:
            return []
        
        try:
            # DexScreener latest pairs endpoint for Solana
            url = f"{DEXSCREENER_API_URL}/dex/tokens/solana"
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    pairs = data.get('pairs', [])
                    
                    # Sort by pair creation time (newest first)
                    pairs_with_time = [p for p in pairs if p.get('pairCreatedAt')]
                    pairs_with_time.sort(key=lambda x: x.get('pairCreatedAt', 0), reverse=True)
                    
                    tokens = []
                    seen_addresses = set()
                    
                    for pair in pairs_with_time[:limit * 2]:  # Get more to filter duplicates
                        base_address = pair.get('baseToken', {}).get('address', '')
                        if base_address in seen_addresses:
                            continue
                        seen_addresses.add(base_address)
                        
                        tokens.append({
                            'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                            'name': pair['baseToken'].get('name'),
                            'address': base_address,
                            'pair_address': pair.get('pairAddress'),
                            'price': float(pair.get('priceNative', 0)),
                            'price_usd': float(pair.get('priceUsd', 0)),
                            'market_cap': float(pair.get('marketCap', 0)) or float(pair.get('fdv', 0)),
                            'fdv': float(pair.get('fdv', 0)),
                            'change_24h': float(pair.get('priceChange', {}).get('h24', 0)),
                            'volume_24h': float(pair.get('volume', {}).get('h24', 0)),
                            'liquidity': float(pair.get('liquidity', {}).get('usd', 0)),
                            'txns_24h': pair.get('txns', {}).get('h24', {}).get('buys', 0) + pair.get('txns', {}).get('h24', {}).get('sells', 0),
                            'pair_created_at': pair.get('pairCreatedAt'),
                            'dex_id': pair.get('dexId'),
                            'chain_id': pair.get('chainId', 'solana'),
                            'logo_uri': pair.get('info', {}).get('imageUrl'),
                            'website': pair.get('info', {}).get('websiteUrl'),
                            'twitter': pair.get('info', {}).get('twitterUrl'),
                            'telegram': pair.get('info', {}).get('telegramUrl'),
                        })
                        
                        if len(tokens) >= limit:
                            break
                    
                    return tokens
        except aiohttp.ClientSSLError as ssl_error:
            logger.error(f"SSL certificate error fetching new tokens: {ssl_error}. Ensure certifi is installed and SSL context is properly configured.")
            # Don't fail silently - log the error for debugging
        except aiohttp.ClientError as client_error:
            logger.error(f"HTTP client error fetching new tokens: {client_error}")
        except Exception as e:
            logger.error(f"Error fetching new tokens: {e}", exc_info=True)
        
        # Fallback: search for new tokens
        try:
            url = f"{DEXSCREENER_API_URL}/dex/search?q=pump"
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    pairs = data.get('pairs', [])
                    
                    # Filter for Solana and sort by creation time
                    solana_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                    solana_pairs.sort(key=lambda x: x.get('pairCreatedAt', 0), reverse=True)
                    
                    tokens = []
                    for pair in solana_pairs[:limit]:
                        tokens.append({
                            'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                            'name': pair['baseToken'].get('name'),
                            'address': pair['baseToken']['address'],
                            'pair_address': pair.get('pairAddress'),
                            'price': float(pair.get('priceNative', 0)),
                            'price_usd': float(pair.get('priceUsd', 0)),
                            'market_cap': float(pair.get('marketCap', 0)) or float(pair.get('fdv', 0)),
                            'fdv': float(pair.get('fdv', 0)),
                            'change_24h': float(pair.get('priceChange', {}).get('h24', 0)),
                            'volume_24h': float(pair.get('volume', {}).get('h24', 0)),
                            'liquidity': float(pair.get('liquidity', {}).get('usd', 0)),
                            'pair_created_at': pair.get('pairCreatedAt'),
                            'dex_id': pair.get('dexId'),
                        })
                    return tokens
        except aiohttp.ClientSSLError as ssl_error:
            logger.error(f"SSL certificate error in fallback new tokens fetch: {ssl_error}")
        except Exception as e:
            logger.error(f"Error in fallback new tokens fetch: {e}")
        
        return []
    
    async def fetch_surging_tokens(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch tokens with highest volume/price surge in last 24h"""
        if not self.session:
            return []
        
        try:
            # Search for trending/high volume tokens
            url = f"{DEXSCREENER_API_URL}/dex/search?q=solana"
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    pairs = data.get('pairs', [])
                    
                    # Filter for Solana pairs with good volume
                    solana_pairs = [
                        p for p in pairs 
                        if p.get('chainId') == 'solana' 
                        and float(p.get('volume', {}).get('h24', 0)) > 1000
                    ]
                    
                    # Sort by price change (surging = high positive change)
                    solana_pairs.sort(
                        key=lambda x: float(x.get('priceChange', {}).get('h24', 0)), 
                        reverse=True
                    )
                    
                    tokens = []
                    seen_addresses = set()
                    
                    for pair in solana_pairs:
                        base_address = pair.get('baseToken', {}).get('address', '')
                        if base_address in seen_addresses:
                            continue
                        seen_addresses.add(base_address)
                        
                        tokens.append({
                            'symbol': f"{pair['baseToken']['symbol']}/{pair['quoteToken']['symbol']}",
                            'name': pair['baseToken'].get('name'),
                            'address': base_address,
                            'pair_address': pair.get('pairAddress'),
                            'price': float(pair.get('priceNative', 0)),
                            'price_usd': float(pair.get('priceUsd', 0)),
                            'market_cap': float(pair.get('marketCap', 0)) or float(pair.get('fdv', 0)),
                            'fdv': float(pair.get('fdv', 0)),
                            'change_24h': float(pair.get('priceChange', {}).get('h24', 0)),
                            'volume_24h': float(pair.get('volume', {}).get('h24', 0)),
                            'liquidity': float(pair.get('liquidity', {}).get('usd', 0)),
                            'txns_24h': pair.get('txns', {}).get('h24', {}).get('buys', 0) + pair.get('txns', {}).get('h24', {}).get('sells', 0),
                            'pair_created_at': pair.get('pairCreatedAt'),
                            'dex_id': pair.get('dexId'),
                            'chain_id': pair.get('chainId', 'solana'),
                            'logo_uri': pair.get('info', {}).get('imageUrl'),
                            'website': pair.get('info', {}).get('websiteUrl'),
                            'twitter': pair.get('info', {}).get('twitterUrl'),
                            'telegram': pair.get('info', {}).get('telegramUrl'),
                        })
                        
                        if len(tokens) >= limit:
                            break
                    
                    return tokens
        except aiohttp.ClientSSLError as ssl_error:
            logger.error(f"SSL certificate error fetching surging tokens: {ssl_error}. Ensure certifi is installed and SSL context is properly configured.")
        except aiohttp.ClientError as client_error:
            logger.error(f"HTTP client error fetching surging tokens: {client_error}")
        except Exception as e:
            logger.error(f"Error fetching surging tokens: {e}", exc_info=True)
        
        return []

    # Compatibility methods for Birdeye Proxy
    async def get_token_price(self, address: str) -> Dict[str, Any]:
        """Proxy compatibility method for fetching token price"""
        if not self.session:
            async with self:
                return await self._fetch_birdeye_direct(f"token/price?address={address}")
        return await self._fetch_birdeye_direct(f"token/price?address={address}")

    async def get_token_overview(self, address: str) -> Dict[str, Any]:
        """Proxy compatibility method for fetching token overview"""
        if not self.session:
            async with self:
                return await self._fetch_birdeye_direct(f"token/overview?address={address}")
        return await self._fetch_birdeye_direct(f"token/overview?address={address}")

    async def get_token_transactions(self, address: str, limit: int = 10, tx_type: str = "swap") -> Dict[str, Any]:
        """Proxy compatibility method for fetching token transactions"""
        path = f"txs/token?address={address}&limit={limit}&tx_type={tx_type}"
        if not self.session:
            async with self:
                return await self._fetch_birdeye_direct(path)
        return await self._fetch_birdeye_direct(path)

    async def get_token_security(self, address: str) -> Dict[str, Any]:
        """Fetch token security data from Birdeye (creator, top10, LP burned, etc.)"""
        if not self.session:
            async with self:
                return await self._fetch_birdeye_security(address)
        return await self._fetch_birdeye_security(address)

    async def _fetch_birdeye_security(self, address: str) -> Dict[str, Any]:
        """Internal helper for fetching token security data"""
        if not BIRDEYE_API_KEY or not self.session:
            return {"success": False, "message": "Birdeye API key not configured or session not initialized"}
        
        url = f"https://public-api.birdeye.so/defi/token_security?address={address}"
        headers = {
            "X-API-KEY": BIRDEYE_API_KEY,
            "Accept": "application/json",
            "x-chain": "solana"
        }
        
        try:
            async with self.session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data
                else:
                    # Fallback response with defaults
                    logger.warning(f"Birdeye token_security returned {resp.status}")
                    return {"success": False, "data": None}
        except Exception as e:
            logger.error(f"Birdeye token_security fetch error: {e}")
            return {"success": False, "message": str(e)}

    async def _fetch_birdeye_direct(self, path: str) -> Dict[str, Any]:
        """Internal helper for direct Birdeye API calls via proxy logic"""
        if not BIRDEYE_API_KEY:
            logger.error("BIRDEYE_API_KEY is missing in environment variables.")
            return {"success": False, "message": "Birdeye API key not configured"}
            
        if not self.session:
            logger.error("DataAggregator session is not initialized (self.session is None).")
            # Try to initialize session if missing (should be done in __aenter__)
            try:
                if CERTIFI_AVAILABLE:
                    ssl_context = ssl.create_default_context(cafile=certifi.where())
                    connector = aiohttp.TCPConnector(ssl=ssl_context)
                    self.session = aiohttp.ClientSession(connector=connector)
                else:
                    self.session = aiohttp.ClientSession()
            except Exception as init_err:
                logger.error(f"Failed to auto-initialize session: {init_err}")
                return {"success": False, "message": "Session initialization failed"}
        
        url = f"{BIRDEYE_API_URL}/{path}"
        headers = {
            "X-API-KEY": BIRDEYE_API_KEY,
            "Accept": "application/json",
            "x-chain": "solana"
        }
        
        try:
            async with self.session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning(f"Birdeye API returned {resp.status} for {path}")
                    try:
                        error_text = await resp.text()
                        logger.warning(f"Birdeye Error Body: {error_text}")
                    except:
                        pass
                    return {"success": False, "message": f"Birdeye API error: {resp.status}"}
                    
                data = await resp.json()
                return data
        except Exception as e:
            logger.error(f"Birdeye direct fetch error for {path}: {e}", exc_info=True)
            return {"success": False, "message": str(e)}

    async def fetch_birdeye_ohlcv(self, address: str, type: str = "1H", limit: int = 100) -> Dict[str, Any]:
        """Fetch historical OHLCV data from Birdeye API"""
        # Supported types: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M
        path = f"defi/ohlcv?address={address}&type={type}&limit={limit}"
        return await self._fetch_birdeye_direct(path)

    async def fetch_dex_screener_ohlcv(self, chain_id: str, pair_address: str, resolution: str = "1h", limit: int = 100) -> Dict[str, Any]:
        """Fetch historical OHLCV data from DexScreener charting API"""
        if not self.session:
            return {"success": False, "message": "Aiohttp session not initialized"}

        # Resolution map for DexScreener chart API
        # res=1 (1m), res=5 (5m), res=15 (15m), res=60 (1h), res=240 (4h), res=1D (1d)
        res_map = {
            "1m": "1",
            "5m": "5",
            "15m": "15",
            "1h": "60",
            "4h": "240",
            "1d": "1D"
        }
        res_value = res_map.get(resolution, "60")
        
        # DexScreener internal charting API
        url = f"https://io.dexscreener.com/dex/chart/v1/main/{chain_id}/{pair_address}?res={res_value}"
        
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {"success": True, "data": data}
                else:
                    logger.warning(f"DexScreener chart API returned {resp.status} for {pair_address}")
                    return {"success": False, "status": resp.status}
        except Exception as e:
            logger.error(f"DexScreener chart fetch error: {e}")
            return {"success": False, "message": str(e)}

async def get_aggregator():
    """Factory function for main.py to get an aggregator instance"""
    return DataAggregator()
