"""
Rate Limiting Service for WagyuTech API
Implements token bucket algorithm for tier-based rate limiting
"""

import time
import asyncio
from typing import Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class TokenBucket:
    """Token bucket for rate limiting"""
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        capacity: Maximum tokens
        refill_rate: Tokens per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens, returns True if successful"""
        async with self._lock:
            # Refill tokens based on time passed
            now = time.time()
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
            self.last_refill = now
            
            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    async def get_remaining(self) -> int:
        """Get remaining tokens"""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
            self.last_refill = now
            return int(self.tokens)


class RateLimiter:
    """Rate limiter with per-key tracking"""
    
    def __init__(self):
        # Per API key: {minute_bucket, hour_bucket}
        self.buckets: Dict[str, Dict[str, TokenBucket]] = defaultdict(dict)
        self._cleanup_interval = 3600  # Clean up old buckets every hour
        self._last_cleanup = time.time()
    
    def _get_buckets(self, api_key_id: str, per_minute: int, per_hour: int) -> Dict[str, TokenBucket]:
        """Get or create token buckets for an API key"""
        if api_key_id not in self.buckets:
            # Create buckets: capacity = limit, refill_rate = limit / time_window
            self.buckets[api_key_id] = {
                'minute': TokenBucket(per_minute, per_minute / 60.0),  # Refill per second
                'hour': TokenBucket(per_hour, per_hour / 3600.0),  # Refill per second
            }
        return self.buckets[api_key_id]
    
    async def is_allowed(
        self, 
        api_key_id: str, 
        rate_limit_per_minute: int, 
        rate_limit_per_hour: int
    ) -> tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed
        Returns: (is_allowed, {remaining_per_minute, remaining_per_hour, reset_at})
        """
        buckets = self._get_buckets(api_key_id, rate_limit_per_minute, rate_limit_per_hour)
        
        # Try to consume from both buckets
        minute_allowed = await buckets['minute'].consume(1)
        hour_allowed = await buckets['hour'].consume(1)
        
        is_allowed = minute_allowed and hour_allowed
        
        # Get remaining tokens
        remaining_minute = await buckets['minute'].get_remaining()
        remaining_hour = await buckets['hour'].get_remaining()
        
        # Calculate reset time (when next token will be available)
        reset_at = None
        if not is_allowed:
            # Find which bucket is limiting
            if not minute_allowed:
                # Reset in 60 seconds (approximate)
                reset_at = int(time.time()) + 60
            elif not hour_allowed:
                # Reset in 3600 seconds (approximate)
                reset_at = int(time.time()) + 3600
        
        return is_allowed, {
            'remaining_per_minute': remaining_minute,
            'remaining_per_hour': remaining_hour,
            'reset_at': reset_at,
        }
    
    async def cleanup_old_buckets(self):
        """Clean up buckets for inactive API keys"""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        
        # Remove buckets that haven't been used in 24 hours
        # (In production, use Redis with TTL instead)
        keys_to_remove = []
        for key_id in self.buckets:
            # Simple cleanup - in production, track last access time
            pass
        
        self._last_cleanup = now


# Global rate limiter instance
_rate_limiter = RateLimiter()


async def check_rate_limit(
    api_key_id: str,
    rate_limit_per_minute: int,
    rate_limit_per_hour: int
) -> tuple[bool, Dict[str, int]]:
    """
    Check if API key is within rate limits
    Returns: (is_allowed, rate_limit_info)
    """
    return await _rate_limiter.is_allowed(
        api_key_id,
        rate_limit_per_minute,
        rate_limit_per_hour
    )
