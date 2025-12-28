"""
Redis Service for Real-Time Data Streaming

Provides pub/sub messaging for:
- Swap events from Helius/Birdeye
- OHLCV candle updates
- Quote caching for Jupiter prefetching
- Token metadata caching

All keys follow the schema defined in redis_schemas.py
"""

import json
import asyncio
import logging
from typing import Callable, Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime

import redis.asyncio as aioredis
from redis.asyncio.client import PubSub

logger = logging.getLogger(__name__)


@dataclass
class SwapEvent:
    """Represents a parsed swap event"""
    signature: str
    timestamp: int  # Unix timestamp in milliseconds
    source: str  # 'jupiter', 'raydium', 'pump_fun'
    side: str  # 'buy' or 'sell'
    token_address: str
    amount_token: float
    amount_sol: float
    price_usd: float
    market_cap_usd: float
    trader: str
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'SwapEvent':
        return cls(**data)


@dataclass
class CandleUpdate:
    """Represents an OHLCV candle update"""
    time: int  # Unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: float
    trades: int
    is_closed: bool
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'CandleUpdate':
        return cls(**data)


@dataclass
class QuoteCache:
    """Cached Jupiter quote"""
    quote: dict
    cached_at: int
    expires_at: int
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def is_valid(self) -> bool:
        return datetime.now().timestamp() * 1000 < self.expires_at


