"""
Raydium Liquidity Tracker

Tracks liquidity migration from Pump.fun to Raydium and monitors pool health.

Features:
- Liquidity tracking from Raydium API
- Pool health metrics calculation
- Migration event detection
- Low liquidity alerts
"""

import asyncio
import logging
import time
from typing import Dict, Optional, Callable
from dataclasses import dataclass

import aiohttp

from services.redis_service import RedisService, get_redis_service

logger = logging.getLogger(__name__)


@dataclass
class PoolHealth:
    """Raydium pool health metrics"""
    pool_address: str
    token_address: str
    sol_reserves: float
    token_reserves: float
    total_liquidity_usd: float
    liquidity_depth_usd: float  # Liquidity for $1K swap
    price_impact_1k: float  # Price impact for $1K swap (%)
    is_healthy: bool  # True if liquidity > $10K
    timestamp: int


@dataclass
class MigrationEvent:
    """Liquidity migration event"""
    token_address: str
    raydium_pool_address: str
    initial_liquidity_sol: float
    initial_liquidity_token: float
    initial_liquidity_usd: float
    migration_tx_signature: str
    timestamp: int


class RaydiumTracker:
    """
    Tracks Raydium pool liquidity and health.
    
    Features:
    - Fetch pool state from Raydium API
    - Calculate pool health metrics
    - Detect migration events
    - Alert on low liquidity
    """
    
    RAYDIUM_API_BASE = "https://api.raydium.io/v2"
    LOW_LIQUIDITY_THRESHOLD_USD = 10_000  # Alert if liquidity < $10K
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self.pool_cache: Dict[str, PoolHealth] = {}  # pool_address -> health
        self.migration_events: Dict[str, MigrationEvent] = {}  # token -> migration
        self._callbacks: list[Callable[[PoolHealth], None]] = []
        self._session: Optional[aiohttp.ClientSession] = None
        self._running = False
        self.sol_price_usd = 150.0  # Default, should be updated
    
    async def start(self):
        """Start the tracker"""
        self._running = True
        self._session = aiohttp.ClientSession()
        logger.info("RaydiumTracker started")
    
    async def stop(self):
        """Stop the tracker"""
        self._running = False
        if self._session:
            await self._session.close()
        logger.info("RaydiumTracker stopped")
    
    async def track_pool(self, pool_address: str, token_address: str):
        """Start tracking a Raydium pool"""
        # Fetch initial pool state
        health = await self._fetch_pool_health(pool_address, token_address)
        if health:
            self.pool_cache[pool_address] = health
            
            # Check if this is a new migration
            if token_address not in self.migration_events:
                await self._detect_migration(token_address, pool_address, health)
            
            # Alert if low liquidity
            if not health.is_healthy:
                logger.warning(f"Low liquidity detected for {token_address}: ${health.total_liquidity_usd:.2f}")
        
        logger.info(f"Tracking Raydium pool: {pool_address} for token: {token_address}")
    
    async def _fetch_pool_health(self, pool_address: str, token_address: str) -> Optional[PoolHealth]:
        """Fetch pool health from Raydium API"""
        if not self._session:
            return None
        
        try:
            # Fetch pool info from Raydium API
            url = f"{self.RAYDIUM_API_BASE}/ammPools"
            params = {"poolAddress": pool_address}
            
            async with self._session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    # Fallback: try to get from pool address directly
                    return await self._fetch_pool_from_address(pool_address, token_address)
                
                data = await resp.json()
                pools = data.get("data", [])
                
                if not pools:
                    return None
                
                pool_data = pools[0]
                
                # Extract reserves
                coin_a = pool_data.get("coinA", {})
                coin_b = pool_data.get("coinB", {})
                
                # Determine which is SOL and which is token
                sol_reserves = 0
                token_reserves = 0
                
                if coin_a.get("mint") == "So11111111111111111111111111111111111111112":  # SOL
                    sol_reserves = float(coin_a.get("amount", 0)) / 1e9
                    token_reserves = float(coin_b.get("amount", 0)) / (10 ** coin_b.get("decimals", 9))
                elif coin_b.get("mint") == "So11111111111111111111111111111111111111112":
                    sol_reserves = float(coin_b.get("amount", 0)) / 1e9
                    token_reserves = float(coin_a.get("amount", 0)) / (10 ** coin_a.get("decimals", 9))
                
                # Calculate metrics
                total_liquidity_usd = (sol_reserves * 2) * self.sol_price_usd  # Total SOL * 2 (both sides)
                
                # Estimate price impact for $1K swap (simplified)
                price_impact_1k = self._estimate_price_impact(sol_reserves, token_reserves, 1000 / self.sol_price_usd)
                
                # Liquidity depth (how much liquidity available for $1K swap)
                liquidity_depth_usd = total_liquidity_usd if total_liquidity_usd > 1000 else total_liquidity_usd
                
                is_healthy = total_liquidity_usd >= self.LOW_LIQUIDITY_THRESHOLD_USD
                
                health = PoolHealth(
                    pool_address=pool_address,
                    token_address=token_address,
                    sol_reserves=sol_reserves,
                    token_reserves=token_reserves,
                    total_liquidity_usd=total_liquidity_usd,
                    liquidity_depth_usd=liquidity_depth_usd,
                    price_impact_1k=price_impact_1k,
                    is_healthy=is_healthy,
                    timestamp=int(time.time() * 1000)
                )
                
                return health
        
        except Exception as e:
            logger.error(f"Failed to fetch pool health: {e}")
            return None
    
    async def _fetch_pool_from_address(self, pool_address: str, token_address: str) -> Optional[PoolHealth]:
        """Fallback: fetch pool data from on-chain"""
        # This would require Solana RPC calls to fetch pool account data
        # For now, return None (would need to implement)
        return None
    
    def _estimate_price_impact(self, sol_reserves: float, token_reserves: float, swap_amount_sol: float) -> float:
        """
        Estimate price impact for a swap using constant product formula.
        
        Simplified: impact = (swap_amount / reserves) * 100
        """
        if sol_reserves == 0:
            return 100.0  # 100% impact if no liquidity
        
        # Constant product: k = sol_reserves * token_reserves
        # After swap: (sol_reserves + swap_amount) * (token_reserves - output) = k
        # Price impact = (swap_amount / sol_reserves) * 100
        
        impact = (swap_amount_sol / sol_reserves) * 100
        return min(impact, 100.0)  # Cap at 100%
    
    async def _detect_migration(self, token_address: str, pool_address: str, health: PoolHealth):
        """Detect if this is a new migration event"""
        if token_address in self.migration_events:
            return  # Already tracked
        
        # Create migration event
        migration = MigrationEvent(
            token_address=token_address,
            raydium_pool_address=pool_address,
            initial_liquidity_sol=health.sol_reserves,
            initial_liquidity_token=health.token_reserves,
            initial_liquidity_usd=health.total_liquidity_usd,
            migration_tx_signature="",  # Would need to track from transaction
            timestamp=health.timestamp
        )
        
        self.migration_events[token_address] = migration
        
        # Publish migration event
        await self._publish_migration(migration)
        
        logger.info(f"Migration detected: {token_address} -> Raydium pool {pool_address}")
    
    async def _publish_migration(self, migration: MigrationEvent):
        """Publish migration event via Redis"""
        if not self.redis:
            return
        
        from services.redis_schemas import migration_pubsub_key
        channel = migration_pubsub_key()
        
        import json
        message = {
            "type": "migration",
            "token": migration.token_address,
            "raydium_pool": migration.raydium_pool_address,
            "initial_liquidity_sol": migration.initial_liquidity_sol,
            "initial_liquidity_token": migration.initial_liquidity_token,
            "initial_liquidity_usd": migration.initial_liquidity_usd,
            "timestamp": migration.timestamp
        }
        
        await self.redis.publish_raw(channel, message)
    
    async def get_pool_health(self, pool_address: str) -> Optional[PoolHealth]:
        """Get current pool health"""
        return self.pool_cache.get(pool_address)
    
    def on_pool_health_update(self, callback: Callable[[PoolHealth], None]):
        """Register callback for pool health updates"""
        self._callbacks.append(callback)


# Singleton instance
_raydium_tracker: Optional[RaydiumTracker] = None


async def get_raydium_tracker() -> RaydiumTracker:
    """Get or create the Raydium tracker singleton"""
    global _raydium_tracker
    
    if _raydium_tracker is None:
        redis = await get_redis_service()
        _raydium_tracker = RaydiumTracker(redis)
        await _raydium_tracker.start()
    
    return _raydium_tracker
