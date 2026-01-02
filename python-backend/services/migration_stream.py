"""
Migration Stream Service
Tracks tokens approaching graduation from Pump.fun to Raydium.
A token graduates when its bonding curve reaches ~85 SOL (~$69K market cap).
"""
import asyncio
import logging
import ssl
from datetime import datetime
from typing import Optional, Dict, List
from collections import deque, OrderedDict
import aiohttp

logger = logging.getLogger(__name__)

# Graduation threshold in SOL (bonding curve completes at ~85 SOL)
GRADUATION_THRESHOLD_SOL = 85

# Approaching threshold (70% of graduation = ~60 SOL)
APPROACHING_THRESHOLD_SOL = 60

# In-memory stores
approaching_tokens: deque = deque(maxlen=50)  # Tokens approaching graduation
graduated_tokens: deque = deque(maxlen=50)     # Recently graduated tokens
_token_progress: OrderedDict = OrderedDict()   # Track bonding curve progress
migration_subscribers = set()  # Callbacks for migration events


class MigrationStream:
    """
    Monitors tokens for graduation from Pump.fun bonding curve to Raydium.
    """
    
    def __init__(self):
        self._running = False
        self._check_interval = 15  # Check every 15 seconds
    
    async def start(self):
        """Start monitoring for migrations"""
        self._running = True
        logger.info("Migration stream started")
        
        while self._running:
            try:
                await self._check_migrations()
            except Exception as e:
                logger.error(f"Migration check error: {e}")
            
            await asyncio.sleep(self._check_interval)
    
    async def _check_migrations(self):
        """Check for tokens approaching or completing graduation"""
        from services.pump_portal_stream import get_recent_tokens
        
        # Get recent tokens from the stream
        recent = get_recent_tokens(100)
        
        newly_approaching = []
        newly_graduated = []
        
        for token in recent:
            mint = token.get("mint")
            if not mint:
                continue
            
            # Check bonding curve progress
            sol_reserves = token.get("virtual_sol_reserves") or 0
            is_complete = token.get("complete", False)
            raydium_pool = token.get("raydium_pool")
            
            # Calculate progress percentage
            progress = min(100, (sol_reserves / GRADUATION_THRESHOLD_SOL) * 100) if sol_reserves else 0
            
            prev_progress = _token_progress.get(mint, 0)
            _token_progress[mint] = progress
            
            # Keep progress cache bounded
            if len(_token_progress) > 500:
                _token_progress.popitem(last=False)
            
            # Detect newly graduated tokens
            if (is_complete or raydium_pool) and mint not in [t.get("mint") for t in graduated_tokens]:
                symbol = (token.get("symbol") or "").upper()
                name = (token.get("name") or "").upper()
                
                # CRITICAL FILTER: Filter out generic platform tokens and billion-dollar junk
                if symbol in ["PUMP", "PUMPFUN", "PUMP.FUN", "PUMPSWAP", "INDEX"] or "PUMP FUN" in name or "PLATFORM" in name:
                    if float(token.get("usd_market_cap", 0) or 0) > 10_000_000:
                        continue
                        
                token_with_status = {
                    **token,
                    "graduation_status": "graduated",
                    "graduation_progress": 100,
                    "graduation_timestamp": int(datetime.now().timestamp() * 1000),
                }
                newly_graduated.append(token_with_status)
                graduated_tokens.appendleft(token_with_status)
                logger.info(f"Token graduated! {token.get('symbol', mint[:8])} -> Raydium: {raydium_pool}")
                
                # Notify subscribers
                await self._notify_subscribers(token_with_status)
            
            # Detect tokens approaching graduation
            elif progress >= 70 and prev_progress < 70:
                symbol = (token.get("symbol") or "").upper()
                name = (token.get("name") or "").upper()
                
                # Filter out generic junk
                if symbol in ["PUMP", "PUMPFUN", "PUMP.FUN", "PUMPSWAP", "INDEX"] or "PUMP FUN" in name or "PLATFORM" in name:
                    if float(token.get("usd_market_cap", 0) or 0) > 10_000_000:
                        continue

                token_with_status = {
                    **token,
                    "graduation_status": "approaching",
                    "graduation_progress": progress,
                    "sol_in_curve": sol_reserves,
                }
                newly_approaching.append(token_with_status)
                approaching_tokens.appendleft(token_with_status)
                logger.info(f"Token approaching graduation: {token.get('symbol', mint[:8])} ({progress:.1f}%)")
                
                # Notify subscribers
                await self._notify_subscribers(token_with_status)
        
        return newly_approaching, newly_graduated
    
    async def _notify_subscribers(self, token: dict):
        """Notify all subscribers of a migration event"""
        for callback in list(migration_subscribers):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(token)
                else:
                    callback(token)
            except Exception as e:
                logger.error(f"Migration subscriber callback error: {e}")
    
    async def stop(self):
        """Stop monitoring"""
        self._running = False


