"""
Pump.fun Bonding Curve Tracker

Detects when a token is on Pump.fun bonding curve vs. graduated to Raydium.
Tracks bonding curve state and calculates prices accordingly.

Features:
- Bonding curve detection
- Price calculation on bonding curve
- State tracking (pump_fun vs raydium)
- Graduation detection
"""

import asyncio
import logging
import time
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum

import aiohttp

from services.redis_service import RedisService, get_redis_service
from services.redis_schemas import token_state_key

logger = logging.getLogger(__name__)


class TokenState(str, Enum):
    """Token lifecycle state"""
    PUMP_FUN = "pump_fun"  # On bonding curve
    RAYDIUM = "raydium"  # Graduated to Raydium
    UNKNOWN = "unknown"


@dataclass
class BondingCurveInfo:
    """Bonding curve information"""
    token_address: str
    bonding_curve_address: str
    virtual_sol_reserves: float
    virtual_token_reserves: float
    total_supply: int
    market_cap: float
    is_complete: bool  # Has reached graduation threshold


@dataclass
class TokenStateUpdate:
    """Token state change event"""
    token_address: str
    old_state: TokenState
    new_state: TokenState
    timestamp: int
    raydium_pool_address: Optional[str] = None


class PumpFunTracker:
    """
    Tracks Pump.fun bonding curve state and graduation.
    
    Features:
    - Detect bonding curve vs. Raydium state
    - Calculate price from bonding curve formula
    - Track graduation events
    - State persistence in Redis
    """
    
    # Pump.fun program address
    PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    
    # Graduation threshold (market cap when token graduates)
    GRADUATION_THRESHOLD_USD = 69_000  # ~$69K
    
    def __init__(self, redis_service: RedisService, pump_fun_api_key: Optional[str] = None):
        self.redis = redis_service
        self.pump_fun_api_key = pump_fun_api_key
        self.token_states: Dict[str, TokenState] = {}  # token -> state
        self.bonding_curves: Dict[str, BondingCurveInfo] = {}  # token -> curve info
        self._callbacks: list[Callable[[TokenStateUpdate], None]] = []
        self._session: Optional[aiohttp.ClientSession] = None
        self._running = False
    
    async def start(self):
        """Start the tracker"""
        self._running = True
        self._session = aiohttp.ClientSession()
        logger.info("PumpFunTracker started")
    
    async def stop(self):
        """Stop the tracker"""
        self._running = False
        if self._session:
            await self._session.close()
        logger.info("PumpFunTracker stopped")
    
    async def get_token_state(self, token_address: str) -> TokenState:
        """Get current state of a token"""
        # Check cache first
        cached_state = await self._get_cached_state(token_address)
        if cached_state:
            return cached_state
        
        # Determine state by checking Pump.fun API
        state = await self._detect_state(token_address)
        
        # Cache state
        await self._cache_state(token_address, state)
        self.token_states[token_address] = state
        
        return state
    
    async def _detect_state(self, token_address: str) -> TokenState:
        """Detect token state by checking Pump.fun API"""
        if not self._session:
            return TokenState.UNKNOWN
        
        try:
            # Fetch from Pump.fun API
            url = f"https://frontend-api.pump.fun/coins/{token_address}"
            
            async with self._session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    # Check if token has graduated (has raydium_pool)
                    raydium_pool = data.get("raydium_pool")
                    complete = data.get("complete", False)
                    
                    if raydium_pool and complete:
                        return TokenState.RAYDIUM
                    elif data.get("associated_bonding_curve"):
                        # On bonding curve
                        return TokenState.PUMP_FUN
                    else:
                        return TokenState.UNKNOWN
                else:
                    # Not found in Pump.fun, assume Raydium or unknown
                    return TokenState.UNKNOWN
        
        except Exception as e:
            logger.debug(f"Failed to detect state for {token_address}: {e}")
            return TokenState.UNKNOWN
    
    async def calculate_bonding_curve_price(
        self,
        token_address: str,
        sol_price_usd: float = 150.0
    ) -> Optional[float]:
        """
        Calculate price from bonding curve formula.
        
        Formula: price = (virtual_sol_reserves / virtual_token_reserves) * sol_price
        """
        # Fetch bonding curve info
        curve_info = await self._fetch_bonding_curve_info(token_address)
        
        if not curve_info:
            return None
        
        if curve_info.virtual_token_reserves == 0:
            return None
        
        # Calculate price in SOL
        price_sol = curve_info.virtual_sol_reserves / curve_info.virtual_token_reserves
        
        # Convert to USD
        price_usd = price_sol * sol_price_usd
        
        return price_usd
    
    async def _fetch_bonding_curve_info(self, token_address: str) -> Optional[BondingCurveInfo]:
        """Fetch bonding curve information from Pump.fun API"""
        if not self._session:
            return None
        
        try:
            url = f"https://frontend-api.pump.fun/coins/{token_address}"
            
            async with self._session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    return None
                
                data = await resp.json()
                
                bonding_curve = data.get("associated_bonding_curve")
                if not bonding_curve:
                    return None
                
                return BondingCurveInfo(
                    token_address=token_address,
                    bonding_curve_address=bonding_curve,
                    virtual_sol_reserves=data.get("virtual_sol_reserves", 0),
                    virtual_token_reserves=data.get("virtual_token_reserves", 0),
                    total_supply=int(data.get("total_supply", 0)),
                    market_cap=data.get("usd_market_cap", 0),
                    is_complete=data.get("complete", False)
                )
        
        except Exception as e:
            logger.error(f"Failed to fetch bonding curve info: {e}")
            return None
    
    async def check_graduation(self, token_address: str) -> Optional[TokenStateUpdate]:
        """
        Check if token has graduated from Pump.fun to Raydium.
        
        Returns TokenStateUpdate if graduation detected, None otherwise.
        """
        current_state = self.token_states.get(token_address, TokenState.UNKNOWN)
        
        if current_state == TokenState.RAYDIUM:
            return None  # Already graduated
        
        # Check current state
        new_state = await self._detect_state(token_address)
        
        if new_state == TokenState.RAYDIUM and current_state == TokenState.PUMP_FUN:
            # Graduation detected!
            update = TokenStateUpdate(
                token_address=token_address,
                old_state=current_state,
                new_state=new_state,
                timestamp=int(time.time() * 1000)
            )
            
            # Fetch Raydium pool address
            curve_info = await self._fetch_bonding_curve_info(token_address)
            if curve_info and self._session:
                try:
                    url = f"https://frontend-api.pump.fun/coins/{token_address}"
                    async with self._session.get(url) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            update.raydium_pool_address = data.get("raydium_pool")
                except Exception:
                    pass
            
            # Update state
            self.token_states[token_address] = new_state
            await self._cache_state(token_address, new_state)
            
            # Notify callbacks
            for callback in self._callbacks:
                try:
                    callback(update)
                except Exception as e:
                    logger.error(f"Graduation callback error: {e}")
            
            # Publish via WebSocket
            await self._publish_graduation(update)
            
            logger.info(f"Graduation detected: {token_address} -> Raydium")
            return update
        
        return None
    
    async def _cache_state(self, token_address: str, state: TokenState):
        """Cache token state in Redis"""
        if not self.redis or not self.redis.redis:
            return
        
        key = token_state_key(token_address)
        
        try:
            # Cache with 5 minute TTL (state doesn't change often)
            await self.redis.redis.setex(key, 300, state.value)
        except Exception as e:
            logger.error(f"Failed to cache token state: {e}")
    
    async def _get_cached_state(self, token_address: str) -> Optional[TokenState]:
        """Get cached token state"""
        if not self.redis or not self.redis.redis:
            return None
        
        key = token_state_key(token_address)
        
        try:
            state_str = await self.redis.redis.get(key)
            if state_str:
                return TokenState(state_str)
        except Exception as e:
            logger.debug(f"Failed to get cached state: {e}")
        
        return None
    
    async def _publish_graduation(self, update: TokenStateUpdate):
        """Publish graduation event via Redis pub/sub"""
        if not self.redis:
            return
        
        from services.redis_schemas import migration_pubsub_key
        channel = migration_pubsub_key()
        
        message = {
            "type": "graduation",
            "token": update.token_address,
            "old_state": update.old_state.value,
            "new_state": update.new_state.value,
            "raydium_pool": update.raydium_pool_address,
            "timestamp": update.timestamp
        }
        
        await self.redis.publish_raw(channel, message)
    
    def on_graduation(self, callback: Callable[[TokenStateUpdate], None]):
        """Register callback for graduation events"""
        self._callbacks.append(callback)


# Add to redis_schemas
def token_state_key(token_address: str) -> str:
    """Cache key for token state"""
    return f"token_state:{token_address}"


# Singleton instance
_pump_fun_tracker: Optional[PumpFunTracker] = None


async def get_pump_fun_tracker() -> PumpFunTracker:
    """Get or create the Pump.fun tracker singleton"""
    global _pump_fun_tracker
    
    if _pump_fun_tracker is None:
        redis = await get_redis_service()
        _pump_fun_tracker = PumpFunTracker(redis)
        await _pump_fun_tracker.start()
    
    return _pump_fun_tracker