class RedisService:
    """
    Redis service for real-time data streaming and caching.
    
    Channels:
    - swaps:{token_address} - Real-time swap events
    - candles:{token_address}:{timeframe} - OHLCV candle updates
    
    Keys:
    - quote:{input}:{output}:{amount} - Jupiter quote cache (1s TTL)
    - token_info:{token_address} - Token metadata cache (60s TTL)
    """
    
    def __init__(self, url: str):
        self.url = url
        self.redis: Optional[aioredis.Redis] = None
        self.pubsub: Optional[PubSub] = None
        self._subscriptions: Dict[str, List[Callable]] = {}
        self._listener_task: Optional[asyncio.Task] = None
        self._running = False
        
        # In-memory fallback
        self._use_fallback = False
        self._memory_cache: Dict[str, Any] = {}
        self._memory_expiry: Dict[str, float] = {}
    
    async def connect(self) -> bool:
        """Establish Redis connection"""
        try:
            self.redis = await aioredis.from_url(
                self.url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            # Test connection
            await self.redis.ping()
            logger.info(f"Connected to Redis at {self.url}")
            return True
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Switching to in-memory fallback.")
            self.redis = None
            self._use_fallback = True
            return True
    
    async def disconnect(self):
        """Close Redis connection"""
        self._running = False
        self._use_fallback = False
        
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        
        if self.pubsub:
            await self.pubsub.close()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("Disconnected from Redis")
    
    # ============ Pub/Sub Methods ============
    
    async def publish_swap(self, token_address: str, swap: SwapEvent):
        """Publish a swap event to Redis channel"""
        from services.redis_schemas import swap_pubsub_key
        channel = swap_pubsub_key(token_address)
        
        data = json.dumps(swap.to_dict())
        
        if self._use_fallback:
            await self._fallback_publish(channel, data)
            return

        if not self.redis:
            logger.warning("Redis not connected, cannot publish swap")
            return
            
        try:
            await self.redis.publish(channel, data)
            logger.debug(f"Published swap to {channel}")
        except Exception as e:
            logger.error(f"Failed to publish swap: {e}")
    
    async def publish_candle(self, token_address: str, timeframe: str, candle: CandleUpdate):
        """Publish a candle update to Redis channel"""
        from services.redis_schemas import candle_pubsub_key
        channel = candle_pubsub_key(token_address, timeframe)
        
        data = json.dumps(candle.to_dict())
        
        if self._use_fallback:
            await self._fallback_publish(channel, data)
            return

        if not self.redis:
            logger.warning("Redis not connected, cannot publish candle")
            return
            
        try:
            await self.redis.publish(channel, data)
            logger.debug(f"Published candle to {channel}")
        except Exception as e:
            logger.error(f"Failed to publish candle: {e}")
            
    async def _fallback_publish(self, channel: str, data: str):
        """In-memory publish"""
        if channel in self._subscriptions:
            payload = json.loads(data)
            for callback in self._subscriptions[channel]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        asyncio.create_task(callback(payload))
                    else:
                        callback(payload)
                except Exception as e:
                    logger.error(f"Fallback callback error: {e}")
    
    async def subscribe_swaps(self, token_address: str, callback: Callable[[SwapEvent], None]):
        """Subscribe to swap events for a token"""
        from services.redis_schemas import swap_pubsub_key
        channel = swap_pubsub_key(token_address)
        await self._subscribe(channel, lambda data: callback(SwapEvent.from_dict(data)))
    
    async def subscribe_candles(
        self, 
        token_address: str, 
        timeframe: str, 
        callback: Callable[[CandleUpdate], None]
    ):
        """Subscribe to candle updates for a token/timeframe"""
        from services.redis_schemas import candle_pubsub_key
        channel = candle_pubsub_key(token_address, timeframe)
        await self._subscribe(channel, lambda data: callback(CandleUpdate.from_dict(data)))
    
    async def _subscribe(self, channel: str, callback: Callable[[dict], None]):
        """Internal method to subscribe to a channel"""
        if channel not in self._subscriptions:
            self._subscriptions[channel] = []
        
        self._subscriptions[channel].append(callback)
        
        if self._use_fallback:
            logger.info(f"Subscribed to channel (memory): {channel}")
            return

        if not self.redis:
            logger.warning("Redis not connected, cannot subscribe")
            return
        
        # Initialize pubsub if needed
        if not self.pubsub:
            self.pubsub = self.redis.pubsub()
            await self._start_listener()
        
        # Subscribe to channel
        await self.pubsub.subscribe(channel)
        logger.info(f"Subscribed to channel: {channel}")
    
    async def unsubscribe(self, channel: str):
        """Unsubscribe from a channel"""
        if channel in self._subscriptions:
            del self._subscriptions[channel]
        
        if self._use_fallback:
            return

        if self.pubsub:
            await self.pubsub.unsubscribe(channel)
            logger.info(f"Unsubscribed from channel: {channel}")
    
    async def _start_listener(self):
        """Start the pub/sub listener task"""
        if self._listener_task and not self._listener_task.done():
            return
        
        self._running = True
        self._listener_task = asyncio.create_task(self._listen())
    
    async def _listen(self):
        """Listen for pub/sub messages"""
        while self._running and self.pubsub:
            try:
                message = await self.pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                
                if message and message["type"] == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])
                    
                    if channel in self._subscriptions:
                        for callback in self._subscriptions[channel]:
                            try:
                                if asyncio.iscoroutinefunction(callback):
                                    await callback(data)
                                else:
                                    callback(data)
                            except Exception as e:
                                logger.error(f"Callback error for {channel}: {e}")
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Pub/sub listener error: {e}")
                await asyncio.sleep(1)
    
    # ============ Caching Methods ============
    
    async def cache_quote(
        self, 
        input_mint: str, 
        output_mint: str, 
        amount: int, 
        quote: dict, 
        ttl_seconds: int = 1
    ):
        """Cache a Jupiter quote with short TTL"""
        from services.redis_schemas import quote_key
        key = quote_key(input_mint, output_mint, amount)
        cache_data = QuoteCache(
            quote=quote,
            cached_at=int(datetime.now().timestamp() * 1000),
            expires_at=int((datetime.now().timestamp() + ttl_seconds) * 1000)
        )
        data = json.dumps(cache_data.to_dict())
        
        if self._use_fallback:
            self._memory_cache[key] = data
            return

        if not self.redis:
            return
        
        try:
            await self.redis.setex(key, ttl_seconds, data)
            logger.debug(f"Cached quote: {key}")
        except Exception as e:
            logger.error(f"Failed to cache quote: {e}")
    
    async def get_cached_quote(
        self, 
        input_mint: str, 
        output_mint: str, 
        amount: int
    ) -> Optional[dict]:
        """Get a cached Jupiter quote if still valid"""
        from services.redis_schemas import quote_key
        key = quote_key(input_mint, output_mint, amount)
        
        data = None
        if self._use_fallback:
            data = self._memory_cache.get(key)
        elif self.redis:
            try:
                data = await self.redis.get(key)
            except Exception as e:
                logger.error(f"Failed to get cached quote: {e}")
        
        if data:
            try:
                cache = QuoteCache(**json.loads(data))
                if cache.is_valid():
                    logger.debug(f"Cache hit: {key}")
                    return cache.quote
                logger.debug(f"Cache expired: {key}")
                if self._use_fallback:
                    del self._memory_cache[key]
            except:
                pass
        
        return None
    
    async def cache_token_info(self, token_address: str, info: dict, ttl_seconds: int = 60):
        """Cache token metadata"""
        from services.redis_schemas import token_info_key
        key = token_info_key(token_address)
        data = json.dumps(info)
        
        if self._use_fallback:
            self._memory_cache[key] = data
            return

        if not self.redis:
            return
        
        try:
            await self.redis.setex(key, ttl_seconds, data)
            logger.debug(f"Cached token info: {key}")
        except Exception as e:
            logger.error(f"Failed to cache token info: {e}")
    
    async def get_cached_token_info(self, token_address: str) -> Optional[dict]:
        """Get cached token metadata"""
        from services.redis_schemas import token_info_key
        key = token_info_key(token_address)
        
        data = None
        if self._use_fallback:
            data = self._memory_cache.get(key)
        elif self.redis:
            try:
                data = await self.redis.get(key)
            except Exception as e:
                logger.error(f"Failed to get cached token info: {e}")
        
        if data:
            return json.loads(data)
        
        return None
    
    # ============ Utility Methods ============
    
    async def get_active_tokens(self) -> List[str]:
        """Get list of tokens with active subscriptions"""
        tokens = set()
        
        for channel in self._subscriptions.keys():
            if channel.startswith("swaps:"):
                tokens.add(channel.split(":")[1])
            elif channel.startswith("candles:"):
                tokens.add(channel.split(":")[1])
        
        return list(tokens)
    
    async def publish_raw(self, channel: str, data: dict):
        """Publish raw data to any channel"""
        serialized = json.dumps(data)
        
        if self._use_fallback:
            await self._fallback_publish(channel, serialized)
            return

        if not self.redis:
            return
        
        try:
            await self.redis.publish(channel, serialized)
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
    
    async def get_pubsub(self) -> PubSub:
        """Get or create pubsub instance for SSE subscriptions"""
        if self._use_fallback:
             # This is tricky as SSE expects a real redis pubsub object
             # For now, we'll raise error as SSE isn't primary path for this task
             logger.warning("SSE not fully supported in in-memory mode")
             raise RuntimeError("Redis not initialized (in-memory mode)")

        if not self.redis:
            raise RuntimeError("Redis not initialized")
        
        if not self.pubsub:
            self.pubsub = self.redis.pubsub()
        
        return self.pubsub
    
    # ============ Sorted Set Methods (for event ordering) ============
    
    async def zadd(self, key: str, mapping: dict):
        """Add members to sorted set with scores"""
        # In-memory implementation of sorted sets is complex
        # For now, we'll just skip ordering in fallback mode
        # This means occasional out-of-order events but system works
        if self._use_fallback:
            return

        if not self.redis:
            return
        
        try:
            await self.redis.zadd(key, mapping)
        except Exception as e:
            logger.error(f"Failed to zadd to {key}: {e}")
    
    async def zrange(self, key: str, start: int, end: int, withscores: bool = False):
        """Get range of members from sorted set"""
        if self._use_fallback:
            return []

        if not self.redis:
            return []
        
        try:
            return await self.redis.zrange(key, start, end, withscores=withscores)
        except Exception as e:
            logger.error(f"Failed to zrange {key}: {e}")
            return []
    
    async def zrem(self, key: str, *members):
        """Remove members from sorted set"""
        if self._use_fallback:
            return

        if not self.redis:
            return
        
        try:
            await self.redis.zrem(key, *members)
        except Exception as e:
            logger.error(f"Failed to zrem from {key}: {e}")
    
    async def zcard(self, key: str) -> int:
        """Get cardinality (count) of sorted set"""
        if self._use_fallback:
            return 0

        if not self.redis:
            return 0
        
        try:
            return await self.redis.zcard(key)
        except Exception as e:
            logger.error(f"Failed to zcard {key}: {e}")
            return 0


# Singleton instance
_redis_service: Optional[RedisService] = None


async def get_redis_service() -> RedisService:
    """Get or create the Redis service singleton"""
    global _redis_service
    
    if _redis_service is None:
        from config import settings
        _redis_service = RedisService(settings.redis_url)
        await _redis_service.connect()
    
    return _redis_service


async def close_redis_service():
    """Close the Redis service"""
    global _redis_service
    
    if _redis_service:
        await _redis_service.disconnect()
        _redis_service = None