# Global instance
_migration_stream: Optional[MigrationStream] = None


async def start_migration_stream():
    """Start the global migration stream"""
    global _migration_stream
    if _migration_stream is None:
        _migration_stream = MigrationStream()
        
        # Seed the cache at startup with high-progress tokens
        try:
            logger.info("Seeding migration cache at startup...")
            seed_tokens = await fetch_high_progress_tokens()
            
            for token in seed_tokens:
                status = token.get("graduation_status", "approaching")
                if status == "graduated":
                    if token.get("mint") not in [t.get("mint") for t in graduated_tokens]:
                        graduated_tokens.appendleft(token)
                else:
                    if token.get("mint") not in [t.get("mint") for t in approaching_tokens]:
                        approaching_tokens.appendleft(token)
            
            logger.info(f"Seeded cache with {len(graduated_tokens)} graduated and {len(approaching_tokens)} approaching tokens")
        except Exception as e:
            logger.warning(f"Failed to seed migration cache: {e}")
        
        asyncio.create_task(_migration_stream.start())
        logger.info("Started migration monitoring stream")


def subscribe_to_migrations(callback):
    """Subscribe to migration events"""
    migration_subscribers.add(callback)
    

def unsubscribe_from_migrations(callback):
    """Unsubscribe from migration events"""
    migration_subscribers.discard(callback)


def is_migration_stream_connected() -> bool:
    """Check if migration stream is running"""
    return _migration_stream is not None and _migration_stream._running


def get_approaching_tokens(limit: int = 20) -> List[dict]:
    """Get tokens approaching graduation"""
    return list(approaching_tokens)[:limit]


def get_graduated_tokens(limit: int = 20) -> List[dict]:
    """Get recently graduated tokens"""
    return list(graduated_tokens)[:limit]


