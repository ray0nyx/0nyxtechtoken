"""
Multi-Layer Risk Management System
Comprehensive risk controls for copy trading operations
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

from universal_platform_adapters import TradeSignal, OrderSide, Position

logger = logging.getLogger(__name__)

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RiskViolationType(Enum):
    POSITION_SIZE = "position_size"
    DAILY_LOSS = "daily_loss"
    DRAWDOWN = "drawdown"
    CORRELATION = "correlation"
    LEVERAGE = "leverage"
    LIQUIDATION = "liquidation"
    CIRCUIT_BREAKER = "circuit_breaker"
    SLIPPAGE = "slippage"
    VOLATILITY = "volatility"

@dataclass
class RiskViolation:
    """Risk violation record"""
    id: str
    follower_id: str
    violation_type: RiskViolationType
    risk_level: RiskLevel
    current_value: float
    limit_value: float
    violation_percentage: float
    message: str
    timestamp: datetime
    trade_signal: Optional[TradeSignal] = None
    resolved: bool = False
    resolution_action: Optional[str] = None

@dataclass
class RiskLimits:
    """Risk limits for a follower"""
    max_position_size: Optional[float] = None
    max_daily_loss: float = 0.05  # 5%
    max_drawdown: float = 0.20  # 20%
    max_leverage: float = 10.0
    max_correlation: float = 0.80  # 80%
    max_slippage: float = 0.01  # 1%
    max_volatility: float = 0.50  # 50%
    auto_liquidation_threshold: float = 0.80  # 80%
    circuit_breaker_enabled: bool = True
    allowed_instruments: List[str] = field(default_factory=list)
    restricted_instruments: List[str] = field(default_factory=list)

@dataclass
class PortfolioMetrics:
    """Portfolio-level risk metrics"""
    total_value: float
    total_exposure: float
    daily_pnl: float
    total_pnl: float
    current_drawdown: float
    max_drawdown: float
    sharpe_ratio: float
    volatility: float
    correlation_matrix: Dict[str, Dict[str, float]]
    var_95: float  # Value at Risk 95%
    var_99: float  # Value at Risk 99%
    expected_shortfall: float
    beta: float
    alpha: float

@dataclass
class MarketConditions:
    """Current market conditions"""
    volatility_regime: str  # "low", "normal", "high", "extreme"
    liquidity_conditions: str  # "good", "fair", "poor"
    market_stress: float  # 0-1 scale
    correlation_regime: str  # "low", "normal", "high"
    trend_strength: float  # -1 to 1
    momentum: float  # -1 to 1

class RiskCalculator:
    """Calculates various risk metrics"""
    
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
        var = RiskCalculator.calculate_var(returns, confidence_level)
        tail_returns = returns_array[returns_array <= var]
        
        if len(tail_returns) == 0:
            return 0.0
        
        return np.mean(tail_returns)
    
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
    def calculate_max_drawdown(equity_curve: List[float]) -> float:
        """Calculate maximum drawdown"""
        if not equity_curve or len(equity_curve) < 2:
            return 0.0
        
        equity_array = np.array(equity_curve)
        peak = np.maximum.accumulate(equity_array)
        drawdown = (peak - equity_array) / peak
        return np.max(drawdown)
    
    @staticmethod
    def calculate_correlation_matrix(positions: List[Position], price_data: Dict[str, List[float]]) -> Dict[str, Dict[str, float]]:
        """Calculate correlation matrix between positions"""
        correlation_matrix = {}
        
        for pos1 in positions:
            correlation_matrix[pos1.symbol] = {}
            for pos2 in positions:
                if pos1.symbol in price_data and pos2.symbol in price_data:
                    if len(price_data[pos1.symbol]) > 1 and len(price_data[pos2.symbol]) > 1:
                        corr, _ = np.corrcoef(price_data[pos1.symbol], price_data[pos2.symbol])
                        correlation_matrix[pos1.symbol][pos2.symbol] = corr[0, 1] if not np.isnan(corr[0, 1]) else 0.0
                    else:
                        correlation_matrix[pos1.symbol][pos2.symbol] = 0.0
                else:
                    correlation_matrix[pos1.symbol][pos2.symbol] = 0.0
        
        return correlation_matrix
    
    @staticmethod
    def calculate_portfolio_beta(portfolio_returns: List[float], market_returns: List[float]) -> float:
        """Calculate portfolio beta"""
        if not portfolio_returns or not market_returns or len(portfolio_returns) != len(market_returns):
            return 1.0
        
        portfolio_array = np.array(portfolio_returns)
        market_array = np.array(market_returns)
        
        covariance = np.cov(portfolio_array, market_array)[0, 1]
        market_variance = np.var(market_array)
        
        if market_variance == 0:
            return 1.0
        
        return covariance / market_variance

class CircuitBreaker:
    """Circuit breaker for risk management"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 300):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_counts = defaultdict(int)
        self.last_failure_times = {}
        self.circuit_states = defaultdict(lambda: "CLOSED")  # CLOSED, OPEN, HALF_OPEN
        self.risk_violations = defaultdict(int)
    
    def can_execute_trade(self, follower_id: str, signal: TradeSignal) -> Tuple[bool, Optional[str]]:
        """Check if trade can be executed based on circuit breaker"""
        state = self.circuit_states[follower_id]
        
        if state == "CLOSED":
            return True, None
        elif state == "OPEN":
            if follower_id in self.last_failure_times:
                time_since_failure = time.time() - self.last_failure_times[follower_id]
                if time_since_failure > self.recovery_timeout:
                    self.circuit_states[follower_id] = "HALF_OPEN"
                    return True, None
            return False, f"Circuit breaker OPEN for follower {follower_id}"
        elif state == "HALF_OPEN":
            return True, None
        
        return False, f"Unknown circuit breaker state for follower {follower_id}"
    
    def record_risk_violation(self, follower_id: str, violation_type: RiskViolationType):
        """Record a risk violation"""
        self.risk_violations[follower_id] += 1
        self.failure_counts[follower_id] += 1
        self.last_failure_times[follower_id] = time.time()
        
        if self.risk_violations[follower_id] >= self.failure_threshold:
            self.circuit_states[follower_id] = "OPEN"
            logger.warning(f"Circuit breaker opened for follower {follower_id} due to risk violations")
    
    def record_successful_trade(self, follower_id: str):
        """Record a successful trade"""
        self.failure_counts[follower_id] = 0
        if self.circuit_states[follower_id] == "HALF_OPEN":
            self.circuit_states[follower_id] = "CLOSED"
    
    def get_circuit_state(self, follower_id: str) -> str:
        """Get current circuit breaker state"""
        return self.circuit_states[follower_id]

