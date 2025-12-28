"""
Migration Tracker Service

Tracks tokens migrating from Pump.fun to Raydium.
Provides API endpoint for frontend to fetch migrating tokens.

Features:
- Detect tokens approaching graduation threshold (~$69K)
- Track tokens that have just graduated
- Monitor migration events
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

from services.pump_fun_tracker import get_pump_fun_tracker, TokenState
from services.raydium_tracker import get_raydium_tracker
from services.redis_service import get_redis_service
from services.http_utils import is_cloudflare_error

logger = logging.getLogger(__name__)


@dataclass
class MigratingToken:
    """Token that is migrating or has migrated to Raydium"""
    token_address: str
    token_symbol: str
    token_name: str
    market_cap_usd: float
    graduation_status: str  # 'approaching', 'graduating', 'graduated'
    raydium_pool_address: Optional[str] = None
    graduation_timestamp: Optional[int] = None
    liquidity_usd: Optional[float] = None
    price_impact_1k: Optional[float] = None
    logo_url: Optional[str] = None


class MigrationTracker:
    """
    Tracks tokens migrating from Pump.fun to Raydium.
    
    Provides:
    - List of tokens approaching graduation
    - List of recently graduated tokens
    - Migration event notifications
    """
    
    GRADUATION_THRESHOLD_USD = 69_000  # ~$69K
    
    def __init__(self):
        self.migrating_tokens: Dict[str, MigratingToken] = {}
        self.recent_graduations: List[MigratingToken] = []
        self._running = False
    
    async def start(self):
        """Start the migration tracker"""
        self._running = True
        
        # Subscribe to graduation events from Pump.fun tracker
        try:
            pump_tracker = await get_pump_fun_tracker()
            pump_tracker.on_graduation(self._handle_graduation)
        except Exception as e:
            logger.warning(f"Could not subscribe to graduation events: {e}")
        
        logger.info("MigrationTracker started")
    
    async def stop(self):
        """Stop the migration tracker"""
        self._running = False
        logger.info("MigrationTracker stopped")
    
    async def get_migrating_tokens(self, limit: int = 20) -> List[Dict]:
        """
        Get tokens that are migrating or have migrated to Raydium.
        
        Returns:
        - Tokens approaching graduation (market cap near $69K)
        - Recently graduated tokens (last 24 hours)
        """
        import aiohttp
        
        migrating: List[MigratingToken] = []
        
        # Get recently graduated tokens
        for token in self.recent_graduations[-limit:]:
            migrating.append(token)
        
        # Fetch tokens approaching graduation from Pump.fun API
        connector = None
        try:
            import ssl
            # Create SSL context that doesn't verify certificates (for development)
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Add request headers to mimic browser requests
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
            }
            
            # Retry logic with exponential backoff
            max_retries = 3
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    # Create a new connector for each attempt to avoid closed connector issues
                    connector = aiohttp.TCPConnector(ssl=ssl_context)
                    
                    # Use proper context manager for session to ensure it stays open
                    async with aiohttp.ClientSession(connector=connector) as session:
                        # Fetch trending/new coins from Pump.fun
                        url = "https://frontend-api.pump.fun/coins"
                        params = {
                            "offset": 0,
                            "limit": 50,
                            "sort": "market_cap",
                            "order": "DESC",
                            "includeNsfw": "false"
                        }
                        
                        async with session.get(url, params=params, headers=headers) as resp:
                            # Handle Cloudflare errors (including 530 DNS errors) gracefully
                            if is_cloudflare_error(resp.status):
                                logger.warning(
                                    f"Migration tracker: Pump.fun API returned {resp.status} (Cloudflare error) on attempt {attempt + 1}. "
                                    "Using fallback (empty results)."
                                )
                                # Return empty results gracefully instead of crashing
                                break
                            
                            if resp.status == 200:
                                data = await resp.json()
                                
                                # Handle both list and dict responses
                                if isinstance(data, list):
                                    coins = data
                                elif isinstance(data, dict):
                                    coins = data.get("coins", [])
                                    if not coins and "data" in data:
                                        coins = data.get("data", [])
                                else:
                                    logger.warning(f"Unexpected response format in migration tracker: {type(data)}")
                                    coins = []
                                
                                if isinstance(coins, list):
                                    # Filter for tokens approaching graduation
                                    # Market cap between $50K and $75K (approaching $69K threshold)
                                    for coin in coins:
                                        market_cap = coin.get("usd_market_cap", 0) or coin.get("market_cap", 0)
                                        
                                        # Check if approaching graduation (market cap between $50K and $75K)
                                        # These are tokens close to the $69K graduation threshold
                                        if 50_000 <= market_cap <= 75_000 and not coin.get("complete", False):
                                            migrating_token = MigratingToken(
                                                token_address=coin.get("mint", ""),
                                                token_symbol=coin.get("symbol", ""),
                                                token_name=coin.get("name", ""),
                                                market_cap_usd=market_cap,
                                                graduation_status="approaching",
                                                logo_url=coin.get("image_uri"),
                                            )
                                            migrating.append(migrating_token)
                                        
                                        # Also include tokens that just graduated (within last hour)
                                        elif coin.get("complete", False) and coin.get("raydium_pool"):
                                            created_time = coin.get("created_timestamp", 0) * 1000
                                            # Estimate graduation time (usually happens when market cap hits ~$69K)
                                            # For simplicity, use created_timestamp + some offset
                                            # In production, you'd track actual graduation time
                                            graduation_time = created_time + (60 * 60 * 1000)  # Assume 1 hour after creation
                                            time_since_graduation = time.time() * 1000 - graduation_time
                                            
                                            if 0 <= time_since_graduation < 24 * 60 * 60 * 1000:  # Last 24 hours
                                                migrating_token = MigratingToken(
                                                    token_address=coin.get("mint", ""),
                                                    token_symbol=coin.get("symbol", ""),
                                                    token_name=coin.get("name", ""),
                                                    market_cap_usd=market_cap,
                                                    graduation_status="graduated",
                                                    raydium_pool_address=coin.get("raydium_pool"),
                                                    graduation_timestamp=int(graduation_time),
                                                    logo_url=coin.get("image_uri"),
                                                )
                                                migrating.append(migrating_token)
                                        
                                        # Check if recently graduated (within last 24 hours)
                                        elif coin.get("complete", False) and coin.get("raydium_pool"):
                                            graduation_time = coin.get("created_timestamp", 0) * 1000
                                            if time.time() * 1000 - graduation_time < 24 * 60 * 60 * 1000:
                                                migrating_token = MigratingToken(
                                                    token_address=coin.get("mint", ""),
                                                    token_symbol=coin.get("symbol", ""),
                                                    token_name=coin.get("name", ""),
                                                    market_cap_usd=market_cap,
                                                    graduation_status="graduated",
                                                    raydium_pool_address=coin.get("raydium_pool"),
                                                    graduation_timestamp=int(graduation_time),
                                                    logo_url=coin.get("image_uri"),
                                                )
                                                migrating.append(migrating_token)
                                        
                                        if len(migrating) >= limit:
                                            break
                                    
                                    # Break out of retry loop on success
                                    break
                                else:
                                    logger.warning(f"Migration tracker: Expected list but got {type(coins)}")
                                    break
                            else:
                                error_text = await resp.text()
                                logger.warning(
                                    f"Migration tracker: Pump.fun API returned status {resp.status} on attempt {attempt + 1}: "
                                    f"{error_text[:200]}"
                                )
                                
                                # Don't retry on 4xx errors
                                if 400 <= resp.status < 500:
                                    break
                                
                                # Retry on 5xx errors (but not 530, which we handle above)
                                if attempt < max_retries - 1:
                                    wait_time = 2 ** attempt
                                    logger.info(f"Migration tracker: Retrying after {wait_time} seconds...")
                                    await asyncio.sleep(wait_time)
                                    continue
                                
                                break
                        
                except RuntimeError as e:
                    # Handle "Session is closed" errors specifically
                    if "Session is closed" in str(e) or "session is closed" in str(e).lower():
                        logger.warning(
                            f"Migration tracker: Session closed error on attempt {attempt + 1}: {e}. "
                            "Will retry with new session and connector."
                        )
                        if attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            await asyncio.sleep(wait_time)
                            continue
                    else:
                        raise
                        
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    last_exception = e
                    error_type = type(e).__name__
                    logger.warning(
                        f"Migration tracker: Request attempt {attempt + 1} failed: "
                        f"{error_type}: {str(e)}"
                    )
                    
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.info(f"Migration tracker: Retrying after {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(
                            f"Migration tracker: All {max_retries} attempts failed. "
                            f"Last error: {error_type}: {str(e)}"
                        )
                        import traceback
                        logger.error(traceback.format_exc())
                except Exception as e:
                    # Re-raise other exceptions
                    raise
                        
        except Exception as e:
            logger.error(f"Error fetching migrating tokens from Pump.fun: {type(e).__name__}: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        # Sort by market cap (highest first)
        migrating.sort(key=lambda x: x.market_cap_usd, reverse=True)
        
        # Limit results
        migrating = migrating[:limit]
        
        # Convert to dict format for API response
        return [asdict(token) for token in migrating]
    
    async def _handle_graduation(self, update):
        """Handle graduation event from Pump.fun tracker"""
        from services.pump_fun_tracker import TokenStateUpdate
        import aiohttp
        
        if not isinstance(update, TokenStateUpdate):
            return
        
        # Fetch token details from Pump.fun API
        token_symbol = ""
        token_name = ""
        market_cap_usd = 0
        logo_url = ""
        
        try:
            import ssl
            # Create SSL context that doesn't verify certificates (for development)
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Add request headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9'
            }
            
            # Create connector and use context manager for session
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            async with aiohttp.ClientSession(connector=connector) as session:
                url = f"https://frontend-api.pump.fun/coins/{update.token_address}"
                async with session.get(url, headers=headers) as resp:
                    # Handle Cloudflare errors (including 530 DNS errors) gracefully
                    if is_cloudflare_error(resp.status):
                        logger.warning(
                            f"Migration tracker: Pump.fun API returned {resp.status} (Cloudflare error) for token {update.token_address}. "
                            "Skipping token details fetch."
                        )
                    elif resp.status == 200:
                        coin_data = await resp.json()
                        token_symbol = coin_data.get("symbol", "")
                        token_name = coin_data.get("name", "")
                        market_cap_usd = coin_data.get("usd_market_cap", 0) or coin_data.get("market_cap", 0)
                        logo_url = coin_data.get("image_uri", "")
        except RuntimeError as e:
            # Handle "Session is closed" errors
            if "Session is closed" in str(e) or "session is closed" in str(e).lower():
                logger.debug(
                    f"Migration tracker: Session closed error when fetching token {update.token_address}: {e}"
                )
            else:
                raise
        except Exception as e:
            logger.debug(
                f"Failed to fetch token details for {update.token_address}: "
                f"{type(e).__name__}: {e}"
            )
        
        # Create migrating token entry
        migrating_token = MigratingToken(
            token_address=update.token_address,
            token_symbol=token_symbol,
            token_name=token_name,
            market_cap_usd=market_cap_usd,
            graduation_status="graduated",
            raydium_pool_address=update.raydium_pool_address,
            graduation_timestamp=update.timestamp,
            logo_url=logo_url,
        )
        
        # Add to recent graduations
        self.recent_graduations.append(migrating_token)
        
        # Keep only last 50
        if len(self.recent_graduations) > 50:
            self.recent_graduations = self.recent_graduations[-50:]
        
        # Store in migrating tokens
        self.migrating_tokens[update.token_address] = migrating_token
        
        logger.info(f"Token graduated: {update.token_address} -> {update.raydium_pool_address}")


# Singleton instance
_migration_tracker: Optional[MigrationTracker] = None


async def get_migration_tracker() -> MigrationTracker:
    """Get or create the migration tracker singleton"""
    global _migration_tracker
    
    if _migration_tracker is None:
        _migration_tracker = MigrationTracker()
        await _migration_tracker.start()
    
    return _migration_tracker
