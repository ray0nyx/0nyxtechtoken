"""
Analytics & Intelligence Service

Provides advanced analytics for Solana meme coins:
- Holder concentration metrics
- Dev activity monitoring
- Insider heuristics
- Real-time PnL tracking
- Risk scoring

This enables users to make informed trading decisions.
"""

import asyncio
import logging
from typing import Dict, Optional, List, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import Counter

from services.redis_service import RedisService, get_redis_service
from services.redis_schemas import (
    whale_alert_pubsub_key,
)

logger = logging.getLogger(__name__)


@dataclass
class HolderConcentration:
    """Holder concentration metrics"""
    token_address: str
    total_holders: int
    top_10_percent_hold: float  # Percentage of supply held by top 10%
    top_1_percent_hold: float
    top_10_holders: List[Dict]  # List of {address, balance, percentage}
    concentration_score: float  # 0.0-1.0, higher = more concentrated (risky)
    whale_count: int  # Holders with >1% of supply


@dataclass
class DevActivity:
    """Dev wallet activity metrics"""
    dev_wallet: str
    token_address: str
    recent_trades: int  # Trades in last 24h
    total_trades: int
    last_trade_timestamp: int
    is_active: bool  # Has traded in last 7 days
    sell_ratio: float  # Percentage of trades that are sells
    avg_trade_size_sol: float
    risk_flags: List[str]  # List of risk indicators


@dataclass
class InsiderHeuristic:
    """Insider trading heuristics"""
    token_address: str
    suspicious_activity: List[str]
    insider_score: float  # 0.0-1.0, higher = more suspicious
    early_buyers: List[str]  # Wallets that bought very early
    dev_affiliated_wallets: List[str]  # Wallets associated with dev
    pump_patterns: List[str]  # Detected pump patterns


@dataclass
class TokenRiskScore:
    """Comprehensive risk score for a token"""
    token_address: str
    overall_score: float  # 0.0-1.0, higher = more risky
    holder_concentration: float
    dev_activity: float
    insider_activity: float
    liquidity_risk: float
    supply_risk: float
    risk_level: str  # 'low', 'medium', 'high', 'critical'
    risk_factors: List[str]