class RiskManager:
    """Main risk management system"""
    
    def __init__(self, db_session=None):
        self.db_session = db_session
        self.circuit_breaker = CircuitBreaker()
        self.risk_calculator = RiskCalculator()
        
        # Risk limits cache
        self.risk_limits_cache: Dict[str, RiskLimits] = {}
        self.cache_expiry = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Portfolio metrics cache
        self.portfolio_metrics_cache: Dict[str, PortfolioMetrics] = {}
        self.market_conditions_cache: Optional[MarketConditions] = None
        
        # Risk violation history
        self.violation_history: deque = deque(maxlen=10000)
        
        # Market data for risk calculations
        self.price_data: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.return_data: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        logger.info("Risk management system initialized")
    
    async def validate_trade(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        current_positions: List[Position],
        account_balance: float
    ) -> Tuple[bool, List[RiskViolation]]:
        """Validate a trade against all risk limits"""
        violations = []
        
        try:
            # Get risk limits
            risk_limits = await self._get_risk_limits(follower_id)
            
            # Check circuit breaker
            can_execute, circuit_message = self.circuit_breaker.can_execute_trade(follower_id, signal)
            if not can_execute:
                violations.append(RiskViolation(
                    id=f"circuit_{int(time.time())}",
                    follower_id=follower_id,
                    violation_type=RiskViolationType.CIRCUIT_BREAKER,
                    risk_level=RiskLevel.HIGH,
                    current_value=0,
                    limit_value=0,
                    violation_percentage=0,
                    message=circuit_message,
                    timestamp=datetime.now(),
                    trade_signal=signal
                ))
                return False, violations
            
            # Check position size limits
            position_violation = await self._check_position_size_limits(
                follower_id, signal, risk_limits, account_balance
            )
            if position_violation:
                violations.append(position_violation)
            
            # Check daily loss limits
            daily_loss_violation = await self._check_daily_loss_limits(
                follower_id, signal, risk_limits
            )
            if daily_loss_violation:
                violations.append(daily_loss_violation)
            
            # Check drawdown limits
            drawdown_violation = await self._check_drawdown_limits(
                follower_id, signal, risk_limits, current_positions
            )
            if drawdown_violation:
                violations.append(drawdown_violation)
            
            # Check correlation limits
            correlation_violation = await self._check_correlation_limits(
                follower_id, signal, risk_limits, current_positions
            )
            if correlation_violation:
                violations.append(correlation_violation)
            
            # Check leverage limits
            leverage_violation = await self._check_leverage_limits(
                follower_id, signal, risk_limits, account_balance
            )
            if leverage_violation:
                violations.append(leverage_violation)
            
            # Check instrument restrictions
            instrument_violation = await self._check_instrument_restrictions(
                follower_id, signal, risk_limits
            )
            if instrument_violation:
                violations.append(instrument_violation)
            
            # Check slippage limits
            slippage_violation = await self._check_slippage_limits(
                follower_id, signal, risk_limits
            )
            if slippage_violation:
                violations.append(slippage_violation)
            
            # Check volatility limits
            volatility_violation = await self._check_volatility_limits(
                follower_id, signal, risk_limits
            )
            if volatility_violation:
                violations.append(volatility_violation)
            
            # Record violations
            for violation in violations:
                self.violation_history.append(violation)
                self.circuit_breaker.record_risk_violation(follower_id, violation.violation_type)
            
            # Trade is valid if no violations
            is_valid = len(violations) == 0
            
            if is_valid:
                self.circuit_breaker.record_successful_trade(follower_id)
            
            return is_valid, violations
            
        except Exception as e:
            logger.error(f"Error validating trade for follower {follower_id}: {e}")
            return False, [RiskViolation(
                id=f"error_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.POSITION_SIZE,
                risk_level=RiskLevel.CRITICAL,
                current_value=0,
                limit_value=0,
                violation_percentage=0,
                message=f"Risk validation error: {str(e)}",
                timestamp=datetime.now(),
                trade_signal=signal
            )]
    
    async def _get_risk_limits(self, follower_id: str) -> RiskLimits:
        """Get risk limits for a follower"""
        # Check cache first
        if follower_id in self.risk_limits_cache:
            if follower_id in self.cache_expiry:
                if time.time() < self.cache_expiry[follower_id]:
                    return self.risk_limits_cache[follower_id]
        
        # Load from database
        try:
            # This would be a database query in a real implementation
            # For now, return default limits
            risk_limits = RiskLimits()
            self.risk_limits_cache[follower_id] = risk_limits
            self.cache_expiry[follower_id] = time.time() + self.cache_ttl
            return risk_limits
            
        except Exception as e:
            logger.error(f"Error loading risk limits for follower {follower_id}: {e}")
            return RiskLimits()  # Return default limits
    
    async def _check_position_size_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits,
        account_balance: float
    ) -> Optional[RiskViolation]:
        """Check position size limits"""
        if risk_limits.max_position_size is None:
            return None
        
        position_value = signal.quantity * (signal.price or 0)
        max_position_value = account_balance * risk_limits.max_position_size
        
        if position_value > max_position_value:
            violation_percentage = (position_value / max_position_value - 1) * 100
            return RiskViolation(
                id=f"pos_size_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.POSITION_SIZE,
                risk_level=RiskLevel.HIGH if violation_percentage > 50 else RiskLevel.MEDIUM,
                current_value=position_value,
                limit_value=max_position_value,
                violation_percentage=violation_percentage,
                message=f"Position size {position_value:.2f} exceeds limit {max_position_value:.2f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_daily_loss_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits
    ) -> Optional[RiskViolation]:
        """Check daily loss limits"""
        # This would calculate actual daily P&L from database
        # For now, use a simplified calculation
        daily_pnl = 0.0  # Would be calculated from actual trades
        
        max_daily_loss = risk_limits.max_daily_loss
        if daily_pnl < -max_daily_loss:
            violation_percentage = abs(daily_pnl / max_daily_loss - 1) * 100
            return RiskViolation(
                id=f"daily_loss_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.DAILY_LOSS,
                risk_level=RiskLevel.CRITICAL,
                current_value=abs(daily_pnl),
                limit_value=max_daily_loss,
                violation_percentage=violation_percentage,
                message=f"Daily loss {abs(daily_pnl):.4f} exceeds limit {max_daily_loss:.4f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_drawdown_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits,
        current_positions: List[Position]
    ) -> Optional[RiskViolation]:
        """Check drawdown limits"""
        # Calculate current drawdown
        # This would use actual portfolio value history
        current_drawdown = 0.0  # Would be calculated from actual data
        
        if current_drawdown > risk_limits.max_drawdown:
            violation_percentage = (current_drawdown / risk_limits.max_drawdown - 1) * 100
            return RiskViolation(
                id=f"drawdown_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.DRAWDOWN,
                risk_level=RiskLevel.HIGH,
                current_value=current_drawdown,
                limit_value=risk_limits.max_drawdown,
                violation_percentage=violation_percentage,
                message=f"Current drawdown {current_drawdown:.4f} exceeds limit {risk_limits.max_drawdown:.4f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_correlation_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits,
        current_positions: List[Position]
    ) -> Optional[RiskViolation]:
        """Check correlation limits"""
        if not current_positions:
            return None
        
        # Calculate correlation with existing positions
        # This is simplified - in reality would use historical price data
        max_correlation = 0.0
        for position in current_positions:
            if position.symbol == signal.symbol:
                # Same symbol = 100% correlation
                max_correlation = 1.0
                break
        
        if max_correlation > risk_limits.max_correlation:
            violation_percentage = (max_correlation / risk_limits.max_correlation - 1) * 100
            return RiskViolation(
                id=f"correlation_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.CORRELATION,
                risk_level=RiskLevel.MEDIUM,
                current_value=max_correlation,
                limit_value=risk_limits.max_correlation,
                violation_percentage=violation_percentage,
                message=f"Correlation {max_correlation:.4f} exceeds limit {risk_limits.max_correlation:.4f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_leverage_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits,
        account_balance: float
    ) -> Optional[RiskViolation]:
        """Check leverage limits"""
        if signal.leverage > risk_limits.max_leverage:
            violation_percentage = (signal.leverage / risk_limits.max_leverage - 1) * 100
            return RiskViolation(
                id=f"leverage_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.LEVERAGE,
                risk_level=RiskLevel.HIGH,
                current_value=signal.leverage,
                limit_value=risk_limits.max_leverage,
                violation_percentage=violation_percentage,
                message=f"Leverage {signal.leverage:.2f} exceeds limit {risk_limits.max_leverage:.2f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_instrument_restrictions(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits
    ) -> Optional[RiskViolation]:
        """Check instrument restrictions"""
        # Check if instrument is restricted
        if signal.symbol in risk_limits.restricted_instruments:
            return RiskViolation(
                id=f"instrument_restricted_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.POSITION_SIZE,
                risk_level=RiskLevel.HIGH,
                current_value=0,
                limit_value=0,
                violation_percentage=0,
                message=f"Instrument {signal.symbol} is restricted",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        # Check if only allowed instruments are permitted
        if risk_limits.allowed_instruments and signal.symbol not in risk_limits.allowed_instruments:
            return RiskViolation(
                id=f"instrument_not_allowed_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.POSITION_SIZE,
                risk_level=RiskLevel.HIGH,
                current_value=0,
                limit_value=0,
                violation_percentage=0,
                message=f"Instrument {signal.symbol} not in allowed list",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_slippage_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits
    ) -> Optional[RiskViolation]:
        """Check slippage limits"""
        # This would calculate actual slippage based on market conditions
        # For now, use a simplified calculation
        estimated_slippage = 0.001  # 0.1% estimated slippage
        
        if estimated_slippage > risk_limits.max_slippage:
            violation_percentage = (estimated_slippage / risk_limits.max_slippage - 1) * 100
            return RiskViolation(
                id=f"slippage_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.SLIPPAGE,
                risk_level=RiskLevel.MEDIUM,
                current_value=estimated_slippage,
                limit_value=risk_limits.max_slippage,
                violation_percentage=violation_percentage,
                message=f"Estimated slippage {estimated_slippage:.4f} exceeds limit {risk_limits.max_slippage:.4f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def _check_volatility_limits(
        self, 
        follower_id: str, 
        signal: TradeSignal, 
        risk_limits: RiskLimits
    ) -> Optional[RiskViolation]:
        """Check volatility limits"""
        # This would calculate actual volatility from price data
        # For now, use a simplified calculation
        estimated_volatility = 0.20  # 20% estimated volatility
        
        if estimated_volatility > risk_limits.max_volatility:
            violation_percentage = (estimated_volatility / risk_limits.max_volatility - 1) * 100
            return RiskViolation(
                id=f"volatility_{int(time.time())}",
                follower_id=follower_id,
                violation_type=RiskViolationType.VOLATILITY,
                risk_level=RiskLevel.MEDIUM,
                current_value=estimated_volatility,
                limit_value=risk_limits.max_volatility,
                violation_percentage=violation_percentage,
                message=f"Estimated volatility {estimated_volatility:.4f} exceeds limit {risk_limits.max_volatility:.4f}",
                timestamp=datetime.now(),
                trade_signal=signal
            )
        
        return None
    
    async def calculate_position_size(
        self, 
        follower_id: str, 
        master_trade_size: float, 
        master_performance: Dict[str, float],
        risk_limits: RiskLimits,
        account_balance: float
    ) -> float:
        """Calculate optimal position size using Kelly Criterion and risk limits"""
        try:
            # Get master trader performance metrics
            win_rate = master_performance.get('win_rate', 0.5)
            avg_win = master_performance.get('avg_win', 0.02)
            avg_loss = master_performance.get('avg_loss', 0.01)
            sharpe_ratio = master_performance.get('sharpe_ratio', 0.0)
            
            # Calculate Kelly fraction
            if avg_loss > 0 and win_rate > 0 and win_rate < 1:
                b = avg_win / avg_loss
                p = win_rate
                q = 1 - win_rate
                kelly_fraction = (b * p - q) / b
                kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
            else:
                kelly_fraction = 0.01  # Default 1%
            
            # Adjust for Sharpe ratio
            if sharpe_ratio > 0:
                kelly_fraction *= min(sharpe_ratio / 2.0, 1.0)  # Scale by Sharpe ratio
            
            # Calculate position size
            position_size = account_balance * kelly_fraction * (master_trade_size / 10000)  # Scale by master trade size
            
            # Apply risk limits
            if risk_limits.max_position_size:
                max_position_value = account_balance * risk_limits.max_position_size
                position_size = min(position_size, max_position_value)
            
            # Ensure minimum viable position
            min_position = account_balance * 0.001  # 0.1% minimum
            position_size = max(position_size, min_position)
            
            return position_size
            
        except Exception as e:
            logger.error(f"Error calculating position size for follower {follower_id}: {e}")
            return account_balance * 0.01  # Default 1% of balance
    
    async def get_portfolio_metrics(self, follower_id: str) -> PortfolioMetrics:
        """Calculate portfolio-level risk metrics"""
        try:
            # This would load actual portfolio data from database
            # For now, return placeholder metrics
            return PortfolioMetrics(
                total_value=10000.0,
                total_exposure=5000.0,
                daily_pnl=100.0,
                total_pnl=1000.0,
                current_drawdown=0.05,
                max_drawdown=0.15,
                sharpe_ratio=1.5,
                volatility=0.20,
                correlation_matrix={},
                var_95=0.02,
                var_99=0.03,
                expected_shortfall=0.025,
                beta=1.0,
                alpha=0.02
            )
            
        except Exception as e:
            logger.error(f"Error calculating portfolio metrics for follower {follower_id}: {e}")
            return PortfolioMetrics(
                total_value=0.0,
                total_exposure=0.0,
                daily_pnl=0.0,
                total_pnl=0.0,
                current_drawdown=0.0,
                max_drawdown=0.0,
                sharpe_ratio=0.0,
                volatility=0.0,
                correlation_matrix={},
                var_95=0.0,
                var_99=0.0,
                expected_shortfall=0.0,
                beta=0.0,
                alpha=0.0
            )
    
    async def get_risk_violations(
        self, 
        follower_id: str = None, 
        violation_type: RiskViolationType = None,
        limit: int = 100
    ) -> List[RiskViolation]:
        """Get risk violations"""
        violations = list(self.violation_history)
        
        # Filter by follower
        if follower_id:
            violations = [v for v in violations if v.follower_id == follower_id]
        
        # Filter by violation type
        if violation_type:
            violations = [v for v in violations if v.violation_type == violation_type]
        
        # Sort by timestamp (newest first)
        violations.sort(key=lambda x: x.timestamp, reverse=True)
        
        return violations[:limit]
    
    async def get_circuit_breaker_status(self, follower_id: str) -> Dict[str, Any]:
        """Get circuit breaker status for a follower"""
        state = self.circuit_breaker.get_circuit_state(follower_id)
        violations = await self.get_risk_violations(follower_id, limit=10)
        
        return {
            'follower_id': follower_id,
            'circuit_state': state,
            'recent_violations': len(violations),
            'can_execute_trades': state in ['CLOSED', 'HALF_OPEN'],
            'last_violation': violations[0].timestamp.isoformat() if violations else None
        }
    
    async def reset_circuit_breaker(self, follower_id: str) -> bool:
        """Reset circuit breaker for a follower"""
        try:
            self.circuit_breaker.circuit_states[follower_id] = "CLOSED"
            self.circuit_breaker.failure_counts[follower_id] = 0
            self.circuit_breaker.risk_violations[follower_id] = 0
            logger.info(f"Reset circuit breaker for follower {follower_id}")
            return True
        except Exception as e:
            logger.error(f"Error resetting circuit breaker for follower {follower_id}: {e}")
            return False

# Global risk manager instance
risk_manager = RiskManager()




