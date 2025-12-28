"""
Indicator Precomputation Service

Precomputes technical indicators (RSI, MACD, Volume Profile) server-side
to reduce frontend load and ensure consistent calculations.

Features:
- RSI(14) calculation on market cap candles
- MACD(12, 26, 9) calculation
- Volume Profile tracking
- Caching in Redis
- WebSocket publishing
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Tuple
from collections import deque
from dataclasses import dataclass, asdict

from services.redis_service import RedisService, CandleUpdate, get_redis_service
from services.redis_schemas import (
    indicator_key,
    INDICATOR_TTL_SECONDS,
    rsi_key,
    macd_key,
    volume_profile_key
)

logger = logging.getLogger(__name__)


@dataclass
class RSIValue:
    """RSI indicator value"""
    value: float  # 0-100
    timestamp: int


@dataclass
class MACDValue:
    """MACD indicator values"""
    macd: float
    signal: float
    histogram: float
    timestamp: int


@dataclass
class VolumeProfile:
    """Volume at different price levels"""
    price_levels: Dict[float, float]  # price -> volume
    timestamp: int


class IndicatorPrecomputer:
    """
    Precomputes technical indicators for market cap candles.
    
    Indicators computed:
    - RSI(14) - Relative Strength Index
    - MACD(12, 26, 9) - Moving Average Convergence Divergence
    - Volume Profile - Volume distribution by price level
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        
        # Store recent candles for indicator calculation
        self.candle_history: Dict[str, Dict[str, deque]] = {}  # token -> timeframe -> deque of candles
        
        # Indicator parameters
        self.RSI_PERIOD = 14
        self.MACD_FAST = 12
        self.MACD_SLOW = 26
        self.MACD_SIGNAL = 9
    
    async def process_candle(
        self,
        token_address: str,
        timeframe: str,
        candle: CandleUpdate
    ):
        """
        Process a closed candle and compute indicators.
        
        Only computes indicators when candle is closed (is_closed=True).
        """
        if not candle.is_closed:
            return
        
        # Initialize history if needed
        key = f"{token_address}:{timeframe}"
        if key not in self.candle_history:
            self.candle_history[key] = deque(maxlen=100)  # Keep last 100 candles
        
        # Add candle to history
        self.candle_history[key].append(candle)
        
        # Compute indicators
        await self._compute_rsi(token_address, timeframe, candle)
        await self._compute_macd(token_address, timeframe, candle)
        await self._update_volume_profile(token_address, timeframe, candle)
    
    async def _compute_rsi(
        self,
        token_address: str,
        timeframe: str,
        candle: CandleUpdate
    ):
        """Compute RSI(14) indicator"""
        key = f"{token_address}:{timeframe}"
        history = self.candle_history.get(key, deque())
        
        if len(history) < self.RSI_PERIOD + 1:
            return  # Not enough data
        
        # Extract closes for RSI calculation
        closes = [c.close for c in list(history)[-self.RSI_PERIOD-1:]]
        
        # Calculate gains and losses
        gains = []
        losses = []
        
        for i in range(1, len(closes)):
            change = closes[i] - closes[i-1]
            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(change))
        
        # Calculate average gain and loss
        avg_gain = sum(gains) / len(gains) if gains else 0
        avg_loss = sum(losses) / len(losses) if losses else 0
        
        # Calculate RSI
        if avg_loss == 0:
            rsi = 100.0
        else:
            rs = avg_gain / avg_loss if avg_loss > 0 else 0
            rsi = 100 - (100 / (1 + rs))
        
        # Cache RSI value
        rsi_data = RSIValue(value=rsi, timestamp=candle.time)
        await self._cache_rsi(token_address, timeframe, rsi_data)
        
        # Publish via WebSocket
        await self._publish_indicator(
            token_address,
            timeframe,
            "rsi",
            {"value": rsi, "timestamp": candle.time}
        )
        
        logger.debug(f"RSI({self.RSI_PERIOD}) for {token_address}:{timeframe} = {rsi:.2f}")
    
    async def _compute_macd(
        self,
        token_address: str,
        timeframe: str,
        candle: CandleUpdate
    ):
        """Compute MACD(12, 26, 9) indicator"""
        key = f"{token_address}:{timeframe}"
        history = self.candle_history.get(key, deque())
        
        if len(history) < self.MACD_SLOW + self.MACD_SIGNAL:
            return  # Not enough data
        
        # Extract closes
        closes = [c.close for c in list(history)]
        
        # Calculate EMA(12) and EMA(26)
        ema_fast = self._calculate_ema(closes, self.MACD_FAST)
        ema_slow = self._calculate_ema(closes, self.MACD_SLOW)
        
        if ema_fast is None or ema_slow is None:
            return
        
        # MACD line = EMA(12) - EMA(26)
        macd_line = ema_fast - ema_slow
        
        # Calculate signal line (EMA of MACD line)
        # For simplicity, use recent MACD values
        macd_values = []
        for i in range(max(0, len(closes) - self.MACD_SIGNAL), len(closes)):
            fast_ema = self._calculate_ema(closes[:i+1], self.MACD_FAST)
            slow_ema = self._calculate_ema(closes[:i+1], self.MACD_SLOW)
            if fast_ema and slow_ema:
                macd_values.append(fast_ema - slow_ema)
        
        if len(macd_values) < self.MACD_SIGNAL:
            return
        
        signal_line = self._calculate_ema(macd_values, self.MACD_SIGNAL)
        if signal_line is None:
            return
        
        # Histogram = MACD - Signal
        histogram = macd_line - signal_line
        
        # Cache MACD values
        macd_data = MACDValue(
            macd=macd_line,
            signal=signal_line,
            histogram=histogram,
            timestamp=candle.time
        )
        await self._cache_macd(token_address, timeframe, macd_data)
        
        # Publish via WebSocket
        await self._publish_indicator(
            token_address,
            timeframe,
            "macd",
            {
                "macd": macd_line,
                "signal": signal_line,
                "histogram": histogram,
                "timestamp": candle.time
            }
        )
        
        logger.debug(
            f"MACD for {token_address}:{timeframe} = "
            f"MACD:{macd_line:.2f}, Signal:{signal_line:.2f}, Hist:{histogram:.2f}"
        )
    
    async def _update_volume_profile(
        self,
        token_address: str,
        timeframe: str,
        candle: CandleUpdate
    ):
        """Update volume profile (volume at each price level)"""
        # For volume profile, we track volume at different price levels
        # Price levels are rounded to nearest $100 for market cap
        
        # Round price to nearest $100
        price_level = round(candle.close / 100) * 100
        
        # Get existing volume profile
        profile_key = volume_profile_key(token_address, timeframe)
        if not self.redis or not self.redis.redis:
            return
        
        try:
            import json
            existing_data = await self.redis.redis.get(profile_key)
            
            if existing_data:
                profile = json.loads(existing_data)
                price_levels = profile.get("price_levels", {})
            else:
                price_levels = {}
            
            # Add volume to this price level
            price_levels[str(price_level)] = price_levels.get(str(price_level), 0) + candle.volume
            
            # Keep only last 50 price levels (to prevent unbounded growth)
            if len(price_levels) > 50:
                # Remove oldest levels (simplified: remove lowest)
                sorted_levels = sorted(price_levels.items(), key=lambda x: float(x[0]))
                price_levels = dict(sorted_levels[-50:])
            
            # Cache updated profile
            profile_data = {
                "price_levels": price_levels,
                "timestamp": candle.time
            }
            
            await self.redis.redis.setex(
                profile_key,
                INDICATOR_TTL_SECONDS,
                json.dumps(profile_data)
            )
            
        except Exception as e:
            logger.error(f"Failed to update volume profile: {e}")
    
    def _calculate_ema(self, values: List[float], period: int) -> Optional[float]:
        """Calculate Exponential Moving Average"""
        if len(values) < period:
            return None
    
        # Use simple moving average as initial value
        sma = sum(values[-period:]) / period
        
        # Calculate multiplier
        multiplier = 2 / (period + 1)
        
        # Calculate EMA
        ema = sma
        for value in values[-period:]:
            ema = (value * multiplier) + (ema * (1 - multiplier))
        
        return ema
    
    async def _cache_rsi(self, token_address: str, timeframe: str, rsi: RSIValue):
        """Cache RSI value in Redis"""
        if not self.redis or not self.redis.redis:
            return
        
        import json
        key = rsi_key(token_address, timeframe)
        
        try:
            await self.redis.redis.setex(
                key,
                INDICATOR_TTL_SECONDS,
                json.dumps(asdict(rsi))
            )
        except Exception as e:
            logger.error(f"Failed to cache RSI: {e}")
    
    async def _cache_macd(self, token_address: str, timeframe: str, macd: MACDValue):
        """Cache MACD values in Redis"""
        if not self.redis or not self.redis.redis:
            return
        
        import json
        key = macd_key(token_address, timeframe)
        
        try:
            await self.redis.redis.setex(
                key,
                INDICATOR_TTL_SECONDS,
                json.dumps(asdict(macd))
            )
        except Exception as e:
            logger.error(f"Failed to cache MACD: {e}")
    
    async def _publish_indicator(
        self,
        token_address: str,
        timeframe: str,
        indicator_name: str,
        data: Dict
    ):
        """Publish indicator update via Redis pub/sub"""
        if not self.redis:
            return
        
        channel = f"indicators:{token_address}:{timeframe}"
        
        message = {
            "type": indicator_name,
            "token": token_address,
            "timeframe": timeframe,
            "data": data,
            "timestamp": int(time.time() * 1000)
        }
        
        await self.redis.publish_raw(channel, message)


# Add helper functions to redis_schemas
def rsi_key(token_address: str, timeframe: str) -> str:
    """Cache key for RSI value"""
    return f"rsi:{token_address}:{timeframe}"


def macd_key(token_address: str, timeframe: str) -> str:
    """Cache key for MACD values"""
    return f"macd:{token_address}:{timeframe}"


def volume_profile_key(token_address: str, timeframe: str) -> str:
    """Cache key for volume profile"""
    return f"volume_profile:{token_address}:{timeframe}"


# Singleton instance
_indicator_precomputer: Optional[IndicatorPrecomputer] = None


async def get_indicator_precomputer() -> IndicatorPrecomputer:
    """Get or create the indicator precomputer singleton"""
    global _indicator_precomputer
    
    if _indicator_precomputer is None:
        redis = await get_redis_service()
        _indicator_precomputer = IndicatorPrecomputer(redis)
    
    return _indicator_precomputer
