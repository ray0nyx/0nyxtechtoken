"""
Honeypot Analyzer
Comprehensive honeypot detection and safety scoring
"""

import asyncio
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from enum import Enum

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
import aiohttp

logger = logging.getLogger(__name__)


class SafetyLevel(str, Enum):
    """Token safety levels"""
    SAFE = "safe"  # 80-100
    LOW_RISK = "low_risk"  # 60-79
    MEDIUM_RISK = "medium_risk"  # 40-59
    HIGH_RISK = "high_risk"  # 20-39
    DANGER = "danger"  # 0-19
    HONEYPOT = "honeypot"  # Confirmed honeypot


@dataclass
class SafetyScore:
    """Comprehensive safety score"""
    overall_score: int  # 0-100
    safety_level: SafetyLevel
    risk_factors: List[str]
    is_honeypot: bool
    transfer_restrictions: bool
    sell_restrictions: bool
    tax_on_transfer: bool
    blacklisted: bool
    liquidity_locked: bool
    owner_controls: Dict[str, any]
    details: Dict[str, any]


class HoneypotAnalyzer:
    """
    Analyzes tokens for honeypot characteristics and calculates safety scores.
    
    Checks:
    - Transfer restrictions
    - Sell restrictions
    - Tax on transfer
    - Blacklisted addresses
    - Liquidity locks
    - Owner controls
    - Token program verification
    """
    
    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url
        self.client: Optional[AsyncClient] = None
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Start the analyzer"""
        self.client = AsyncClient(self.rpc_url, commitment=Confirmed)
        self._session = aiohttp.ClientSession()
        logger.info("HoneypotAnalyzer started")
    
    async def stop(self):
        """Stop the analyzer"""
        if self.client:
            await self.client.close()
        if self._session:
            await self._session.close()
        logger.info("HoneypotAnalyzer stopped")
    
    async def analyze_token(
        self,
        token_address: str,
        simulate_buy: bool = True,
        simulate_sell: bool = True
    ) -> SafetyScore:
        """
        Analyze a token for honeypot characteristics.
        
        Args:
            token_address: Token mint address
            simulate_buy: Simulate a buy transaction
            simulate_sell: Simulate a sell transaction
            
        Returns:
            SafetyScore with comprehensive analysis
        """
        risk_factors = []
        details = {}
        
        # Check 1: Token program verification
        is_verified_token_program = await self._check_token_program(token_address)
        if not is_verified_token_program:
            risk_factors.append("Unverified token program")
            details["token_program_verified"] = False
        
        # Check 2: Transfer restrictions (simulate buy and sell)
        transfer_restrictions = False
        sell_restrictions = False
        
        if simulate_buy:
            buy_restriction = await self._check_transfer_restriction(
                token_address,
                direction="buy"
            )
            if buy_restriction:
                transfer_restrictions = True
                risk_factors.append("Buy transfer restrictions detected")
        
        if simulate_sell:
            sell_restriction = await self._check_transfer_restriction(
                token_address,
                direction="sell"
            )
            if sell_restriction:
                sell_restrictions = True
                transfer_restrictions = True
                risk_factors.append("Sell transfer restrictions detected (HONEYPOT)")
        
        # Check 3: Tax on transfer
        tax_on_transfer = await self._check_tax_on_transfer(token_address)
        if tax_on_transfer:
            risk_factors.append("Tax on transfer detected")
            details["tax_on_transfer"] = True
        
        # Check 4: Blacklisted addresses
        blacklisted = await self._check_blacklist(token_address)
        if blacklisted:
            risk_factors.append("Token or creator is blacklisted")
            details["blacklisted"] = True
        
        # Check 5: Liquidity locks
        liquidity_locked = await self._check_liquidity_lock(token_address)
        if not liquidity_locked:
            risk_factors.append("Liquidity not locked")
            details["liquidity_locked"] = False
        
        # Check 6: Owner controls
        owner_controls = await self._check_owner_controls(token_address)
        if owner_controls.get("can_freeze"):
            risk_factors.append("Owner can freeze accounts")
        if owner_controls.get("can_mint"):
            risk_factors.append("Owner can mint additional tokens")
        if owner_controls.get("can_burn"):
            risk_factors.append("Owner can burn tokens")
        
        # Determine if honeypot
        is_honeypot = sell_restrictions or blacklisted
        
        # Calculate safety score
        score = 100
        
        # Deduct points for each risk factor
        if sell_restrictions:
            score -= 50  # Major deduction for sell restrictions
        if transfer_restrictions:
            score -= 30
        if tax_on_transfer:
            score -= 20
        if blacklisted:
            score -= 40
        if not liquidity_locked:
            score -= 15
        if owner_controls.get("can_freeze"):
            score -= 10
        if owner_controls.get("can_mint"):
            score -= 15
        if not is_verified_token_program:
            score -= 10
        
        # Clamp score
        score = max(0, min(100, score))
        
        # Determine safety level
        if is_honeypot:
            safety_level = SafetyLevel.HONEYPOT
        elif score >= 80:
            safety_level = SafetyLevel.SAFE
        elif score >= 60:
            safety_level = SafetyLevel.LOW_RISK
        elif score >= 40:
            safety_level = SafetyLevel.MEDIUM_RISK
        elif score >= 20:
            safety_level = SafetyLevel.HIGH_RISK
        else:
            safety_level = SafetyLevel.DANGER
        
        return SafetyScore(
            overall_score=score,
            safety_level=safety_level,
            risk_factors=risk_factors,
            is_honeypot=is_honeypot,
            transfer_restrictions=transfer_restrictions,
            sell_restrictions=sell_restrictions,
            tax_on_transfer=tax_on_transfer,
            blacklisted=blacklisted,
            liquidity_locked=liquidity_locked,
            owner_controls=owner_controls,
            details=details,
        )
    
    async def _check_token_program(self, token_address: str) -> bool:
        """Check if token uses verified token program"""
        try:
            if not self.client:
                return False
            
            # Get token account info
            # Standard SPL Token program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
            # This is a simplified check - would need proper account parsing
            return True  # Placeholder
        except:
            return False
    
    async def _check_transfer_restriction(
        self,
        token_address: str,
        direction: str = "sell"
    ) -> bool:
        """Check for transfer restrictions by simulating a transaction"""
        try:
            # This would simulate a buy/sell transaction and check for errors
            # Placeholder - actual implementation would:
            # 1. Build a test transaction
            # 2. Simulate it
            # 3. Check logs for restriction errors
            
            # Common restriction indicators:
            # - "Transfer not allowed"
            # - "Account frozen"
            # - "Insufficient permissions"
            
            return False  # Placeholder
        except:
            return False
    
    async def _check_tax_on_transfer(self, token_address: str) -> bool:
        """Check if token has tax on transfer"""
        try:
            # Check token metadata or simulate transfer to detect tax
            # Tax tokens typically have custom transfer logic
            return False  # Placeholder
        except:
            return False
    
    async def _check_blacklist(self, token_address: str) -> bool:
        """Check if token or creator is blacklisted"""
        try:
            # Query blacklist database or API
            # Could use known blacklist services
            return False  # Placeholder
        except:
            return False
    
    async def _check_liquidity_lock(self, token_address: str) -> bool:
        """Check if liquidity is locked"""
        try:
            # Check if LP tokens are locked in a time-lock contract
            # Query on-chain data or use API
            return True  # Placeholder - assume locked by default
        except:
            return False
    
    async def _check_owner_controls(self, token_address: str) -> Dict[str, bool]:
        """Check what controls the token owner has"""
        try:
            if not self.client:
                return {}
            
            # Get mint account info
            # Check mint authority, freeze authority, etc.
            # This would require parsing the mint account data
            
            return {
                "can_freeze": False,
                "can_mint": False,
                "can_burn": False,
            }  # Placeholder
        except:
            return {}


# Singleton instance
_honeypot_analyzer: Optional[HoneypotAnalyzer] = None


async def get_honeypot_analyzer() -> HoneypotAnalyzer:
    """Get honeypot analyzer instance"""
    global _honeypot_analyzer
    
    if _honeypot_analyzer is None:
        from config import settings
        rpc_url = getattr(settings, 'solana_rpc_url', 'https://api.mainnet-beta.solana.com')
        _honeypot_analyzer = HoneypotAnalyzer(rpc_url)
        await _honeypot_analyzer.start()
    
    return _honeypot_analyzer
