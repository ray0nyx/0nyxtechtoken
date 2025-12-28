"""
Token Lifecycle Intelligence Service

Tracks the complete lifecycle of Solana meme coins:
- Pump.fun bonding curve phase
- Graduation to Raydium
- Liquidity migration events
- Dev wallet identification
- Supply mutations

This enables the platform to:
- Detect new tokens early (on Pump.fun)
- Alert on graduation events
- Track dev activity
- Monitor liquidity changes
"""

import asyncio
import logging
import json
from typing import Dict, Optional, List, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

from services.redis_service import RedisService, get_redis_service
from services.redis_schemas import (
    migration_pubsub_key,
    token_metadata_key,
)

logger = logging.getLogger(__name__)


class TokenPhase(str, Enum):
    """Token lifecycle phases"""
    PUMP_FUN_BONDING = "pump_fun_bonding"  # On Pump.fun bonding curve
    GRADUATED = "graduated"  # Graduated to Raydium
    UNKNOWN = "unknown"


@dataclass
class PumpFunToken:
    """Pump.fun token information"""
    mint: str
    name: str
    symbol: str
    creator: str  # Dev wallet
    created_timestamp: int
    bonding_curve: str  # Bonding curve account
    associated_bonding_curve: str
    virtual_sol_reserves: float
    virtual_token_reserves: float
    total_supply: int
    market_cap: float
    complete: bool  # Has bonding curve completed?
    raydium_pool: Optional[str] = None  # Raydium pool address if graduated


@dataclass
class GraduationEvent:
    """Pump.fun -> Raydium graduation event"""
    signature: str
    timestamp: int
    token_address: str
    token_symbol: str
    
    # Bonding curve completion
    final_bonding_curve_price: float
    final_market_cap: float
    total_supply: int
    
    # Raydium pool creation
    raydium_pool_address: str
    initial_liquidity_sol: float
    initial_liquidity_token: float
    
    # Dev wallet info
    dev_wallet: str
    dev_proceeds_sol: float
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class LiquidityEvent:
    """Liquidity add/remove event"""
    signature: str
    timestamp: int
    token_address: str
    pool_address: str
    event_type: str  # 'add' or 'remove'
    sol_amount: float
    token_amount: float
    liquidity_provider: str
    new_total_liquidity_sol: float


@dataclass
class DevWalletInfo:
    """Information about a dev wallet"""
    address: str
    tokens_created: List[str]  # List of token mints
    total_raised_sol: float
    graduation_count: int
    is_verified: bool  # Has this wallet been verified?
    risk_score: float  # 0.0-1.0, higher = more risky


