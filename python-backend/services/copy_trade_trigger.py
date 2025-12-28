"""
Copy Trade Trigger
Enhanced copy-trade engine that matches whale swaps in real-time
"""

import asyncio
import logging
from typing import Dict, Optional, Callable
from dataclasses import dataclass

from services.redis_service import RedisService, get_redis_service
from services.smart_money_tracker import WhaleSwap, get_smart_money_tracker
from services.twitter_scraper import SmartMoneySignal

logger = logging.getLogger(__name__)


@dataclass
class CopyTradeTrigger:
    """Copy trade trigger event"""
    source: str  # 'whale_swap' or 'twitter_signal'
    token_address: str
    token_symbol: Optional[str]
    side: str  # 'buy' or 'sell'
    amount_usd: float
    confidence: float
    timestamp: int
    metadata: Dict  # Additional data (whale address, tweet URL, etc.)


class CopyTradeTriggerEngine:
    """
    Enhanced copy-trade engine that triggers trades based on:
    - Whale swap events
    - Twitter signals from smart money
    - User-defined copy trading configs
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self._running = False
        self._smart_money_tracker = None
    
    async def start(self):
        """Start copy trade trigger engine"""
        if self._running:
            return
        
        self._running = True
        
        # Get smart money tracker
        self._smart_money_tracker = await get_smart_money_tracker()
        
        # Subscribe to whale swaps
        self._smart_money_tracker.on_whale_swap(self._handle_whale_swap)
        
        # Subscribe to Redis channels
        await self._subscribe_to_signals()
        
        logger.info("CopyTradeTriggerEngine started")
    
    async def stop(self):
        """Stop copy trade trigger engine"""
        self._running = False
        logger.info("CopyTradeTriggerEngine stopped")
    
    async def _subscribe_to_signals(self):
        """Subscribe to smart money signals from Redis"""
        # This would subscribe to Redis pub/sub channels
        # For now, placeholder
        pass
    
    def _handle_whale_swap(self, swap: WhaleSwap):
        """Handle whale swap event"""
        if not self._running:
            return
        
        # Create copy trade trigger
        trigger = CopyTradeTrigger(
            source="whale_swap",
            token_address=swap.token_out if swap.token_in == "SOL" else swap.token_in,
            token_symbol=None,
            side="buy" if swap.token_in == "SOL" else "sell",
            amount_usd=swap.usd_value or 0,
            confidence=0.8,  # High confidence for whale swaps
            timestamp=swap.timestamp,
            metadata={
                "whale_address": swap.wallet_address,
                "signature": swap.signature,
                "dex": swap.dex,
            },
        )
        
        # Process trigger
        asyncio.create_task(self._process_trigger(trigger))
    
    async def _process_trigger(self, trigger: CopyTradeTrigger):
        """Process copy trade trigger"""
        try:
            # Get all active copy trading configs from database
            # For each config that matches:
            #   - Check if user wants to copy this source
            #   - Check position sizing rules
            #   - Check risk limits
            #   - Create pending copy trade
            
            # Publish to Redis for frontend/executor
            channel = "copy_trade:triggers"
            await self.redis.publish(channel, {
                "token_address": trigger.token_address,
                "token_symbol": trigger.token_symbol,
                "side": trigger.side,
                "amount_usd": trigger.amount_usd,
                "confidence": trigger.confidence,
                "source": trigger.source,
                "timestamp": trigger.timestamp,
                "metadata": trigger.metadata,
            })
            
            logger.info(f"Copy trade trigger: {trigger.side} {trigger.token_symbol} (confidence: {trigger.confidence})")
        
        except Exception as e:
            logger.error(f"Error processing trigger: {e}")


# Singleton instance
_copy_trade_trigger: Optional[CopyTradeTriggerEngine] = None


async def get_copy_trade_trigger() -> CopyTradeTriggerEngine:
    """Get copy trade trigger instance"""
    global _copy_trade_trigger
    
    if _copy_trade_trigger is None:
        redis_service = await get_redis_service()
        _copy_trade_trigger = CopyTradeTriggerEngine(redis_service)
        await _copy_trade_trigger.start()
    
    return _copy_trade_trigger
