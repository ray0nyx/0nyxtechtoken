"""
Supply Tracking Service

Tracks token supply changes (mints, burns) and updates market cap accordingly.

Features:
- Subscribe to token mint account changes via Helius
- Detect mint/burn instructions
- Update circulating supply
- Recalculate market cap on supply changes
- Cache supply in Redis with TTL
"""

import asyncio
import logging
import time
from typing import Dict, Optional, Callable, List
from dataclasses import dataclass
from collections import defaultdict

import aiohttp

from services.redis_service import RedisService, get_redis_service
from services.redis_schemas import token_supply_key, TOKEN_SUPPLY_TTL_SECONDS

logger = logging.getLogger(__name__)


@dataclass
class SupplyUpdate:
    """Supply change event"""
    token_address: str
    old_supply: int
    new_supply: int
    old_circulating_supply: int
    new_circulating_supply: int
    change_type: str  # 'mint' or 'burn'
    amount: int
    timestamp: int


class SupplyTracker:
    """
    Tracks token supply changes and updates market cap.
    
    Monitors:
    - Token mint account changes
    - Mint instructions
    - Burn instructions (transfers to burn address)
    """
    
    def __init__(self, redis_service: RedisService, helius_api_key: str):
        self.redis = redis_service
        self.helius_api_key = helius_api_key
        self.tracked_tokens: Dict[str, Dict] = {}  # token -> {supply, circulating_supply, decimals}
        self._callbacks: List[Callable[[SupplyUpdate], None]] = []
        self._session: Optional[aiohttp.ClientSession] = None
        self._running = False
        
        # Burn address (where tokens go when burned)
        self.BURN_ADDRESS = "1nc1nerator11111111111111111111111111111111"
    
    async def start(self):
        """Start the supply tracker"""
        self._running = True
        self._session = aiohttp.ClientSession()
        logger.info("SupplyTracker started")
    
    async def stop(self):
        """Stop the supply tracker"""
        self._running = False
        if self._session:
            await self._session.close()
        logger.info("SupplyTracker stopped")
    
    async def track_token(self, token_address: str):
        """Start tracking supply for a token"""
        if token_address in self.tracked_tokens:
            return
        
        # Fetch initial supply
        supply_info = await self._fetch_supply(token_address)
        if supply_info:
            self.tracked_tokens[token_address] = supply_info
            await self._cache_supply(token_address, supply_info)
        
        # Subscribe to mint account changes via Helius WebSocket
        # (This would be done through the swap stream service)
        logger.info(f"Tracking supply for token: {token_address}")
    
    async def untrack_token(self, token_address: str):
        """Stop tracking supply for a token"""
        self.tracked_tokens.pop(token_address, None)
        logger.info(f"Stopped tracking supply for token: {token_address}")
    
    async def process_mint_event(self, token_address: str, minted_amount: int, decimals: int = 9):
        """Process a mint event"""
        if token_address not in self.tracked_tokens:
            await self.track_token(token_address)
        
        token_info = self.tracked_tokens.get(token_address, {})
        old_supply = token_info.get("supply", 0)
        old_circulating = token_info.get("circulating_supply", 0)
        
        # Update supply
        new_supply = old_supply + minted_amount
        new_circulating = old_circulating + minted_amount  # Minted tokens are circulating
        
        token_info["supply"] = new_supply
        token_info["circulating_supply"] = new_circulating
        
        # Cache updated supply
        await self._cache_supply(token_address, token_info)
        
        # Notify callbacks
        update = SupplyUpdate(
            token_address=token_address,
            old_supply=old_supply,
            new_supply=new_supply,
            old_circulating_supply=old_circulating,
            new_circulating_supply=new_circulating,
            change_type="mint",
            amount=minted_amount,
            timestamp=int(time.time() * 1000)
        )
        
        for callback in self._callbacks:
            try:
                callback(update)
            except Exception as e:
                logger.error(f"Supply callback error: {e}")
        
        logger.info(f"Mint detected: {token_address}, +{minted_amount} (supply: {old_supply} -> {new_supply})")
    
    async def process_burn_event(self, token_address: str, burned_amount: int):
        """Process a burn event"""
        if token_address not in self.tracked_tokens:
            await self.track_token(token_address)
        
        token_info = self.tracked_tokens.get(token_address, {})
        old_supply = token_info.get("supply", 0)
        old_circulating = token_info.get("circulating_supply", 0)
        
        # Update supply (burns reduce both total and circulating)
        new_supply = max(0, old_supply - burned_amount)
        new_circulating = max(0, old_circulating - burned_amount)
        
        token_info["supply"] = new_supply
        token_info["circulating_supply"] = new_circulating
        
        # Cache updated supply
        await self._cache_supply(token_address, token_info)
        
        # Notify callbacks
        update = SupplyUpdate(
            token_address=token_address,
            old_supply=old_supply,
            new_supply=new_supply,
            old_circulating_supply=old_circulating,
            new_circulating_supply=new_circulating,
            change_type="burn",
            amount=burned_amount,
            timestamp=int(time.time() * 1000)
        )
        
        for callback in self._callbacks:
            try:
                callback(update)
            except Exception as e:
                logger.error(f"Supply callback error: {e}")
        
        logger.info(f"Burn detected: {token_address}, -{burned_amount} (supply: {old_supply} -> {new_supply})")
    
    async def get_supply(self, token_address: str) -> Optional[Dict]:
        """Get current supply info for a token"""
        # Check cache first
        cached = await self._get_cached_supply(token_address)
        if cached:
            return cached
        
        # Fetch fresh
        supply_info = await self._fetch_supply(token_address)
        if supply_info:
            await self._cache_supply(token_address, supply_info)
            return supply_info
        
            return None
            
    async def _fetch_supply(self, token_address: str) -> Optional[Dict]:
        """Fetch supply from Solana RPC or Helius"""
        if not self._session:
            return None
    
        try:
            # Use Helius API to get token supply
            url = f"https://api.helius.xyz/v0/token-metadata?api-key={self.helius_api_key}"
            payload = {"mintAccounts": [token_address]}
            
            async with self._session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    return None
                
                data = await resp.json()
                if not data or len(data) == 0:
                    return None
                
                token_data = data[0]
                supply = int(token_data.get("supply", 0))
                decimals = token_data.get("decimals", 9)
                
                # For now, assume all supply is circulating (no locked tokens)
                # In production, you'd track locked/burned tokens separately
                circulating_supply = supply
                
                return {
                    "supply": supply,
                    "circulating_supply": circulating_supply,
                    "decimals": decimals,
                    "last_updated": int(time.time())
                }
            
        except Exception as e:
            logger.error(f"Failed to fetch supply for {token_address}: {e}")
            return None
    
    async def _cache_supply(self, token_address: str, supply_info: Dict):
        """Cache supply info in Redis"""
        if not self.redis or not self.redis.redis:
            return
        
        import json
        key = token_supply_key(token_address)
        
        try:
            await self.redis.redis.setex(
                key, 
                TOKEN_SUPPLY_TTL_SECONDS, 
                json.dumps(supply_info)
            )
        except Exception as e:
            logger.error(f"Failed to cache supply: {e}")
    
    async def _get_cached_supply(self, token_address: str) -> Optional[Dict]:
        """Get cached supply info"""
        if not self.redis or not self.redis.redis:
            return None
        
        import json
        key = token_supply_key(token_address)
        
        try:
            data = await self.redis.redis.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Failed to get cached supply: {e}")
        
        return None
    
    def on_supply_change(self, callback: Callable[[SupplyUpdate], None]):
        """Register callback for supply change events"""
        self._callbacks.append(callback)


# Singleton instance
_supply_tracker: Optional[SupplyTracker] = None


async def get_supply_tracker() -> SupplyTracker:
    """Get or create the supply tracker singleton"""
    global _supply_tracker
    
    if _supply_tracker is None:
        from config import settings
        redis = await get_redis_service()
        _supply_tracker = SupplyTracker(redis, settings.helius_api_key)
        await _supply_tracker.start()
    
    return _supply_tracker
