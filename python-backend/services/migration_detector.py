"""
Migration Detector
<100ms Pump.fun to Raydium migration detection
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

from services.redis_service import RedisService, get_redis_service
from services.yellowstone_geyser import TransactionUpdate, get_geyser_subscriber

logger = logging.getLogger(__name__)


class PulseCategory(str, Enum):
    """Axiom Pulse categories"""
    NEW_PAIRS = "new_pairs"  # Newly created Pump.fun tokens
    FINAL_STRETCH = "final_stretch"  # Bonding curve >90% complete
    MIGRATED = "migrated"  # Successfully migrated to Raydium


@dataclass
class MigrationEvent:
    """Pump.fun migration event"""
    token_address: str
    token_symbol: Optional[str]
    category: PulseCategory
    timestamp: int
    slot: int
    signature: str
    bonding_curve_progress: float  # 0.0 to 1.0
    raydium_pool_address: Optional[str] = None
    market_cap_usd: Optional[float] = None


class MigrationDetector:
    """
    Detects Pump.fun migrations to Raydium in <100ms.
    
    Uses Yellowstone Geyser for real-time transaction streaming.
    """
    
    PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    RAYDIUM_AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
    GRADUATION_THRESHOLD_USD = 69_000  # ~$69k
    FINAL_STRETCH_THRESHOLD = 0.90  # 90% of bonding curve
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self._callbacks: list[Callable[[MigrationEvent], None]] = []
        self._running = False
        self._geyser_subscriber = None
        self._token_states: Dict[str, Dict[str, Any]] = {}  # token -> state cache
    
    async def start(self):
        """Start migration detector"""
        if self._running:
            return
        
        self._running = True
        
        # Subscribe to Geyser updates
        self._geyser_subscriber = await get_geyser_subscriber(
            callback=self._handle_transaction_update
        )
        
        logger.info("MigrationDetector started")
    
    async def stop(self):
        """Stop migration detector"""
        self._running = False
        logger.info("MigrationDetector stopped")
    
    def _handle_transaction_update(self, update: TransactionUpdate):
        """Handle transaction update from Geyser"""
        if not self._running:
            return
        
        start_time = time.time() * 1000  # milliseconds
        
        # Create async task for detection
        asyncio.create_task(self._handle_transaction_update_async(update, start_time))
    
    async def _handle_transaction_update_async(self, update: TransactionUpdate, start_time: float):
        """Async handler for transaction updates"""
        try:
            # Use zero-copy parsing for accounts
            from services.zero_copy_parser import get_zero_copy_parser
            parser = get_zero_copy_parser()
            
            # Check if transaction involves Pump.fun or Raydium
            accounts = update.accounts or []
            # Zero-copy account key extraction
            account_keys = []
            for acc in accounts:
                pubkey = acc.get("pubkey", "")
                if pubkey:
                    account_keys.append(pubkey)
            
            has_pump_fun = self.PUMP_FUN_PROGRAM in account_keys
            has_raydium = self.RAYDIUM_AMM_V4 in account_keys
            
            if not (has_pump_fun or has_raydium):
                return
            
            # Parse transaction for migration signals
            migration_event = await self._detect_migration(update, has_pump_fun, has_raydium)
            
            if migration_event:
                # Process in <100ms
                processing_time = (time.time() * 1000) - start_time
                
                if processing_time > 100:
                    logger.warning(f"Migration detection took {processing_time}ms (target: <100ms)")
                
                # Publish to Redis
                asyncio.create_task(self._publish_migration(migration_event))
                
                # Call callbacks
                for callback in self._callbacks:
                    try:
                        callback(migration_event)
                    except Exception as e:
                        logger.error(f"Migration callback error: {e}")
        
        except Exception as e:
            logger.error(f"Error handling transaction update: {e}")
    
    async def _detect_migration(
        self,
        update: TransactionUpdate,
        has_pump_fun: bool,
        has_raydium: bool
    ) -> Optional[MigrationEvent]:
        """Detect migration event from transaction"""
        try:
            logs = update.logs or []
            accounts = update.accounts or []
            
            # Check for Pump.fun initialization (new pair)
            if has_pump_fun and not has_raydium:
                # Check if this is a new token creation
                if any("Initialize" in log for log in logs):
                    # Extract token address from accounts
                    token_address = self._extract_token_address(accounts)
                    if token_address:
                        return MigrationEvent(
                            token_address=token_address,
                            token_symbol=None,
                            category=PulseCategory.NEW_PAIRS,
                            timestamp=update.block_time,
                            slot=update.slot,
                            signature=update.signature,
                            bonding_curve_progress=0.0,
                        )
            
            # Check for graduation (migration to Raydium)
            if has_pump_fun and has_raydium:
                # This is likely a migration
                token_address = self._extract_token_address(accounts)
                raydium_pool = self._extract_raydium_pool(accounts, logs)
                
                if token_address:
                    # Check bonding curve progress
                    progress = await self._get_bonding_curve_progress(token_address)
                    
                    return MigrationEvent(
                        token_address=token_address,
                        token_symbol=None,
                        category=PulseCategory.MIGRATED,
                        timestamp=update.block_time,
                        slot=update.slot,
                        signature=update.signature,
                        bonding_curve_progress=progress,
                        raydium_pool_address=raydium_pool,
                    )
            
            # Check for final stretch (>90% bonding curve)
            if has_pump_fun:
                token_address = self._extract_token_address(accounts)
                if token_address:
                    progress = await self._get_bonding_curve_progress(token_address)
                    
                    if progress >= self.FINAL_STRETCH_THRESHOLD:
                        return MigrationEvent(
                            token_address=token_address,
                            token_symbol=None,
                            category=PulseCategory.FINAL_STRETCH,
                            timestamp=update.block_time,
                            slot=update.slot,
                            signature=update.signature,
                            bonding_curve_progress=progress,
                        )
        
        except Exception as e:
            logger.error(f"Error detecting migration: {e}")
        
        return None
    
    def _extract_token_address(self, accounts: list) -> Optional[str]:
        """Extract token address from transaction accounts"""
        # Simplified - would need proper account parsing
        # Look for token mint in accounts
        for acc in accounts:
            pubkey = acc.get("pubkey", "")
            # Token mints are typically in specific account positions
            # This is a placeholder - actual implementation would parse properly
            if pubkey and len(pubkey) == 44:  # Solana address length
                return pubkey
        return None
    
    def _extract_raydium_pool(self, accounts: list, logs: list) -> Optional[str]:
        """Extract Raydium pool address from transaction"""
        # Look for pool creation in logs or accounts
        for log in logs:
            if "InitializePool" in log or "pool" in log.lower():
                # Extract pool address from accounts
                for acc in accounts:
                    pubkey = acc.get("pubkey", "")
                    if pubkey:
                        return pubkey
        return None
    
    async def _get_bonding_curve_progress(self, token_address: str) -> float:
        """Get bonding curve progress (0.0 to 1.0)"""
        # Check cache first
        if token_address in self._token_states:
            state = self._token_states[token_address]
            market_cap = state.get("market_cap_usd", 0)
            progress = min(market_cap / self.GRADUATION_THRESHOLD_USD, 1.0)
            return progress
        
        # Fetch from API (async, non-blocking)
        # This would call Pump.fun API or on-chain data
        # For now, return 0.0 (unknown)
        return 0.0
    
    async def _publish_migration(self, event: MigrationEvent):
        """Publish migration event to Redis"""
        try:
            # Publish to category-specific channel
            channel = f"pulse:{event.category.value}"
            
            event_data = {
                "token_address": event.token_address,
                "token_symbol": event.token_symbol,
                "category": event.category.value,
                "timestamp": event.timestamp,
                "slot": event.slot,
                "signature": event.signature,
                "bonding_curve_progress": event.bonding_curve_progress,
                "raydium_pool_address": event.raydium_pool_address,
                "market_cap_usd": event.market_cap_usd,
            }
            
            await self.redis.publish(channel, event_data)
            logger.info(f"Published migration event: {event.category.value} - {event.token_address}")
        
        except Exception as e:
            logger.error(f"Error publishing migration: {e}")
    
    def on_migration(self, callback: Callable[[MigrationEvent], None]):
        """Register callback for migration events"""
        self._callbacks.append(callback)


# Singleton instance
_migration_detector: Optional[MigrationDetector] = None


async def get_migration_detector() -> MigrationDetector:
    """Get migration detector instance"""
    global _migration_detector
    
    if _migration_detector is None:
        redis_service = await get_redis_service()
        _migration_detector = MigrationDetector(redis_service)
        await _migration_detector.start()
    
    return _migration_detector
