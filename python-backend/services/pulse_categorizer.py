"""
Pulse Categorizer
Categorizes tokens into New Pairs, Final Stretch, and Migrated
"""

import asyncio
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

import aiohttp

from services.redis_service import RedisService, get_redis_service
from services.migration_detector import MigrationEvent, PulseCategory

logger = logging.getLogger(__name__)


@dataclass
class PulseToken:
    """Token in Pulse system"""
    token_address: str
    token_symbol: Optional[str]
    category: PulseCategory
    bonding_curve_progress: float
    market_cap_usd: Optional[float]
    raydium_pool_address: Optional[str]
    detected_at: int
    signature: str


class PulseCategorizer:
    """
    Categorizes tokens for Axiom Pulse dashboard.
    
    Categories:
    - New Pairs: Newly created Pump.fun tokens
    - Final Stretch: Bonding curve >90% complete (approaching $69k)
    - Migrated: Successfully migrated to Raydium
    """
    
    FINAL_STRETCH_THRESHOLD = 0.90  # 90%
    GRADUATION_THRESHOLD_USD = 69_000
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self._tokens: Dict[str, PulseToken] = {}  # token_address -> PulseToken
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Start categorizer"""
        self._session = aiohttp.ClientSession()
        
        # Subscribe to migration events
        from services.migration_detector import get_migration_detector
        detector = await get_migration_detector()
        detector.on_migration(self._handle_migration_event)
        
        logger.info("PulseCategorizer started")
    
    async def stop(self):
        """Stop categorizer"""
        if self._session:
            await self._session.close()
        logger.info("PulseCategorizer stopped")
    
    def _handle_migration_event(self, event: MigrationEvent):
        """Handle migration event from detector"""
        token = PulseToken(
            token_address=event.token_address,
            token_symbol=event.token_symbol,
            category=event.category,
            bonding_curve_progress=event.bonding_curve_progress,
            market_cap_usd=event.market_cap_usd,
            raydium_pool_address=event.raydium_pool_address,
            detected_at=event.timestamp,
            signature=event.signature,
        )
        
        self._tokens[event.token_address] = token
        
        # Update category if needed
        self._update_category(token)
        
        # Publish update
        asyncio.create_task(self._publish_token_update(token))
    
    def _update_category(self, token: PulseToken):
        """Update token category based on current state"""
        if token.category == PulseCategory.MIGRATED:
            # Already migrated, no change needed
            return
        
        if token.bonding_curve_progress >= 1.0:
            # Fully graduated
            token.category = PulseCategory.MIGRATED
        elif token.bonding_curve_progress >= self.FINAL_STRETCH_THRESHOLD:
            # Final stretch
            if token.category != PulseCategory.FINAL_STRETCH:
                token.category = PulseCategory.FINAL_STRETCH
                logger.info(f"Token {token.token_address} entered final stretch")
    
    async def _publish_token_update(self, token: PulseToken):
        """Publish token update to Redis"""
        try:
            channel = f"pulse:updates:{token.category.value}"
            
            token_data = {
                "token_address": token.token_address,
                "token_symbol": token.token_symbol,
                "category": token.category.value,
                "bonding_curve_progress": token.bonding_curve_progress,
                "market_cap_usd": token.market_cap_usd,
                "raydium_pool_address": token.raydium_pool_address,
                "detected_at": token.detected_at,
                "signature": token.signature,
            }
            
            await self.redis.publish(channel, token_data)
        
        except Exception as e:
            logger.error(f"Error publishing token update: {e}")
    
    async def get_tokens_by_category(
        self,
        category: PulseCategory,
        limit: int = 50
    ) -> List[PulseToken]:
        """Get tokens in a specific category"""
        tokens = [
            token for token in self._tokens.values()
            if token.category == category
        ]
        
        # Sort by detected_at (newest first)
        tokens.sort(key=lambda t: t.detected_at, reverse=True)
        
        return tokens[:limit]
    
    async def get_all_categories(self) -> Dict[str, List[PulseToken]]:
        """Get all tokens grouped by category"""
        return {
            PulseCategory.NEW_PAIRS.value: await self.get_tokens_by_category(PulseCategory.NEW_PAIRS),
            PulseCategory.FINAL_STRETCH.value: await self.get_tokens_by_category(PulseCategory.FINAL_STRETCH),
            PulseCategory.MIGRATED.value: await self.get_tokens_by_category(PulseCategory.MIGRATED),
        }


# Singleton instance
_pulse_categorizer: Optional[PulseCategorizer] = None


async def get_pulse_categorizer() -> PulseCategorizer:
    """Get pulse categorizer instance"""
    global _pulse_categorizer
    
    if _pulse_categorizer is None:
        redis_service = await get_redis_service()
        _pulse_categorizer = PulseCategorizer(redis_service)
        await _pulse_categorizer.start()
    
    return _pulse_categorizer
