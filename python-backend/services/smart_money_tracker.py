"""
Smart Money Tracker
Monitors whale addresses and triggers copy trades
"""

import asyncio
import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime

from services.redis_service import RedisService, get_redis_service
from services.twitter_scraper import SmartMoneySignal, get_twitter_scraper

logger = logging.getLogger(__name__)


@dataclass
class WhaleSwap:
    """Whale swap event"""
    wallet_address: str
    token_in: str
    token_out: str
    amount_in: float
    amount_out: float
    signature: str
    timestamp: int
    dex: str  # 'jupiter', 'raydium', 'orca', etc.
    usd_value: Optional[float] = None


class SmartMoneyTracker:
    """
    Tracks smart money (whale) addresses and their swaps.
    
    Features:
    - Real-time whale swap monitoring
    - Copy-trade trigger generation
    - Position sizing based on whale trade
    - Slippage protection
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self._whale_addresses: List[str] = []  # List of whale addresses to monitor
        self._callbacks: List[Callable[[WhaleSwap], None]] = []
        self._running = False
        self._twitter_scraper = None
    
    async def start(self):
        """Start smart money tracker"""
        if self._running:
            return
        
        self._running = True
        
        # Load whale addresses from config or database
        await self._load_whale_addresses()
        
        # Subscribe to Twitter scraper signals
        self._twitter_scraper = await get_twitter_scraper(
            callback=self._handle_twitter_signal
        )
        
        # Start monitoring whale addresses (would integrate with on-chain monitoring)
        # For now, this is a placeholder
        
        logger.info(f"SmartMoneyTracker started, monitoring {len(self._whale_addresses)} whale addresses")
    
    async def stop(self):
        """Stop smart money tracker"""
        self._running = False
        logger.info("SmartMoneyTracker stopped")
    
    async def _load_whale_addresses(self):
        """Load whale addresses from config or database"""
        # Load from config file
        import json
        import os
        config_path = os.path.join(
            os.path.dirname(__file__),
            "../config/smart_money_accounts.json"
        )
        
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                # Note: This would load wallet addresses, not Twitter handles
                # For now, using placeholder
                self._whale_addresses = config.get("whale_addresses", [])
        except:
            # Default whale addresses (add your own)
            self._whale_addresses = [
                # Add known whale addresses here
            ]
    
    def _handle_twitter_signal(self, signal: SmartMoneySignal):
        """Handle signal from Twitter scraper"""
        if not self._running:
            return
        
        # Process signal and potentially trigger copy trade
        logger.info(f"Smart money signal: {signal.account} - {signal.signal_type} - {signal.token_symbol}")
        
        # Publish to Redis for copy-trade engine
        asyncio.create_task(self._publish_signal(signal))
    
    async def _publish_signal(self, signal: SmartMoneySignal):
        """Publish smart money signal to Redis"""
        try:
            channel = "smart_money:signals"
            
            signal_data = {
                "account": signal.account,
                "account_handle": signal.account_handle,
                "token_address": signal.token_address,
                "token_symbol": signal.token_symbol,
                "signal_type": signal.signal_type,
                "confidence": signal.confidence,
                "timestamp": signal.timestamp,
                "tweet_id": signal.tweet.id,
                "tweet_url": signal.tweet.url,
            }
            
            await self.redis.publish(channel, signal_data)
        
        except Exception as e:
            logger.error(f"Error publishing signal: {e}")
    
    def on_whale_swap(self, callback: Callable[[WhaleSwap], None]):
        """Register callback for whale swaps"""
        self._callbacks.append(callback)
    
    async def add_whale_address(self, address: str):
        """Add a whale address to monitor"""
        if address not in self._whale_addresses:
            self._whale_addresses.append(address)
            logger.info(f"Added whale address to monitor: {address}")
    
    async def remove_whale_address(self, address: str):
        """Remove a whale address from monitoring"""
        if address in self._whale_addresses:
            self._whale_addresses.remove(address)
            logger.info(f"Removed whale address: {address}")


# Singleton instance
_smart_money_tracker: Optional[SmartMoneyTracker] = None


async def get_smart_money_tracker() -> SmartMoneyTracker:
    """Get smart money tracker instance"""
    global _smart_money_tracker
    
    if _smart_money_tracker is None:
        redis_service = await get_redis_service()
        _smart_money_tracker = SmartMoneyTracker(redis_service)
        await _smart_money_tracker.start()
    
    return _smart_money_tracker
