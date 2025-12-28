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
                token_with_status = {
                    **token,
                    "graduation_status": "graduated",
                    "graduation_progress": 100,
                    "graduation_timestamp": int(datetime.now().timestamp() * 1000),
                }
                newly_graduated.append(token_with_status)
                graduated_tokens.appendleft(token_with_status)
                logger.info(f"Token graduated! {token.get('symbol', mint[:8])} -> Raydium: {raydium_pool}")
            
            # Detect tokens approaching graduation
            elif progress >= 70 and prev_progress < 70:
                token_with_status = {
                    **token,
                    "graduation_status": "approaching",
                    "graduation_progress": progress,
                    "sol_in_curve": sol_reserves,
                }
                newly_approaching.append(token_with_status)
                approaching_tokens.appendleft(token_with_status)
                logger.info(f"Token approaching graduation: {token.get('symbol', mint[:8])} ({progress:.1f}%)")
        
        return newly_approaching, newly_graduated
    
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
        asyncio.create_task(_migration_stream.start())
        logger.info("Started migration monitoring stream")


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
    This is a batch operation to seed the migration tracker.
    """
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    high_progress_tokens = []
    
    try:
        # Fetch top tokens by market cap (likely to be close to graduation)
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
                        
                        # Only include tokens approaching or completed graduation
                        if progress >= 50 or is_complete or raydium_pool:
                            status = "graduated" if (is_complete or raydium_pool) else "approaching"
                            high_progress_tokens.append({
                                **coin,
                                "graduation_status": status,
                                "graduation_progress": 100 if status == "graduated" else progress,
                                "sol_in_curve": sol_reserves,
                            })
                    
                    logger.info(f"Fetched {len(high_progress_tokens)} high-progress tokens")
                    
                elif resp.status in (530, 503):
                    logger.warning("Pump.fun API blocked by Cloudflare")
                    
    except Exception as e:
        logger.error(f"Error fetching high-progress tokens: {e}")
    
    return high_progress_tokens
