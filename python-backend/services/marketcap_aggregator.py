"""
Market Cap OHLCV Aggregator

Converts raw swap events into market-cap-first OHLCV candles.
This is the core logic that makes charts display market cap like Axiom.trade.

Key insight: Axiom charts market cap, not price.
market_cap = price_usd * circulating_supply
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict

from services.redis_service import RedisService, SwapEvent, CandleUpdate, get_redis_service

logger = logging.getLogger(__name__)

# Lazy import to avoid circular dependency
_indicator_precomputer = None


@dataclass
class AggregatorConfig:
    """Configuration for the aggregator"""
    timeframe_ms: int = 60_000  # 1 minute default
    max_candles_in_memory: int = 500
    gap_fill_enabled: bool = True


class MarketCapAggregator:
    """
    Converts raw swap events into market-cap OHLCV candles.
    
    Algorithm:
    1. On each swap, calculate: new_mc = swap_price_usd * token_supply
    2. Update current candle: high = max(high, new_mc), low = min(low, new_mc), close = new_mc
    3. On timeframe boundary, close candle and start new one
    4. Publish incremental updates (NOT full refetch)
    
    Thread-safe for concurrent swap processing.
    """
    
    def __init__(
        self,
        token_address: str,
        supply: int,
        timeframe_ms: int,
        redis_service: RedisService,
    ):
        self.token_address = token_address
        self.supply = supply
        self.timeframe_ms = timeframe_ms
        self.redis = redis_service
        
        self.current_candle: Optional[Dict] = None
        self.completed_candles: List[Dict] = []
        self.last_price_usd: float = 0
        self.last_market_cap: float = 0
        
        self._candle_callbacks: List[Callable[[CandleUpdate], None]] = []
        self._close_callbacks: List[Callable[[CandleUpdate], None]] = []
        self._lock = asyncio.Lock()
    
    def _get_candle_start_time(self, timestamp_ms: int) -> int:
        """Get the start time of the candle containing this timestamp"""
        return (timestamp_ms // self.timeframe_ms) * self.timeframe_ms
    
    def _create_candle(self, market_cap: float, volume_usd: float, timestamp_ms: int) -> Dict:
        """Create a new candle"""
        candle_start_ms = self._get_candle_start_time(timestamp_ms)
        
        return {
            "time": candle_start_ms // 1000,  # Seconds for chart library
            "time_ms": candle_start_ms,
            "open": market_cap,
            "high": market_cap,
            "low": market_cap,
            "close": market_cap,
            "volume": volume_usd,
            "trades": 1,
            "is_closed": False,
        }
    
    async def process_swap(self, swap: SwapEvent) -> Optional[CandleUpdate]:
        """
        Process a swap event and update/create candles.
        
        CRITICAL: This aggregator tracks MARKET CAP, not price.
        market_cap = price_usd * token_supply
        
        Returns the updated candle with market cap values.
        """
        async with self._lock:
            # Calculate market cap from swap price
            if swap.price_usd <= 0:
                return None
            
            # Calculate market cap: price * supply
            market_cap = swap.price_usd * self.supply
            volume_usd = swap.amount_sol * 150  # Approximate SOL price
            
            # Use swap's market_cap_usd if provided and valid (pre-calculated)
            if swap.market_cap_usd > 0:
                market_cap = swap.market_cap_usd
            else:
                # Recalculate to ensure accuracy
                market_cap = swap.price_usd * self.supply
            
            self.last_price_usd = swap.price_usd
            self.last_market_cap = market_cap
            
            candle_start_ms = self._get_candle_start_time(swap.timestamp)
            
            # Check if we need to close current candle and start new one
            if self.current_candle is not None:
                current_candle_end_ms = self.current_candle["time_ms"] + self.timeframe_ms
                
                if swap.timestamp >= current_candle_end_ms:
                    # Close the current candle
                    await self._close_current_candle()
                    
                    # Fill any gaps with empty candles
                    if self.completed_candles:
                        gap_start_ms = self.current_candle["time_ms"] + self.timeframe_ms if self.current_candle else candle_start_ms
                        await self._fill_gaps(gap_start_ms, candle_start_ms)
                    
                    # Start new candle
                    self.current_candle = self._create_candle(market_cap, volume_usd, swap.timestamp)
                else:
                    # Update existing candle
                    self.current_candle["high"] = max(self.current_candle["high"], market_cap)
                    self.current_candle["low"] = min(self.current_candle["low"], market_cap)
                    self.current_candle["close"] = market_cap
                    self.current_candle["volume"] += volume_usd
                    self.current_candle["trades"] += 1
            else:
                # First swap - create new candle
                self.current_candle = self._create_candle(market_cap, volume_usd, swap.timestamp)
            
            # Create CandleUpdate
            candle_update = CandleUpdate(
                time=self.current_candle["time"],
                open=self.current_candle["open"],
                high=self.current_candle["high"],
                low=self.current_candle["low"],
                close=self.current_candle["close"],
                volume=self.current_candle["volume"],
                trades=self.current_candle["trades"],
                is_closed=False,
            )
            
            # Notify callbacks
            for callback in self._candle_callbacks:
                try:
                    callback(candle_update)
                except Exception as e:
                    logger.error(f"Candle callback error: {e}")
            
            # Publish to Redis
            timeframe_str = self._timeframe_to_string()
            await self.redis.publish_candle(self.token_address, timeframe_str, candle_update)
            
            return candle_update
    
    async def _close_current_candle(self):
        """Close the current candle and add to completed list"""
        if self.current_candle is None or self.current_candle["is_closed"]:
            return
        
        self.current_candle["is_closed"] = True
        self.completed_candles.append(self.current_candle.copy())
        
        # Trim completed candles if over limit
        if len(self.completed_candles) > 500:
            self.completed_candles = self.completed_candles[-500:]
        
        # Create CandleUpdate for the closed candle
        candle_update = CandleUpdate(
            time=self.current_candle["time"],
            open=self.current_candle["open"],
            high=self.current_candle["high"],
            low=self.current_candle["low"],
            close=self.current_candle["close"],
            volume=self.current_candle["volume"],
            trades=self.current_candle["trades"],
            is_closed=True,
        )
        
        # Notify close callbacks
        for callback in self._close_callbacks:
            try:
                callback(candle_update)
            except Exception as e:
                logger.error(f"Close callback error: {e}")
        
        # Publish closed candle to Redis
        timeframe_str = self._timeframe_to_string()
        await self.redis.publish_candle(self.token_address, timeframe_str, candle_update)
        
        # Precompute indicators for closed candle
        try:
            from services.indicator_precompute import get_indicator_precomputer
            precomputer = await get_indicator_precomputer()
            await precomputer.process_candle(
                self.token_address,
                timeframe_str,
                candle_update
            )
        except Exception as e:
            logger.debug(f"Failed to precompute indicators: {e}")
    
    async def _fill_gaps(self, start_ms: int, end_ms: int):
        """Fill gaps with empty candles using last close price"""
        if not self.completed_candles:
            return
        
        last_close = self.completed_candles[-1]["close"]
        current_ms = start_ms
        
        while current_ms < end_ms:
            gap_candle = {
                "time": current_ms // 1000,
                "time_ms": current_ms,
                "open": last_close,
                "high": last_close,
                "low": last_close,
                "close": last_close,
                "volume": 0,
                "trades": 0,
                "is_closed": True,
            }
            self.completed_candles.append(gap_candle)
            current_ms += self.timeframe_ms
        
        # Trim if needed
        if len(self.completed_candles) > 500:
            self.completed_candles = self.completed_candles[-500:]
    
    def _timeframe_to_string(self) -> str:
        """Convert timeframe_ms to string representation"""
        minutes = self.timeframe_ms // 60_000
        
        if minutes < 60:
            return f"{minutes}m"
        
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h"
        
        days = hours // 24
        return f"{days}d"
    
    def get_all_candles(self) -> List[Dict]:
        """Get all candles (completed + current)"""
        result = self.completed_candles.copy()
        
        if self.current_candle:
            result.append(self.current_candle.copy())
        
        return result
    
    def get_current_candle(self) -> Optional[Dict]:
        """Get the current in-progress candle"""
        return self.current_candle.copy() if self.current_candle else None
    
    def get_completed_candles(self) -> List[Dict]:
        """Get completed candles only"""
        return self.completed_candles.copy()
    
    def on_candle_update(self, callback: Callable[[CandleUpdate], None]):
        """Register callback for candle updates"""
        self._candle_callbacks.append(callback)
    
    def on_candle_close(self, callback: Callable[[CandleUpdate], None]):
        """Register callback for candle close events"""
        self._close_callbacks.append(callback)
    
    def set_supply(self, supply: int):
        """Update token supply (for accurate market cap calculation)"""
        old_supply = self.supply
        self.supply = supply
        
        # Recalculate market cap for current candle if supply changed
        if old_supply != supply and self.current_candle and self.last_price_usd > 0:
            # Recalculate market cap with new supply
            new_market_cap = self.last_price_usd * supply
            
            # Update current candle values proportionally
            supply_ratio = supply / old_supply if old_supply > 0 else 1.0
            self.current_candle["open"] *= supply_ratio
            self.current_candle["high"] *= supply_ratio
            self.current_candle["low"] *= supply_ratio
            self.current_candle["close"] = new_market_cap
            self.last_market_cap = new_market_cap
            
            logger.info(
                f"Updated market cap for {self.token_address} due to supply change: "
                f"{old_supply} -> {supply} (ratio: {supply_ratio:.6f})"
            )
    
            # Publish supply change update
            asyncio.create_task(self._publish_supply_change_update(old_supply, supply))
    
    async def _publish_supply_change_update(self, old_supply: int, new_supply: int):
        """Publish supply change update via WebSocket"""
        if not self.redis:
            return
        
        # Publish supply change event
        await self.redis.publish_raw(
            f"supply_change:{self.token_address}",
            {
                "token": self.token_address,
                "old_supply": old_supply,
                "new_supply": new_supply,
                "old_market_cap": self.last_price_usd * old_supply if self.last_price_usd > 0 else 0,
                "new_market_cap": self.last_market_cap,
                "timestamp": int(time.time() * 1000)
            }
        )
    
    def reset(self):
        """Reset aggregator state"""
        self.current_candle = None
        self.completed_candles = []
        self.last_price_usd = 0
        self.last_market_cap = 0
    
    def to_chart_format(self) -> List[Dict]:
        """Convert candles to chart-friendly format"""
        candles = self.get_all_candles()
        
        return [
            {
                "time": candle["time"],
                "open": candle["open"],
                "high": candle["high"],
                "low": candle["low"],
                "close": candle["close"],
                "volume": candle["volume"],
            }
            for candle in candles
        ]


class MultiTokenAggregator:
    """
    Manages multiple MarketCapAggregator instances for different tokens.
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self.aggregators: Dict[str, Dict[int, MarketCapAggregator]] = defaultdict(dict)
        self.token_supplies: Dict[str, int] = {}
        self._supply_tracker = None
    
    async def initialize_supply_tracking(self):
        """Initialize supply tracking for all tracked tokens"""
        try:
            from services.supply_tracker import get_supply_tracker
            self._supply_tracker = await get_supply_tracker()
            
            # Register callback for supply changes
            self._supply_tracker.on_supply_change(self._on_supply_change)
            
            # Track all currently known tokens
            for token_address in self.token_supplies.keys():
                supply = self.token_supplies[token_address]
                await self._supply_tracker.track_token(token_address, supply)
        except Exception as e:
            logger.error(f"Failed to initialize supply tracking: {e}")
    
    def _on_supply_change(self, mutation):
        """Handle supply mutation event"""
        token_address = mutation.token_address
        new_supply = mutation.new_supply
        
        # Update supply cache
        self.token_supplies[token_address] = new_supply
        
        # Update all aggregators for this token
        if token_address in self.aggregators:
            for aggregator in self.aggregators[token_address].values():
                aggregator.set_supply(new_supply)
        
        logger.info(f"Supply changed for {token_address}: {new_supply}")
    
    async def get_or_create_aggregator(
        self,
        token_address: str,
        timeframe_ms: int,
        supply: Optional[int] = None,
    ) -> MarketCapAggregator:
        """Get or create an aggregator for a token/timeframe combination"""
        # Use cached supply if not provided
        if supply is None:
            # Try to get from Redis cache first
            supply = await self._get_cached_supply(token_address)
        if supply is None:
            supply = self.token_supplies.get(token_address, 1_000_000_000)
        else:
            self.token_supplies[token_address] = supply
        
        if timeframe_ms not in self.aggregators[token_address]:
            self.aggregators[token_address][timeframe_ms] = MarketCapAggregator(
                token_address=token_address,
                supply=supply,
                timeframe_ms=timeframe_ms,
                redis_service=self.redis,
            )
            
            # Start tracking supply if tracker is available
            if self._supply_tracker and token_address not in self._supply_tracker.tracked_tokens:
                await self._supply_tracker.track_token(token_address, supply)
        
        return self.aggregators[token_address][timeframe_ms]
    
    async def _get_cached_supply(self, token_address: str) -> Optional[int]:
        """Get cached supply from Redis"""
        if not self.redis or not self.redis.redis:
            return None
        
        from services.redis_schemas import token_supply_key
        key = token_supply_key(token_address)
        try:
            supply_str = await self.redis.redis.get(key)
            if supply_str:
                return int(supply_str)
        except Exception as e:
            logger.debug(f"Failed to get cached supply: {e}")
        
        return None
    
    async def process_swap(self, swap: SwapEvent, timeframes: Optional[List[int]] = None):
        """Process a swap across all relevant timeframes"""
        if timeframes is None:
            timeframes = [60_000, 300_000, 900_000, 3600_000]  # 1m, 5m, 15m, 1h
        
        for tf_ms in timeframes:
            aggregator = await self.get_or_create_aggregator(swap.token_address, tf_ms)
            await aggregator.process_swap(swap)
    
    def get_candles(
        self,
        token_address: str,
        timeframe_ms: int,
    ) -> List[Dict]:
        """Get candles for a specific token/timeframe"""
        if token_address not in self.aggregators:
            return []
        
        if timeframe_ms not in self.aggregators[token_address]:
            return []
        
        return self.aggregators[token_address][timeframe_ms].get_all_candles()
    
    def remove_token(self, token_address: str):
        """Remove all aggregators for a token"""
        if token_address in self.aggregators:
            del self.aggregators[token_address]
        
        if token_address in self.token_supplies:
            del self.token_supplies[token_address]


# Singleton instance
_multi_aggregator: Optional[MultiTokenAggregator] = None


async def get_multi_aggregator() -> MultiTokenAggregator:
    """Get or create the multi-token aggregator singleton"""
    global _multi_aggregator
    
    if _multi_aggregator is None:
        redis = await get_redis_service()
        _multi_aggregator = MultiTokenAggregator(redis)
        # Initialize supply tracking
        await _multi_aggregator.initialize_supply_tracking()
    
    return _multi_aggregator


def timeframe_string_to_ms(timeframe: str) -> int:
    """Convert timeframe string to milliseconds"""
    import re
    
    match = re.match(r"^(\d+)([smhdwM])$", timeframe.lower())
    if not match:
        return 60_000  # Default 1 minute
    
    value = int(match.group(1))
    unit = match.group(2)
    
    multipliers = {
        "s": 1_000,
        "m": 60_000,
        "h": 3_600_000,
        "d": 86_400_000,
        "w": 604_800_000,
    }
    
    return value * multipliers.get(unit, 60_000)