class AnalyticsIntelligenceService:
    """
    Provides analytics and intelligence for tokens.
    
    Features:
    - Holder concentration analysis
    - Dev activity monitoring
    - Insider trading detection
    - Real-time risk scoring
    """
    
    def __init__(self, redis_service: RedisService):
        self.redis = redis_service
        self._holder_cache: Dict[str, HolderConcentration] = {}
        self._dev_activity_cache: Dict[str, DevActivity] = {}
        self._risk_scores: Dict[str, TokenRiskScore] = {}
        self._session = None
    
    async def get_holder_concentration(self, token_address: str) -> Optional[HolderConcentration]:
        """Get holder concentration metrics for a token"""
        # Check cache first
        if token_address in self._holder_cache:
            return self._holder_cache[token_address]
        
        # Fetch from on-chain data
        concentration = await self._calculate_holder_concentration(token_address)
        
        if concentration:
            self._holder_cache[token_address] = concentration
        
        return concentration
    
    async def get_dev_activity(
        self,
        token_address: str,
        dev_wallet: str
    ) -> Optional[DevActivity]:
        """Get dev activity metrics"""
        cache_key = f"{token_address}:{dev_wallet}"
        
        if cache_key in self._dev_activity_cache:
            return self._dev_activity_cache[cache_key]
        
        activity = await self._calculate_dev_activity(token_address, dev_wallet)
        
        if activity:
            self._dev_activity_cache[cache_key] = activity
        
        return activity
    
    async def detect_insider_activity(self, token_address: str) -> Optional[InsiderHeuristic]:
        """Detect insider trading patterns"""
        # Analyze early buyers, dev-affiliated wallets, pump patterns
        heuristic = await self._analyze_insider_patterns(token_address)
        return heuristic
    
    async def calculate_risk_score(self, token_address: str) -> TokenRiskScore:
        """Calculate comprehensive risk score"""
        if token_address in self._risk_scores:
            return self._risk_scores[token_address]
        
        # Gather all metrics
        holder_concentration = await self.get_holder_concentration(token_address)
        insider_heuristic = await self.detect_insider_activity(token_address)
        
        # Calculate component scores
        concentration_score = holder_concentration.concentration_score if holder_concentration else 0.5
        insider_score = insider_heuristic.insider_score if insider_heuristic else 0.0
        
        # Get dev activity (if known)
        dev_score = 0.5  # Default
        # TODO: Get dev wallet from token lifecycle service
        
        # Calculate liquidity risk (simplified)
        liquidity_risk = 0.3  # TODO: Calculate from liquidity data
        
        # Supply risk (check for recent mints/burns)
        supply_risk = 0.2  # TODO: Calculate from supply mutations
        
        # Weighted overall score
        overall_score = (
            concentration_score * 0.3 +
            insider_score * 0.25 +
            dev_score * 0.2 +
            liquidity_risk * 0.15 +
            supply_risk * 0.1
        )
        
        # Determine risk level
        if overall_score >= 0.8:
            risk_level = "critical"
        elif overall_score >= 0.6:
            risk_level = "high"
        elif overall_score >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        risk_factors = []
        if concentration_score > 0.7:
            risk_factors.append("High holder concentration")
        if insider_score > 0.6:
            risk_factors.append("Suspicious insider activity")
        if liquidity_risk > 0.5:
            risk_factors.append("Low liquidity")
        if supply_risk > 0.5:
            risk_factors.append("Recent supply changes")
        
        risk_score = TokenRiskScore(
            token_address=token_address,
            overall_score=overall_score,
            holder_concentration=concentration_score,
            dev_activity=dev_score,
            insider_activity=insider_score,
            liquidity_risk=liquidity_risk,
            supply_risk=supply_risk,
            risk_level=risk_level,
            risk_factors=risk_factors,
        )
        
        self._risk_scores[token_address] = risk_score
        
        return risk_score
    
    async def _calculate_holder_concentration(
        self,
        token_address: str
    ) -> Optional[HolderConcentration]:
        """Calculate holder concentration from on-chain data"""
        try:
            # This would query token accounts from Solana RPC
            # For now, return a placeholder structure
            
            # TODO: Implement actual holder analysis
            # 1. Query all token accounts for this mint
            # 2. Sort by balance
            # 3. Calculate top 10%, top 1%, etc.
            
            return HolderConcentration(
                token_address=token_address,
                total_holders=0,
                top_10_percent_hold=0.0,
                top_1_percent_hold=0.0,
                top_10_holders=[],
                concentration_score=0.5,
                whale_count=0,
            )
        
        except Exception as e:
            logger.error(f"Failed to calculate holder concentration: {e}")
            return None
    
    async def _calculate_dev_activity(
        self,
        token_address: str,
        dev_wallet: str
    ) -> Optional[DevActivity]:
        """Calculate dev activity metrics"""
        try:
            # Query recent trades by dev wallet
            # This would query from swap stream or database
            
            # TODO: Implement actual dev activity tracking
            # 1. Query trades where trader = dev_wallet
            # 2. Filter by time windows
            # 3. Calculate sell ratio, trade sizes, etc.
            
            return DevActivity(
                dev_wallet=dev_wallet,
                token_address=token_address,
                recent_trades=0,
                total_trades=0,
                last_trade_timestamp=0,
                is_active=False,
                sell_ratio=0.0,
                avg_trade_size_sol=0.0,
                risk_flags=[],
            )
        
        except Exception as e:
            logger.error(f"Failed to calculate dev activity: {e}")
            return None
    
    async def _analyze_insider_patterns(
        self,
        token_address: str
    ) -> Optional[InsiderHeuristic]:
        """Analyze patterns that suggest insider trading"""
        try:
            # Detect patterns:
            # 1. Wallets that bought very early (first 1% of trades)
            # 2. Wallets associated with dev (same IP, similar patterns)
            # 3. Pump patterns (coordinated buys)
            
            # TODO: Implement actual pattern detection
            
            return InsiderHeuristic(
                token_address=token_address,
                suspicious_activity=[],
                insider_score=0.0,
                early_buyers=[],
                dev_affiliated_wallets=[],
                pump_patterns=[],
            )
        
        except Exception as e:
            logger.error(f"Failed to analyze insider patterns: {e}")
            return None
    
    async def track_real_time_pnl(
        self,
        wallet_address: str,
        token_address: str
    ) -> Dict:
        """Track real-time PnL for a wallet/token combination"""
        # This would calculate:
        # - Unrealized PnL (current position value - cost basis)
        # - Realized PnL (from closed positions)
        # - Total PnL
        
        # TODO: Implement PnL tracking
        return {
            "wallet": wallet_address,
            "token": token_address,
            "unrealized_pnl_usd": 0.0,
            "realized_pnl_usd": 0.0,
            "total_pnl_usd": 0.0,
            "win_rate": 0.0,
        }


# Singleton instance
_analytics_service: Optional[AnalyticsIntelligenceService] = None


async def get_analytics_service() -> AnalyticsIntelligenceService:
    """Get or create the analytics service singleton"""
    global _analytics_service
    
    if _analytics_service is None:
        redis = await get_redis_service()
        _analytics_service = AnalyticsIntelligenceService(redis)
    
    return _analytics_service