def get_all_migrating_tokens(limit: int = 20) -> List[dict]:
    """Get all migrating tokens (approaching + graduated), sorted by status"""
    all_tokens = []
    
    # Add graduated first
    for t in list(graduated_tokens)[:limit // 2]:
        all_tokens.append(t)
    
    # Then approaching
    for t in list(approaching_tokens)[:limit // 2]:
        if t.get("mint") not in [x.get("mint") for x in all_tokens]:
            all_tokens.append(t)
    
    # Sort: graduated first, then by progress
    all_tokens.sort(key=lambda x: (
        0 if x.get("graduation_status") == "graduated" else 1,
        -(x.get("graduation_progress", 0))
    ))
    
    return all_tokens[:limit]


async def fetch_high_progress_tokens() -> List[dict]:
    """
    Fetch tokens with high bonding curve progress directly from Pump.fun API.
    Falls back to DexScreener for high market cap Solana tokens if Pump.fun fails.
    """
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    high_progress_tokens = []
    
    # Try Pump.fun API first
    try:
        url = "https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=market_cap&order=DESC&includeNsfw=false"
        timeout = aiohttp.ClientTimeout(total=10)
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Accept": "application/json"
            }) as resp:
                if resp.status == 200:
                    coins = await resp.json()
                    
                    for coin in coins:
                        sol_reserves = coin.get("virtual_sol_reserves", 0)
                        is_complete = coin.get("complete", False)
                        raydium_pool = coin.get("raydium_pool")
                        
                        progress = min(100, (sol_reserves / GRADUATION_THRESHOLD_SOL) * 100) if sol_reserves else 0
                        
                        symbol = (coin.get("symbol") or "").upper()
                        name = (coin.get("name") or "").upper()
                        
                        # CRITICAL FILTER: Filter out generic platform tokens
                        if symbol in ["PUMP", "PUMPFUN", "PUMP.FUN", "PUMPSWAP", "INDEX"] or "PUMP FUN" in name or "PLATFORM" in name:
                            if float(coin.get("usd_market_cap", 0) or 0) > 10_000_000:
                                continue

                        # Only include tokens approaching or completed graduation
                        if progress >= 50 or is_complete or raydium_pool:
                            status = "graduated" if (is_complete or raydium_pool) else "approaching"
                            high_progress_tokens.append({
                                **coin,
                                "graduation_status": status,
                                "graduation_progress": 100 if status == "graduated" else progress,
                                "sol_in_curve": sol_reserves,
                            })
                    
                    if high_progress_tokens:
                        logger.info(f"Fetched {len(high_progress_tokens)} high-progress tokens from Pump.fun")
                        return high_progress_tokens
                        
                elif resp.status in (530, 503):
                    logger.warning("Pump.fun API blocked by Cloudflare, trying DexScreener fallback")
                    
    except Exception as e:
        logger.warning(f"Pump.fun API failed: {e}, trying DexScreener fallback")
    
    # DexScreener fallback - get high volume Solana pairs
    try:
        logger.info("Trying DexScreener fallback for high market cap tokens...")
        url = "https://api.dexscreener.com/latest/dex/search"
        params = {"q": "Raydium"}  # Raydium pairs are graduated from Pump.fun
        
        timeout = aiohttp.ClientTimeout(total=10)
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    pairs = data.get("pairs") or []
                    
                    # Filter to Solana pairs with high market cap
                    solana_pairs = [p for p in pairs if p and p.get("chainId") == "solana"]
                    solana_pairs.sort(key=lambda x: float(x.get("fdv") or x.get("marketCap") or 0), reverse=True)
                    
                    for pair in solana_pairs[:30]:
                        base = pair.get("baseToken") or {}
                        info = pair.get("info") or {}
                        volume = pair.get("volume") or {}
                        liquidity = pair.get("liquidity") or {}
                        price_change = pair.get("priceChange") or {}
                        
                        mc = float(pair.get("fdv") or pair.get("marketCap") or 0)
                        
                        # Only include tokens with market cap > $50K (graduated tokens)
                        if mc < 50000:
                            continue
                        
                        symbol = (base.get("symbol") or "").upper()
                        name = (base.get("name") or "").upper()
                        
                        # Filter out generic pump tokens
                        if symbol in ["PUMP", "PUMPFUN", "PUMP.FUN", "PUMPSWAP"] or "PUMP FUN" in name:
                            continue
                        
                        high_progress_tokens.append({
                            "mint": base.get("address", ""),
                            "symbol": base.get("symbol", ""),
                            "name": base.get("name", ""),
                            "image_uri": info.get("imageUrl"),
                            "usd_market_cap": mc,
                            "market_cap": mc,
                            "volume_24h": float(volume.get("h24") or 0),
                            "liquidity": float(liquidity.get("usd") or 0),
                            "price_change_24h": float(price_change.get("h24") or 0),
                            "complete": True,  # Raydium pairs are graduated
                            "raydium_pool": pair.get("pairAddress"),
                            "graduation_status": "graduated",
                            "graduation_progress": 100,
                            "source": "dexscreener"
                        })
                    
                    if high_progress_tokens:
                        logger.info(f"Fetched {len(high_progress_tokens)} high market cap tokens from DexScreener")
                        
    except Exception as e:
        logger.error(f"DexScreener fallback also failed: {e}")
    
    return high_progress_tokens