class TokenLifecycleService:
    """
    Tracks token lifecycle events and provides intelligence.
    
    Features:
    - Monitors Pump.fun for new tokens
    - Detects graduation events
    - Tracks liquidity changes
    - Identifies dev wallets
    - Provides risk scoring
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self.tracked_tokens: Dict[str, PumpFunToken] = {}
        self.dev_wallets: Dict[str, DevWalletInfo] = {}
        self._callbacks: List[Callable[[GraduationEvent], None]] = []
        self._liquidity_callbacks: List[Callable[[LiquidityEvent], None]] = []
        self._session = None
    
    async def track_token(self, token_address: str):
        """Start tracking a token's lifecycle"""
        # Check if it's a Pump.fun token
        pump_fun_info = await self._fetch_pump_fun_info(token_address)
        
        if pump_fun_info:
            self.tracked_tokens[token_address] = pump_fun_info
            
            # Track dev wallet
            await self._track_dev_wallet(pump_fun_info.creator, token_address)
            
            logger.info(f"Tracking token lifecycle: {token_address} (creator: {pump_fun_info.creator})")
        else:
            # Check if it's already graduated
            phase = await self._detect_token_phase(token_address)
            if phase == TokenPhase.GRADUATED:
                logger.info(f"Token {token_address} is already graduated")
    
    async def detect_graduation(self, tx: dict) -> Optional[GraduationEvent]:
        """
        Detect a Pump.fun -> Raydium graduation event from a transaction.
        
        Graduation indicators:
        1. Pump.fun bonding curve completion (market cap ~$69k)
        2. Raydium pool creation in same or adjacent transaction
        3. Large liquidity addition
        4. Dev wallet receives SOL proceeds
        """
        from services.helius_parser import get_helius_parser
        
        parser = get_helius_parser()
        migration = parser.detect_migration(tx)
        
        if not migration:
            return None
        
        # Enhance with additional data
        token_address = migration.token_address
        pump_fun_info = self.tracked_tokens.get(token_address)
        
        if not pump_fun_info:
            # Try to fetch
            pump_fun_info = await self._fetch_pump_fun_info(token_address)
        
        graduation = GraduationEvent(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", int(datetime.now().timestamp())),
            token_address=token_address,
            token_symbol=pump_fun_info.symbol if pump_fun_info else "",
            final_bonding_curve_price=migration.final_bonding_curve_price,
            final_market_cap=pump_fun_info.market_cap if pump_fun_info else 0,
            total_supply=migration.total_supply,
            raydium_pool_address=migration.raydium_pool_address,
            initial_liquidity_sol=migration.initial_liquidity_sol,
            initial_liquidity_token=migration.initial_liquidity_token,
            dev_wallet=pump_fun_info.creator if pump_fun_info else "",
            dev_proceeds_sol=0,  # Calculate from transaction
        )
        
        # Calculate dev proceeds (usually ~50% of raised SOL)
        if pump_fun_info:
            graduation.dev_proceeds_sol = pump_fun_info.virtual_sol_reserves * 0.5
        
        # Update token phase
        if token_address in self.tracked_tokens:
            self.tracked_tokens[token_address].complete = True
            self.tracked_tokens[token_address].raydium_pool = migration.raydium_pool_address
        
        # Update dev wallet stats
        if graduation.dev_wallet:
            await self._update_dev_wallet_on_graduation(graduation.dev_wallet, graduation)
        
        # Publish graduation event
        await self._publish_graduation(graduation)
        
        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(graduation)
            except Exception as e:
                logger.error(f"Graduation callback error: {e}")
        
        logger.info(
            f"Graduation detected: {token_address} -> {migration.raydium_pool_address} "
            f"(MC: ${graduation.final_market_cap:,.0f})"
        )
        
        return graduation
    
    async def detect_liquidity_event(self, tx: dict) -> Optional[LiquidityEvent]:
        """Detect liquidity add/remove events"""
        from services.helius_parser import get_helius_parser
        
        parser = get_helius_parser()
        liquidity = parser.parse_liquidity_event(tx)
        
        if not liquidity:
            return None
        
        event = LiquidityEvent(
            signature=tx.get("signature", ""),
            timestamp=tx.get("timestamp", int(datetime.now().timestamp())),
            token_address=liquidity.get("token_address", ""),
            pool_address=liquidity.get("pool_address", ""),
            event_type=liquidity.get("type", "add"),
            sol_amount=liquidity.get("sol_amount", 0),
            token_amount=liquidity.get("token_amount", 0),
            liquidity_provider=liquidity.get("provider", ""),
            new_total_liquidity_sol=liquidity.get("total_liquidity_sol", 0),
        )
        
        # Notify callbacks
        for callback in self._liquidity_callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"Liquidity callback error: {e}")
        
        return event
    
    async def get_dev_wallet_info(self, wallet_address: str) -> Optional[DevWalletInfo]:
        """Get information about a dev wallet"""
        if wallet_address in self.dev_wallets:
            return self.dev_wallets[wallet_address]
        
        # Try to build from on-chain data
        info = await self._build_dev_wallet_info(wallet_address)
        if info:
            self.dev_wallets[wallet_address] = info
        
        return info
    
    def on_graduation(self, callback: Callable[[GraduationEvent], None]):
        """Register callback for graduation events"""
        self._callbacks.append(callback)
    
    def on_liquidity_change(self, callback: Callable[[LiquidityEvent], None]):
        """Register callback for liquidity events"""
        self._liquidity_callbacks.append(callback)
    
    async def _fetch_pump_fun_info(self, token_address: str) -> Optional[PumpFunToken]:
        """Fetch token info from Pump.fun API"""
        try:
            import aiohttp
            
            if not self._session:
                self._session = aiohttp.ClientSession()
            
            # Pump.fun API endpoint (this is a placeholder - actual API may differ)
            url = f"https://frontend-api.pump.fun/coins/{token_address}"
            
            async with self._session.get(url) as resp:
                if resp.status != 200:
                    return None
                
                data = await resp.json()
                
                return PumpFunToken(
                    mint=data.get("mint", token_address),
                    name=data.get("name", ""),
                    symbol=data.get("symbol", ""),
                    creator=data.get("creator", ""),
                    created_timestamp=data.get("created_timestamp", 0),
                    bonding_curve=data.get("bonding_curve", ""),
                    associated_bonding_curve=data.get("associated_bonding_curve", ""),
                    virtual_sol_reserves=data.get("virtual_sol_reserves", 0),
                    virtual_token_reserves=data.get("virtual_token_reserves", 0),
                    total_supply=data.get("total_supply", 0),
                    market_cap=data.get("usd_market_cap", 0),
                    complete=data.get("complete", False),
                    raydium_pool=data.get("raydium_pool"),
                )
        
        except Exception as e:
            logger.debug(f"Failed to fetch Pump.fun info: {e}")
            return None
    
    async def _detect_token_phase(self, token_address: str) -> TokenPhase:
        """Detect current phase of a token"""
        # Check if it has a Raydium pool
        # This is simplified - in production, query Raydium program accounts
        
        if token_address in self.tracked_tokens:
            token = self.tracked_tokens[token_address]
            if token.complete and token.raydium_pool:
                return TokenPhase.GRADUATED
            return TokenPhase.PUMP_FUN_BONDING
        
        return TokenPhase.UNKNOWN
    
    async def _track_dev_wallet(self, wallet_address: str, token_address: str):
        """Track a dev wallet and associate it with a token"""
        if wallet_address not in self.dev_wallets:
            self.dev_wallets[wallet_address] = DevWalletInfo(
                address=wallet_address,
                tokens_created=[],
                total_raised_sol=0,
                graduation_count=0,
                is_verified=False,
                risk_score=0.5,  # Default medium risk
            )
        
        info = self.dev_wallets[wallet_address]
        if token_address not in info.tokens_created:
            info.tokens_created.append(token_address)
    
    async def _update_dev_wallet_on_graduation(
        self,
        wallet_address: str,
        graduation: GraduationEvent
    ):
        """Update dev wallet stats when a token graduates"""
        if wallet_address not in self.dev_wallets:
            await self._track_dev_wallet(wallet_address, graduation.token_address)
        
        info = self.dev_wallets[wallet_address]
        info.graduation_count += 1
        info.total_raised_sol += graduation.dev_proceeds_sol
        
        # Update risk score (more graduations = lower risk, but more tokens = higher risk)
        token_count = len(info.tokens_created)
        if token_count > 10:
            info.risk_score = min(1.0, 0.3 + (token_count - 10) * 0.05)
        elif info.graduation_count > 0:
            info.risk_score = max(0.0, 0.5 - (info.graduation_count * 0.1))
    
    async def _build_dev_wallet_info(self, wallet_address: str) -> Optional[DevWalletInfo]:
        """Build dev wallet info from on-chain data"""
        # This would query on-chain data to find all tokens created by this wallet
        # For now, return None and let it be built incrementally
        
        return DevWalletInfo(
            address=wallet_address,
            tokens_created=[],
            total_raised_sol=0,
            graduation_count=0,
            is_verified=False,
            risk_score=0.5,
        )
    
    async def _publish_graduation(self, graduation: GraduationEvent):
        """Publish graduation event to Redis"""
        if not self.redis or not self.redis.redis:
            return
        
        channel = migration_pubsub_key()
        try:
            await self.redis.redis.publish(
                channel,
                json.dumps(graduation.to_dict())
            )
        except Exception as e:
            logger.error(f"Failed to publish graduation: {e}")


# Singleton instance
_lifecycle_service: Optional[TokenLifecycleService] = None


async def get_token_lifecycle_service() -> TokenLifecycleService:
    """Get or create the token lifecycle service singleton"""
    global _lifecycle_service
    
    if _lifecycle_service is None:
        redis = await get_redis_service()
        _lifecycle_service = TokenLifecycleService(redis)
    
    return _lifecycle_service

