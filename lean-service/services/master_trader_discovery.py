"""
Master Trader Discovery and Ranking System
Performance-based ranking and discovery of master traders
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import json
import math

logger = logging.getLogger(__name__)

class StrategyType(Enum):
    SCALPING = "scalping"
    SWING = "swing"
    ARBITRAGE = "arbitrage"
    MEAN_REVERSION = "mean_reversion"
    TREND_FOLLOWING = "trend_following"
    MOMENTUM = "momentum"
    CONTRARIAN = "contrarian"

class RiskLevel(Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    HIGH_FREQUENCY = "high_frequency"

class VerificationStatus(Enum):
    UNVERIFIED = "unverified"
    PENDING = "pending"
    VERIFIED = "verified"
    PREMIUM = "premium"

@dataclass
class PerformanceMetrics:
    """Comprehensive performance metrics for a master trader"""
    # Basic metrics
    total_return: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    
    # Risk metrics
    max_drawdown: float = 0.0
    current_drawdown: float = 0.0
    volatility: float = 0.0
    var_95: float = 0.0
    var_99: float = 0.0
    expected_shortfall: float = 0.0
    
    # Trade metrics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    recovery_factor: float = 0.0
    
    # Consistency metrics
    consecutive_wins: int = 0
    consecutive_losses: int = 0
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    consistency_score: float = 0.0
    
    # Market metrics
    beta: float = 1.0
    alpha: float = 0.0
    information_ratio: float = 0.0
    treynor_ratio: float = 0.0
    
    # Time-based metrics
    avg_trade_duration: float = 0.0
    avg_hold_time: float = 0.0
    trade_frequency: float = 0.0
    
    # Social metrics
    follower_count: int = 0
    total_assets_managed: float = 0.0
    average_rating: float = 0.0
    review_count: int = 0
    
    # Calculated scores
    overall_score: float = 0.0
    risk_adjusted_score: float = 0.0
    consistency_score_calc: float = 0.0
    social_score: float = 0.0

@dataclass
class MasterTraderProfile:
    """Master trader profile with performance data"""
    id: str
    user_id: str
    profile_name: str
    strategy_type: StrategyType
    risk_level: RiskLevel
    verification_status: VerificationStatus
    
    # Performance data
    performance: PerformanceMetrics = field(default_factory=PerformanceMetrics)
    
    # Profile settings
    is_public: bool = True
    is_accepting_followers: bool = True
    min_investment: float = 100.0
    max_followers: int = 1000
    performance_fee: float = 0.20  # 20%
    management_fee: float = 0.01   # 1%
    high_water_mark: bool = True
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_trade_at: Optional[datetime] = None
    track_record_months: int = 0
    
    # Social features
    bio: str = ""
    tags: List[str] = field(default_factory=list)
    social_links: Dict[str, str] = field(default_factory=dict)
    
    # Verification data
    verification_documents: List[str] = field(default_factory=list)
    kyc_status: str = "pending"
    compliance_score: float = 0.0

@dataclass
class RankingCriteria:
    """Criteria for ranking master traders"""
    # Performance weights
    return_weight: float = 0.25
    risk_weight: float = 0.20
    consistency_weight: float = 0.15
    social_weight: float = 0.10
    
    # Risk adjustment
    max_drawdown_penalty: float = 0.30
    volatility_penalty: float = 0.20
    
    # Time-based filters
    min_track_record_months: int = 3
    min_total_trades: int = 50
    max_drawdown_threshold: float = 0.50  # 50%
    
    # Social filters
    min_follower_count: int = 0
    min_rating: float = 0.0
    
    # Verification requirements
    require_verification: bool = False
    require_kyc: bool = False

class PerformanceCalculator:
    """Calculates various performance metrics"""
    
    @staticmethod
    def calculate_sharpe_ratio(returns: List[float], risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio"""
        if not returns or len(returns) < 2:
            return 0.0
        
        returns_array = np.array(returns)
        excess_returns = returns_array - (risk_free_rate / 252)  # Daily risk-free rate
        
        if np.std(excess_returns) == 0:
            return 0.0
        
        return np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)
    
    @staticmethod
    def calculate_sortino_ratio(returns: List[float], risk_free_rate: float = 0.02) -> float:
        """Calculate Sortino ratio (downside deviation)"""
        if not returns or len(returns) < 2:
            return 0.0
        
        returns_array = np.array(returns)
        excess_returns = returns_array - (risk_free_rate / 252)
        
        # Calculate downside deviation
        downside_returns = excess_returns[excess_returns < 0]
        if len(downside_returns) == 0:
            return float('inf') if np.mean(excess_returns) > 0 else 0.0
        
        downside_deviation = np.std(downside_returns)
        if downside_deviation == 0:
            return 0.0
        
        return np.mean(excess_returns) / downside_deviation * np.sqrt(252)
    
    @staticmethod
    def calculate_calmar_ratio(returns: List[float], max_drawdown: float) -> float:
        """Calculate Calmar ratio"""
        if max_drawdown == 0:
            return 0.0
        
        annualized_return = np.mean(returns) * 252 if returns else 0.0
        return annualized_return / max_drawdown
    
    @staticmethod
    def calculate_max_drawdown(equity_curve: List[float]) -> float:
        """Calculate maximum drawdown"""
        if not equity_curve or len(equity_curve) < 2:
            return 0.0
        
        equity_array = np.array(equity_curve)
        peak = np.maximum.accumulate(equity_array)
        drawdown = (peak - equity_array) / peak
        return np.max(drawdown)
    
    @staticmethod
    def calculate_volatility(returns: List[float]) -> float:
        """Calculate annualized volatility"""
        if not returns or len(returns) < 2:
            return 0.0
        
        return np.std(returns) * np.sqrt(252)
    
    @staticmethod
    def calculate_var(returns: List[float], confidence_level: float = 0.95) -> float:
        """Calculate Value at Risk"""
        if not returns:
            return 0.0
        
        returns_array = np.array(returns)
        return np.percentile(returns_array, (1 - confidence_level) * 100)
    
    @staticmethod
    def calculate_expected_shortfall(returns: List[float], confidence_level: float = 0.95) -> float:
        """Calculate Expected Shortfall (Conditional VaR)"""
        if not returns:
            return 0.0
        
        returns_array = np.array(returns)
        var = PerformanceCalculator.calculate_var(returns, confidence_level)
        tail_returns = returns_array[returns_array <= var]
        
        if len(tail_returns) == 0:
            return 0.0
        
        return np.mean(tail_returns)
    
    @staticmethod
    def calculate_consistency_score(returns: List[float]) -> float:
        """Calculate consistency score based on return stability"""
        if not returns or len(returns) < 10:
            return 0.0
        
        returns_array = np.array(returns)
        
        # Calculate rolling Sharpe ratio consistency
        window_size = min(20, len(returns) // 4)
        rolling_sharpe = []
        
        for i in range(window_size, len(returns)):
            window_returns = returns_array[i-window_size:i]
            sharpe = PerformanceCalculator.calculate_sharpe_ratio(window_returns.tolist())
            rolling_sharpe.append(sharpe)
        
        if not rolling_sharpe:
            return 0.0
        
        # Consistency is inverse of volatility of Sharpe ratios
        sharpe_volatility = np.std(rolling_sharpe)
        if sharpe_volatility == 0:
            return 1.0
        
        consistency = 1.0 / (1.0 + sharpe_volatility)
        return min(consistency, 1.0)
    
    @staticmethod
    def calculate_profit_factor(winning_trades: List[float], losing_trades: List[float]) -> float:
        """Calculate profit factor"""
        if not winning_trades and not losing_trades:
            return 0.0
        
        total_wins = sum(winning_trades) if winning_trades else 0
        total_losses = abs(sum(losing_trades)) if losing_trades else 0
        
        if total_losses == 0:
            return float('inf') if total_wins > 0 else 0.0
        
        return total_wins / total_losses
    
    @staticmethod
    def calculate_recovery_factor(total_return: float, max_drawdown: float) -> float:
        """Calculate recovery factor"""
        if max_drawdown == 0:
            return 0.0
        
        return total_return / max_drawdown

class MasterTraderRanker:
    """Ranks master traders based on multiple criteria"""
    
    def __init__(self):
        self.performance_calculator = PerformanceCalculator()
        self.ranking_cache = {}
        self.cache_expiry = {}
        self.cache_ttl = 300  # 5 minutes
    
    def calculate_overall_score(self, profile: MasterTraderProfile, criteria: RankingCriteria) -> float:
        """Calculate overall ranking score"""
        try:
            perf = profile.performance
            
            # Calculate individual component scores
            return_score = self._calculate_return_score(perf, criteria)
            risk_score = self._calculate_risk_score(perf, criteria)
            consistency_score = self._calculate_consistency_score(perf, criteria)
            social_score = self._calculate_social_score(perf, criteria)
            
            # Apply weights
            overall_score = (
                return_score * criteria.return_weight +
                risk_score * criteria.risk_weight +
                consistency_score * criteria.consistency_weight +
                social_score * criteria.social_weight
            )
            
            # Apply penalties
            overall_score = self._apply_penalties(overall_score, perf, criteria)
            
            # Normalize to 0-100 scale
            overall_score = max(0, min(100, overall_score))
            
            return overall_score
            
        except Exception as e:
            logger.error(f"Error calculating overall score for profile {profile.id}: {e}")
            return 0.0
    
    def _calculate_return_score(self, perf: PerformanceMetrics, criteria: RankingCriteria) -> float:
        """Calculate return-based score"""
        # Base score from annualized return
        return_score = min(perf.annualized_return * 100, 50)  # Cap at 50 points
        
        # Bonus for high Sharpe ratio
        if perf.sharpe_ratio > 2.0:
            return_score += 20
        elif perf.sharpe_ratio > 1.5:
            return_score += 15
        elif perf.sharpe_ratio > 1.0:
            return_score += 10
        elif perf.sharpe_ratio > 0.5:
            return_score += 5
        
        # Bonus for high Calmar ratio
        if perf.calmar_ratio > 3.0:
            return_score += 10
        elif perf.calmar_ratio > 2.0:
            return_score += 5
        
        return min(return_score, 100)
    
    def _calculate_risk_score(self, perf: PerformanceMetrics, criteria: RankingCriteria) -> float:
        """Calculate risk-based score"""
        # Start with perfect score
        risk_score = 100
        
        # Penalty for high drawdown
        if perf.max_drawdown > 0.30:  # 30%
            risk_score -= 30
        elif perf.max_drawdown > 0.20:  # 20%
            risk_score -= 20
        elif perf.max_drawdown > 0.10:  # 10%
            risk_score -= 10
        
        # Penalty for high volatility
        if perf.volatility > 0.50:  # 50%
            risk_score -= 20
        elif perf.volatility > 0.30:  # 30%
            risk_score -= 10
        elif perf.volatility > 0.20:  # 20%
            risk_score -= 5
        
        # Penalty for high VaR
        if perf.var_95 < -0.05:  # -5%
            risk_score -= 15
        elif perf.var_95 < -0.03:  # -3%
            risk_score -= 10
        elif perf.var_95 < -0.02:  # -2%
            risk_score -= 5
        
        return max(risk_score, 0)
    
    def _calculate_consistency_score(self, perf: PerformanceMetrics, criteria: RankingCriteria) -> float:
        """Calculate consistency-based score"""
        # Base consistency score
        consistency_score = perf.consistency_score * 50
        
        # Bonus for high win rate
        if perf.win_rate > 0.70:  # 70%
            consistency_score += 20
        elif perf.win_rate > 0.60:  # 60%
            consistency_score += 15
        elif perf.win_rate > 0.50:  # 50%
            consistency_score += 10
        
        # Bonus for good profit factor
        if perf.profit_factor > 2.0:
            consistency_score += 15
        elif perf.profit_factor > 1.5:
            consistency_score += 10
        elif perf.profit_factor > 1.2:
            consistency_score += 5
        
        # Penalty for high consecutive losses
        if perf.max_consecutive_losses > 10:
            consistency_score -= 20
        elif perf.max_consecutive_losses > 5:
            consistency_score -= 10
        
        return min(consistency_score, 100)
    
    def _calculate_social_score(self, perf: PerformanceMetrics, criteria: RankingCriteria) -> float:
        """Calculate social-based score"""
        social_score = 0
        
        # Follower count score
        if perf.follower_count > 1000:
            social_score += 30
        elif perf.follower_count > 500:
            social_score += 20
        elif perf.follower_count > 100:
            social_score += 10
        elif perf.follower_count > 10:
            social_score += 5
        
        # Rating score
        if perf.average_rating > 4.5:
            social_score += 25
        elif perf.average_rating > 4.0:
            social_score += 20
        elif perf.average_rating > 3.5:
            social_score += 15
        elif perf.average_rating > 3.0:
            social_score += 10
        
        # Assets under management score
        if perf.total_assets_managed > 1000000:  # $1M
            social_score += 20
        elif perf.total_assets_managed > 100000:  # $100K
            social_score += 15
        elif perf.total_assets_managed > 10000:  # $10K
            social_score += 10
        elif perf.total_assets_managed > 1000:  # $1K
            social_score += 5
        
        return min(social_score, 100)
    
    def _apply_penalties(self, score: float, perf: PerformanceMetrics, criteria: RankingCriteria) -> float:
        """Apply penalties for poor performance"""
        # Drawdown penalty
        if perf.max_drawdown > criteria.max_drawdown_threshold:
            penalty = (perf.max_drawdown - criteria.max_drawdown_threshold) * criteria.max_drawdown_penalty * 100
            score -= penalty
        
        # Volatility penalty
        if perf.volatility > 0.30:  # 30%
            penalty = (perf.volatility - 0.30) * criteria.volatility_penalty * 100
            score -= penalty
        
        return max(score, 0)

class MasterTraderDiscovery:
    """Main discovery and ranking system"""
    
    def __init__(self, db_session=None):
        self.db_session = db_session
        self.ranker = MasterTraderRanker()
        self.performance_calculator = PerformanceCalculator()
        
        # Caching
        self.rankings_cache = {}
        self.cache_expiry = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Search filters
        self.available_filters = {
            'strategy_type': [e.value for e in StrategyType],
            'risk_level': [e.value for e in RiskLevel],
            'verification_status': [e.value for e in VerificationStatus],
            'min_track_record': [1, 3, 6, 12, 24, 36],
            'min_followers': [0, 10, 50, 100, 500, 1000],
            'min_rating': [0, 1, 2, 3, 4, 5]
        }
        
        logger.info("Master trader discovery system initialized")
    
    async def discover_traders(
        self,
        search_query: str = "",
        strategy_type: Optional[StrategyType] = None,
        risk_level: Optional[RiskLevel] = None,
        verification_status: Optional[VerificationStatus] = None,
        min_track_record_months: int = 0,
        min_follower_count: int = 0,
        min_rating: float = 0.0,
        max_drawdown: float = 1.0,
        sort_by: str = "overall_score",
        sort_order: str = "desc",
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[MasterTraderProfile], int]:
        """Discover and rank master traders"""
        try:
            # Build ranking criteria
            criteria = RankingCriteria(
                min_track_record_months=min_track_record_months,
                min_follower_count=min_follower_count,
                min_rating=min_rating,
                max_drawdown_threshold=max_drawdown
            )
            
            # Get profiles from database (simplified for demo)
            profiles = await self._get_profiles_from_db(
                search_query, strategy_type, risk_level, verification_status
            )
            
            # Filter profiles
            filtered_profiles = self._filter_profiles(profiles, criteria)
            
            # Calculate scores
            for profile in filtered_profiles:
                profile.performance.overall_score = self.ranker.calculate_overall_score(profile, criteria)
            
            # Sort profiles
            reverse = sort_order == "desc"
            if sort_by == "overall_score":
                filtered_profiles.sort(key=lambda x: x.performance.overall_score, reverse=reverse)
            elif sort_by == "sharpe_ratio":
                filtered_profiles.sort(key=lambda x: x.performance.sharpe_ratio, reverse=reverse)
            elif sort_by == "total_return":
                filtered_profiles.sort(key=lambda x: x.performance.total_return, reverse=reverse)
            elif sort_by == "max_drawdown":
                filtered_profiles.sort(key=lambda x: x.performance.max_drawdown, reverse=not reverse)
            elif sort_by == "follower_count":
                filtered_profiles.sort(key=lambda x: x.performance.follower_count, reverse=reverse)
            elif sort_by == "win_rate":
                filtered_profiles.sort(key=lambda x: x.performance.win_rate, reverse=reverse)
            
            # Apply pagination
            total_count = len(filtered_profiles)
            paginated_profiles = filtered_profiles[offset:offset + limit]
            
            return paginated_profiles, total_count
            
        except Exception as e:
            logger.error(f"Error discovering traders: {e}")
            return [], 0
    
    async def get_trader_rankings(
        self,
        criteria: RankingCriteria,
        limit: int = 100
    ) -> List[MasterTraderProfile]:
        """Get ranked list of traders"""
        try:
            # Check cache
            cache_key = f"rankings_{hash(str(criteria))}"
            if cache_key in self.rankings_cache:
                if time.time() < self.cache_expiry.get(cache_key, 0):
                    return self.rankings_cache[cache_key]
            
            # Get all profiles
            profiles = await self._get_all_profiles()
            
            # Filter and rank
            filtered_profiles = self._filter_profiles(profiles, criteria)
            
            for profile in filtered_profiles:
                profile.performance.overall_score = self.ranker.calculate_overall_score(profile, criteria)
            
            # Sort by overall score
            filtered_profiles.sort(key=lambda x: x.performance.overall_score, reverse=True)
            
            # Cache results
            self.rankings_cache[cache_key] = filtered_profiles[:limit]
            self.cache_expiry[cache_key] = time.time() + self.cache_ttl
            
            return filtered_profiles[:limit]
            
        except Exception as e:
            logger.error(f"Error getting trader rankings: {e}")
            return []
    
    async def get_trader_details(self, trader_id: str) -> Optional[MasterTraderProfile]:
        """Get detailed information about a specific trader"""
        try:
            # This would query the database for specific trader
            # For now, return a placeholder
            return None
            
        except Exception as e:
            logger.error(f"Error getting trader details for {trader_id}: {e}")
            return None
    
    async def update_trader_performance(self, trader_id: str) -> bool:
        """Update performance metrics for a trader"""
        try:
            # This would recalculate all performance metrics
            # and update the database
            logger.info(f"Updated performance for trader {trader_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating performance for trader {trader_id}: {e}")
            return False
    
    def _filter_profiles(
        self, 
        profiles: List[MasterTraderProfile], 
        criteria: RankingCriteria
    ) -> List[MasterTraderProfile]:
        """Filter profiles based on criteria"""
        filtered = []
        
        for profile in profiles:
            # Check minimum track record
            if profile.track_record_months < criteria.min_track_record_months:
                continue
            
            # Check minimum trades
            if profile.performance.total_trades < criteria.min_total_trades:
                continue
            
            # Check maximum drawdown
            if profile.performance.max_drawdown > criteria.max_drawdown_threshold:
                continue
            
            # Check minimum followers
            if profile.performance.follower_count < criteria.min_follower_count:
                continue
            
            # Check minimum rating
            if profile.performance.average_rating < criteria.min_rating:
                continue
            
            # Check verification requirements
            if criteria.require_verification and profile.verification_status != VerificationStatus.VERIFIED:
                continue
            
            if criteria.require_kyc and profile.kyc_status != "verified":
                continue
            
            filtered.append(profile)
        
        return filtered
    
    async def _get_profiles_from_db(
        self,
        search_query: str = "",
        strategy_type: Optional[StrategyType] = None,
        risk_level: Optional[RiskLevel] = None,
        verification_status: Optional[VerificationStatus] = None
    ) -> List[MasterTraderProfile]:
        """Get profiles from database (simplified)"""
        # This would be a real database query
        # For now, return empty list
        return []
    
    async def _get_all_profiles(self) -> List[MasterTraderProfile]:
        """Get all profiles from database"""
        # This would be a real database query
        # For now, return empty list
        return []
    
    async def get_search_suggestions(self, query: str) -> List[str]:
        """Get search suggestions based on query"""
        try:
            # This would query the database for suggestions
            # For now, return empty list
            return []
            
        except Exception as e:
            logger.error(f"Error getting search suggestions: {e}")
            return []
    
    async def get_trending_traders(self, limit: int = 10) -> List[MasterTraderProfile]:
        """Get trending traders based on recent performance"""
        try:
            # This would identify trending traders based on recent performance
            # For now, return empty list
            return []
            
        except Exception as e:
            logger.error(f"Error getting trending traders: {e}")
            return []
    
    async def get_top_performers(
        self, 
        period: str = "30d", 
        limit: int = 10
    ) -> List[MasterTraderProfile]:
        """Get top performers for a specific period"""
        try:
            # This would get top performers for the specified period
            # For now, return empty list
            return []
            
        except Exception as e:
            logger.error(f"Error getting top performers: {e}")
            return []
    
    async def get_risk_adjusted_rankings(
        self, 
        risk_tolerance: str = "moderate",
        limit: int = 50
    ) -> List[MasterTraderProfile]:
        """Get risk-adjusted rankings"""
        try:
            # Adjust criteria based on risk tolerance
            if risk_tolerance == "conservative":
                criteria = RankingCriteria(
                    max_drawdown_threshold=0.10,
                    min_track_record_months=12,
                    require_verification=True
                )
            elif risk_tolerance == "aggressive":
                criteria = RankingCriteria(
                    max_drawdown_threshold=0.50,
                    min_track_record_months=3
                )
            else:  # moderate
                criteria = RankingCriteria(
                    max_drawdown_threshold=0.25,
                    min_track_record_months=6
                )
            
            return await self.get_trader_rankings(criteria, limit)
            
        except Exception as e:
            logger.error(f"Error getting risk-adjusted rankings: {e}")
            return []
    
    async def get_strategy_rankings(
        self, 
        strategy_type: StrategyType,
        limit: int = 20
    ) -> List[MasterTraderProfile]:
        """Get rankings for a specific strategy type"""
        try:
            criteria = RankingCriteria()
            profiles = await self._get_profiles_from_db(strategy_type=strategy_type)
            filtered_profiles = self._filter_profiles(profiles, criteria)
            
            for profile in filtered_profiles:
                profile.performance.overall_score = self.ranker.calculate_overall_score(profile, criteria)
            
            filtered_profiles.sort(key=lambda x: x.performance.overall_score, reverse=True)
            return filtered_profiles[:limit]
            
        except Exception as e:
            logger.error(f"Error getting strategy rankings for {strategy_type}: {e}")
            return []

# Global discovery instance
master_trader_discovery = MasterTraderDiscovery()




