"""
Performance Metrics Calculator using Empyrical

This module provides standardized performance metrics calculation
using the Empyrical library (originally from Quantopian).
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Union

# Try to import empyrical, fall back to manual calculation if not available
try:
    import empyrical as ep
    EMPYRICAL_AVAILABLE = True
except ImportError:
    EMPYRICAL_AVAILABLE = False
    print("Warning: Empyrical not installed. Using fallback metrics calculation.")


def calculate_metrics(
    returns: Union[pd.Series, np.ndarray],
    benchmark_returns: Optional[Union[pd.Series, np.ndarray]] = None,
    risk_free_rate: float = 0.02,
    periods_per_year: int = 252,
) -> Dict[str, float]:
    """
    Calculate comprehensive performance metrics using Empyrical.
    
    Args:
        returns: Daily returns series
        benchmark_returns: Optional benchmark returns for alpha/beta
        risk_free_rate: Annual risk-free rate (default 2%)
        periods_per_year: Trading periods per year (252 for daily)
        
    Returns:
        Dict of metric name to value
    """
    if isinstance(returns, np.ndarray):
        returns = pd.Series(returns)
    
    returns = returns.dropna()
    
    if len(returns) < 2:
        return _empty_metrics()
    
    if EMPYRICAL_AVAILABLE:
        return _calculate_empyrical_metrics(returns, benchmark_returns, risk_free_rate, periods_per_year)
    else:
        return _calculate_fallback_metrics(returns, benchmark_returns, risk_free_rate, periods_per_year)


def _calculate_empyrical_metrics(
    returns: pd.Series,
    benchmark_returns: Optional[pd.Series],
    risk_free_rate: float,
    periods_per_year: int,
) -> Dict[str, float]:
    """Calculate metrics using Empyrical library"""
    
    # Convert risk-free rate to period rate
    period_rf = (1 + risk_free_rate) ** (1 / periods_per_year) - 1
    
    # Basic return metrics
    total_return = ep.cum_returns_final(returns) * 100
    annual_return = ep.annual_return(returns, period='daily', annualization=periods_per_year) * 100
    monthly_return = annual_return / 12
    
    # Volatility metrics
    volatility = ep.annual_volatility(returns, period='daily', annualization=periods_per_year) * 100
    downside_vol = ep.downside_risk(returns, period='daily', annualization=periods_per_year) * 100
    
    # Drawdown
    max_dd = ep.max_drawdown(returns) * 100
    
    # Calculate drawdown duration
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    is_drawdown = drawdown < 0
    
    # Find longest drawdown duration
    max_dd_duration = 0
    current_duration = 0
    for in_dd in is_drawdown:
        if in_dd:
            current_duration += 1
            max_dd_duration = max(max_dd_duration, current_duration)
        else:
            current_duration = 0
    
    # Risk-adjusted returns
    sharpe = ep.sharpe_ratio(returns, risk_free=period_rf, period='daily', annualization=periods_per_year)
    sortino = ep.sortino_ratio(returns, required_return=period_rf, period='daily', annualization=periods_per_year)
    calmar = ep.calmar_ratio(returns, period='daily', annualization=periods_per_year)
    
    # Handle inf/nan
    sharpe = 0.0 if np.isnan(sharpe) or np.isinf(sharpe) else sharpe
    sortino = 0.0 if np.isnan(sortino) or np.isinf(sortino) else sortino
    calmar = 0.0 if np.isnan(calmar) or np.isinf(calmar) else calmar
    
    # Alpha and Beta (if benchmark provided)
    alpha = 0.0
    beta = 1.0
    
    if benchmark_returns is not None and len(benchmark_returns) == len(returns):
        alpha = ep.alpha(returns, benchmark_returns, risk_free=period_rf, period='daily', annualization=periods_per_year)
        beta = ep.beta(returns, benchmark_returns)
        alpha = 0.0 if np.isnan(alpha) else alpha
        beta = 1.0 if np.isnan(beta) else beta
    
    # VaR and CVaR
    var_95 = np.percentile(returns, 5) * 100
    cvar_95 = returns[returns <= np.percentile(returns, 5)].mean() * 100 if len(returns) > 20 else var_95
    
    return {
        'total_return': total_return,
        'annual_return': annual_return,
        'monthly_return': monthly_return,
        'volatility': volatility,
        'downside_volatility': downside_vol,
        'max_drawdown': abs(max_dd),
        'max_drawdown_duration': max_dd_duration,
        'sharpe_ratio': sharpe,
        'sortino_ratio': sortino,
        'calmar_ratio': calmar,
        'alpha': alpha * 100,
        'beta': beta,
        'information_ratio': 0.0,  # Requires benchmark
        'treynor_ratio': 0.0,  # Requires benchmark
        'var_95': abs(var_95),
        'cvar_95': abs(cvar_95) if not np.isnan(cvar_95) else abs(var_95),
    }


def _calculate_fallback_metrics(
    returns: pd.Series,
    benchmark_returns: Optional[pd.Series],
    risk_free_rate: float,
    periods_per_year: int,
) -> Dict[str, float]:
    """Fallback metrics calculation without Empyrical"""
    
    n = len(returns)
    
    # Total return
    cumulative = (1 + returns).prod() - 1
    total_return = cumulative * 100
    
    # Annual return
    years = n / periods_per_year
    annual_return = ((1 + cumulative) ** (1 / max(years, 0.01)) - 1) * 100 if years > 0 else 0
    monthly_return = annual_return / 12
    
    # Volatility
    volatility = returns.std() * np.sqrt(periods_per_year) * 100
    
    # Downside volatility
    negative_returns = returns[returns < 0]
    downside_vol = negative_returns.std() * np.sqrt(periods_per_year) * 100 if len(negative_returns) > 0 else 0
    
    # Max drawdown
    cumulative_returns = (1 + returns).cumprod()
    running_max = cumulative_returns.cummax()
    drawdown = (cumulative_returns - running_max) / running_max
    max_dd = abs(drawdown.min()) * 100
    
    # Drawdown duration
    is_drawdown = drawdown < 0
    max_dd_duration = 0
    current_duration = 0
    for in_dd in is_drawdown:
        if in_dd:
            current_duration += 1
            max_dd_duration = max(max_dd_duration, current_duration)
        else:
            current_duration = 0
    
    # Sharpe ratio
    excess_return = returns.mean() - risk_free_rate / periods_per_year
    sharpe = (excess_return / returns.std() * np.sqrt(periods_per_year)) if returns.std() > 0 else 0
    
    # Sortino ratio
    sortino = (excess_return / negative_returns.std() * np.sqrt(periods_per_year)) if len(negative_returns) > 0 and negative_returns.std() > 0 else 0
    
    # Calmar ratio
    calmar = annual_return / max_dd if max_dd > 0 else 0
    
    # VaR and CVaR
    var_95 = np.percentile(returns, 5) * 100
    cvar_95 = returns[returns <= np.percentile(returns, 5)].mean() * 100 if len(returns) > 20 else var_95
    
    return {
        'total_return': total_return,
        'annual_return': annual_return,
        'monthly_return': monthly_return,
        'volatility': volatility,
        'downside_volatility': downside_vol,
        'max_drawdown': max_dd,
        'max_drawdown_duration': max_dd_duration,
        'sharpe_ratio': sharpe,
        'sortino_ratio': sortino,
        'calmar_ratio': calmar,
        'alpha': 0.0,
        'beta': 1.0,
        'information_ratio': 0.0,
        'treynor_ratio': 0.0,
        'var_95': abs(var_95),
        'cvar_95': abs(cvar_95) if not np.isnan(cvar_95) else abs(var_95),
    }


def _empty_metrics() -> Dict[str, float]:
    """Return empty metrics dict"""
    return {
        'total_return': 0.0,
        'annual_return': 0.0,
        'monthly_return': 0.0,
        'volatility': 0.0,
        'downside_volatility': 0.0,
        'max_drawdown': 0.0,
        'max_drawdown_duration': 0,
        'sharpe_ratio': 0.0,
        'sortino_ratio': 0.0,
        'calmar_ratio': 0.0,
        'alpha': 0.0,
        'beta': 1.0,
        'information_ratio': 0.0,
        'treynor_ratio': 0.0,
        'var_95': 0.0,
        'cvar_95': 0.0,
    }


def calculate_tearsheet(
    returns: pd.Series,
    benchmark_returns: Optional[pd.Series] = None,
    positions: Optional[pd.DataFrame] = None,
    transactions: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """
    Calculate a full tearsheet with all analytics.
    
    Returns a comprehensive dict suitable for UI rendering.
    """
    metrics = calculate_metrics(returns, benchmark_returns)
    
    # Add time series data
    cumulative_returns = (1 + returns).cumprod() - 1
    
    # Rolling metrics (21-day window)
    rolling_sharpe = []
    rolling_vol = []
    
    for i in range(21, len(returns)):
        window = returns.iloc[i-21:i]
        rs = window.mean() / window.std() * np.sqrt(252) if window.std() > 0 else 0
        rv = window.std() * np.sqrt(252) * 100
        rolling_sharpe.append(rs)
        rolling_vol.append(rv)
    
    # Monthly returns
    if hasattr(returns.index, 'to_period'):
        monthly = returns.resample('ME').apply(lambda x: (1 + x).prod() - 1) * 100
    else:
        monthly = pd.Series([])
    
    # Drawdown series
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = ((cumulative - running_max) / running_max) * 100
    
    return {
        'metrics': metrics,
        'cumulative_returns': cumulative_returns.tolist(),
        'rolling_sharpe': rolling_sharpe,
        'rolling_volatility': rolling_vol,
        'monthly_returns': monthly.tolist() if len(monthly) > 0 else [],
        'drawdown': drawdown.tolist(),
        'return_distribution': {
            'mean': returns.mean() * 100,
            'std': returns.std() * 100,
            'skew': returns.skew(),
            'kurtosis': returns.kurtosis(),
            'histogram': np.histogram(returns * 100, bins=50)[0].tolist(),
        }
    }

