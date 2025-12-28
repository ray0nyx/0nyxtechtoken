"""
Data Pipeline Service
Manages real-time data updates, caching, and data normalization
"""

import asyncio
import os
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

# Redis for caching (optional - can use in-memory cache if Redis not available)
try:
    import redis
    REDIS_AVAILABLE = True
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True
    ) if os.getenv("REDIS_HOST") else None
except ImportError:
    REDIS_AVAILABLE = False
    redis_client = None
    logger.warning("Redis not available. Using in-memory cache.")


class DataPipeline:
    """Data pipeline with caching and real-time updates"""
    
    def __init__(self):
        self.in_memory_cache: Dict[str, tuple[Any, float]] = {}
        self.cache_ttls = {
            'price': 5,  # 5 seconds
            'token_metadata': 60,  # 1 minute
            'holder_data': 300,  # 5 minutes
            'analytics': 60,  # 1 minute
            'ohlcv': 30,  # 30 seconds
        }
        self.subscribers: Dict[str, list[Callable]] = {}
    
    def _get_cache_key(self, cache_type: str, identifier: str) -> str:
        """Generate cache key"""
        return f"wagyu:{cache_type}:{identifier}"
    
    async def get_cached(self, cache_type: str, identifier: str) -> Optional[Any]:
        """Get cached data"""
        cache_key = self._get_cache_key(cache_type, identifier)
        
        # Try Redis first
        if REDIS_AVAILABLE and redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis cache read failed: {e}")
        
        # Fallback to in-memory cache
        if cache_key in self.in_memory_cache:
            data, timestamp = self.in_memory_cache[cache_key]
            ttl = self.cache_ttls.get(cache_type, 60)
            if (datetime.now().timestamp() - timestamp) < ttl:
                return data
            del self.in_memory_cache[cache_key]
        
        return None
    
    async def set_cached(self, cache_type: str, identifier: str, data: Any):
        """Cache data"""
        cache_key = self._get_cache_key(cache_type, identifier)
        ttl = self.cache_ttls.get(cache_type, 60)
        
        # Try Redis first
        if REDIS_AVAILABLE and redis_client:
            try:
                redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(data, default=str)
                )
                return
            except Exception as e:
                logger.warning(f"Redis cache write failed: {e}")
        
        # Fallback to in-memory cache
        self.in_memory_cache[cache_key] = (data, datetime.now().timestamp())
        
        # Clean up old entries periodically
        if len(self.in_memory_cache) > 1000:
            self._cleanup_cache()
    
    def _cleanup_cache(self):
        """Clean up expired cache entries"""
        now = datetime.now().timestamp()
        keys_to_remove = []
        
        for key, (data, timestamp) in self.in_memory_cache.items():
            # Extract cache type from key
            cache_type = key.split(':')[1] if ':' in key else 'price'
            ttl = self.cache_ttls.get(cache_type, 60)
            
            if (now - timestamp) > ttl:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.in_memory_cache[key]
    
    async def subscribe(self, event_type: str, callback: Callable):
        """Subscribe to data updates"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
    
    async def publish(self, event_type: str, data: Any):
        """Publish data update to subscribers"""
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                try:
                    await callback(data)
                except Exception as e:
                    logger.error(f"Error in subscriber callback: {e}")
    
    async def normalize_token_data(self, raw_data: Dict[str, Any], source: str) -> Dict[str, Any]:
        """Normalize token data from different sources"""
        # Standardize field names and formats
        normalized = {
            'symbol': raw_data.get('symbol', ''),
            'name': raw_data.get('name'),
            'address': raw_data.get('address', raw_data.get('token_address', '')),
            'price': self._to_decimal(raw_data.get('price', raw_data.get('priceUsd', 0))),
            'price_usd': self._to_decimal(raw_data.get('priceUsd', raw_data.get('price', 0))),
            'change_24h': self._to_decimal(raw_data.get('change24h', raw_data.get('change_24h', 0))),
            'volume_24h': self._to_decimal(raw_data.get('volume24h', raw_data.get('volume_24h', 0))),
            'liquidity': self._to_decimal(raw_data.get('liquidity', raw_data.get('liquidityUsd', 0))),
            'market_cap': self._to_decimal(raw_data.get('marketCap', raw_data.get('market_cap')),
            'fdv': self._to_decimal(raw_data.get('fdv')),
            'pair_address': raw_data.get('pairAddress', raw_data.get('pair_address')),
            'chain': raw_data.get('chainId', raw_data.get('chain', 'solana')),
            'dex': raw_data.get('dexId', raw_data.get('dex')),
            'source': source,
        }
        
        return normalized
    
    def _to_decimal(self, value: Any) -> float:
        """Convert value to float (Decimal in models)"""
        if value is None:
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0


# Global pipeline instance
_pipeline = DataPipeline()


async def get_data_pipeline() -> DataPipeline:
    """Get data pipeline instance"""
    return _pipeline
