"""
Metrics calculator service for backtest performance analysis
"""

import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from scipy import stats
from datetime import datetime, timedelta

from models.backtest_models import BacktestMetrics, Trade, PortfolioValue

logger = logging.getLogger(__name__)

class MetricsCalculator:
    """Service for calculating backtest performance metrics"""
    
    def __init__(self):
        self.risk_free_rate = 0.02  # 2% annual risk-free rate
    
    async def calculate_metrics(
        self,
        trades: List[Dict[str, Any]],
        portfolio_values: List[Dict[str, Any]],
        benchmark_data: List[Dict[str, Any]] = None
    ) -> BacktestMetrics:
        """Calculate comprehensive backtest metrics"""
        logger.info("Calculating backtest metrics")
        
        try:
            # Convert to DataFrames for easier calculation
            trades_df = pd.DataFrame(trades) if trades else pd.DataFrame()
            portfolio_df = pd.DataFrame(portfolio_values) if portfolio_values else pd.DataFrame()
            benchmark_df = pd.DataFrame(benchmark_data) if benchmark_data else pd.DataFrame()
            
            # Calculate basic metrics
            total_return = self._calculate_total_return(portfolio_df)
            annualized_return = self._calculate_annualized_return(portfolio_df)
            cagr = self._calculate_cagr(portfolio_df)
            
            # Calculate risk metrics
            volatility = self._calculate_volatility(portfolio_df)
            max_drawdown, max_drawdown_duration = self._calculate_max_drawdown(portfolio_df)
            var_95, var_99, expected_shortfall = self._calculate_var_metrics(portfolio_df)
            
            # Calculate risk-adjusted metrics
            sharpe_ratio = self._calculate_sharpe_ratio(portfolio_df)
            sortino_ratio = self._calculate_sortino_ratio(portfolio_df)
            calmar_ratio = self._calculate_calmar_ratio(portfolio_df)
            
            # Calculate benchmark comparison metrics
            alpha, beta, tracking_error, information_ratio = self._calculate_benchmark_metrics(
                portfolio_df, benchmark_df
            )
            
            # Calculate trade statistics
            trade_stats = self._calculate_trade_statistics(trades_df)
            
            # Calculate additional metrics
            turnover = self._calculate_turnover(trades_df)
            exposure = self._calculate_exposure(portfolio_df)
            concentration = self._calculate_concentration(portfolio_df)
            
            return BacktestMetrics(
                # Return metrics
                total_return=total_return,
                annualized_return=annualized_return,
                cagr=cagr,
                
                # Risk metrics
                volatility=volatility,
                max_drawdown=max_drawdown,
                max_drawdown_duration=max_drawdown_duration,
                var_95=var_95,
                var_99=var_99,
                expected_shortfall=expected_shortfall,
                
                # Risk-adjusted metrics
                sharpe_ratio=sharpe_ratio,
                sortino_ratio=sortino_ratio,
                calmar_ratio=calmar_ratio,
                information_ratio=information_ratio,
                
                # Benchmark comparison
                alpha=alpha,
                beta=beta,
                tracking_error=tracking_error,
                
                # Trade statistics
                total_trades=trade_stats['total_trades'],
                winning_trades=trade_stats['winning_trades'],
                losing_trades=trade_stats['losing_trades'],
                win_rate=trade_stats['win_rate'],
                profit_factor=trade_stats['profit_factor'],
                expectancy=trade_stats['expectancy'],
                avg_win=trade_stats['avg_win'],
                avg_loss=trade_stats['avg_loss'],
                largest_win=trade_stats['largest_win'],
                largest_loss=trade_stats['largest_loss'],
                
                # Additional metrics
                turnover=turnover,
                exposure=exposure,
                concentration=concentration
            )
            
        except Exception as e:
            logger.error(f"Failed to calculate metrics: {e}")
            raise
    
    def _calculate_total_return(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate total return"""
        if portfolio_df.empty:
            return 0.0
        
        initial_value = portfolio_df.iloc[0]['value']
        final_value = portfolio_df.iloc[-1]['value']
        
        return (final_value - initial_value) / initial_value
    
    def _calculate_annualized_return(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate annualized return"""
        if portfolio_df.empty:
            return 0.0
        
        total_return = self._calculate_total_return(portfolio_df)
        
        # Calculate time period in years
        start_date = pd.to_datetime(portfolio_df.iloc[0]['time'])
        end_date = pd.to_datetime(portfolio_df.iloc[-1]['time'])
        years = (end_date - start_date).days / 365.25
        
        if years <= 0:
            return 0.0
        
        return (1 + total_return) ** (1 / years) - 1
    
    def _calculate_cagr(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate Compound Annual Growth Rate"""
        return self._calculate_annualized_return(portfolio_df)
    
    def _calculate_volatility(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate volatility (standard deviation of returns)"""
        if portfolio_df.empty or len(portfolio_df) < 2:
            return 0.0
        
        # Calculate daily returns
        portfolio_df['returns'] = portfolio_df['value'].pct_change()
        returns = portfolio_df['returns'].dropna()
        
        if returns.empty:
            return 0.0
        
        # Annualize volatility
        return returns.std() * np.sqrt(252)
    
    def _calculate_max_drawdown(self, portfolio_df: pd.DataFrame) -> tuple:
        """Calculate maximum drawdown and duration"""
        if portfolio_df.empty:
            return 0.0, 0
        
        values = portfolio_df['value'].values
        peak = np.maximum.accumulate(values)
        drawdown = (values - peak) / peak
        
        max_drawdown = np.min(drawdown)
        
        # Calculate max drawdown duration
        max_duration = 0
        current_duration = 0
        
        for dd in drawdown:
            if dd < 0:
                current_duration += 1
                max_duration = max(max_duration, current_duration)
            else:
                current_duration = 0
        
        return max_drawdown, max_duration
    
    def _calculate_var_metrics(self, portfolio_df: pd.DataFrame) -> tuple:
        """Calculate Value at Risk metrics"""
        if portfolio_df.empty or len(portfolio_df) < 2:
            return 0.0, 0.0, 0.0
        
        # Calculate daily returns
        portfolio_df['returns'] = portfolio_df['value'].pct_change()
        returns = portfolio_df['returns'].dropna()
        
        if returns.empty:
            return 0.0, 0.0, 0.0
        
        # Calculate VaR
        var_95 = np.percentile(returns, 5)
        var_99 = np.percentile(returns, 1)
        
        # Calculate Expected Shortfall (CVaR)
        expected_shortfall = returns[returns <= var_95].mean()
        
        return var_95, var_99, expected_shortfall
    
    def _calculate_sharpe_ratio(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate Sharpe ratio"""
        if portfolio_df.empty or len(portfolio_df) < 2:
            return 0.0
        
        # Calculate daily returns
        portfolio_df['returns'] = portfolio_df['value'].pct_change()
        returns = portfolio_df['returns'].dropna()
        
        if returns.empty:
            return 0.0
        
        # Calculate excess returns
        excess_returns = returns - self.risk_free_rate / 252
        
        # Calculate Sharpe ratio
        if returns.std() == 0:
            return 0.0
        
        return np.sqrt(252) * excess_returns.mean() / returns.std()
    
    def _calculate_sortino_ratio(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate Sortino ratio"""
        if portfolio_df.empty or len(portfolio_df) < 2:
            return 0.0
        
        # Calculate daily returns
        portfolio_df['returns'] = portfolio_df['value'].pct_change()
        returns = portfolio_df['returns'].dropna()
        
        if returns.empty:
            return 0.0
        
        # Calculate excess returns
        excess_returns = returns - self.risk_free_rate / 252
        
        # Calculate downside deviation
        downside_returns = returns[returns < 0]
        downside_std = downside_returns.std() if len(downside_returns) > 0 else 0
        
        if downside_std == 0:
            return 0.0
        
        return np.sqrt(252) * excess_returns.mean() / downside_std
    
    def _calculate_calmar_ratio(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate Calmar ratio"""
        if portfolio_df.empty:
            return 0.0
        
        annualized_return = self._calculate_annualized_return(portfolio_df)
        max_drawdown, _ = self._calculate_max_drawdown(portfolio_df)
        
        if max_drawdown == 0:
            return 0.0
        
        return annualized_return / abs(max_drawdown)
    
    def _calculate_benchmark_metrics(
        self, 
        portfolio_df: pd.DataFrame, 
        benchmark_df: pd.DataFrame
    ) -> tuple:
        """Calculate benchmark comparison metrics"""
        if portfolio_df.empty or benchmark_df.empty:
            return 0.0, 0.0, 0.0, 0.0
        
        # Calculate returns for both portfolio and benchmark
        portfolio_df['returns'] = portfolio_df['value'].pct_change()
        benchmark_df['returns'] = benchmark_df['value'].pct_change()
        
        # Align data by time
        merged = pd.merge(
            portfolio_df[['time', 'returns']], 
            benchmark_df[['time', 'returns']], 
            on='time', 
            suffixes=('_portfolio', '_benchmark')
        )
        
        portfolio_returns = merged['returns_portfolio'].dropna()
        benchmark_returns = merged['returns_benchmark'].dropna()
        
        if len(portfolio_returns) < 2 or len(benchmark_returns) < 2:
            return 0.0, 0.0, 0.0, 0.0
        
        # Calculate beta
        covariance = np.cov(portfolio_returns, benchmark_returns)[0, 1]
        benchmark_variance = np.var(benchmark_returns)
        beta = covariance / benchmark_variance if benchmark_variance > 0 else 0
        
        # Calculate alpha
        portfolio_mean = portfolio_returns.mean()
        benchmark_mean = benchmark_returns.mean()
        alpha = portfolio_mean - beta * benchmark_mean
        
        # Calculate tracking error
        tracking_error = np.std(portfolio_returns - benchmark_returns)
        
        # Calculate information ratio
        information_ratio = alpha / tracking_error if tracking_error > 0 else 0
        
        return alpha, beta, tracking_error, information_ratio
    
    def _calculate_trade_statistics(self, trades_df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate trade statistics"""
        if trades_df.empty:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0.0,
                'profit_factor': 0.0,
                'expectancy': 0.0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'largest_win': 0.0,
                'largest_loss': 0.0
            }
        
        # Calculate P&L for each trade (simplified)
        trades_df['pnl'] = 0.0  # Would need to calculate based on entry/exit prices
        
        winning_trades = trades_df[trades_df['pnl'] > 0]
        losing_trades = trades_df[trades_df['pnl'] < 0]
        
        total_trades = len(trades_df)
        winning_count = len(winning_trades)
        losing_count = len(losing_trades)
        
        win_rate = winning_count / total_trades if total_trades > 0 else 0
        
        # Calculate profit factor
        total_wins = winning_trades['pnl'].sum() if not winning_trades.empty else 0
        total_losses = abs(losing_trades['pnl'].sum()) if not losing_trades.empty else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        
        # Calculate expectancy
        expectancy = trades_df['pnl'].mean() if not trades_df.empty else 0
        
        # Calculate averages
        avg_win = winning_trades['pnl'].mean() if not winning_trades.empty else 0
        avg_loss = losing_trades['pnl'].mean() if not losing_trades.empty else 0
        
        # Calculate extremes
        largest_win = winning_trades['pnl'].max() if not winning_trades.empty else 0
        largest_loss = losing_trades['pnl'].min() if not losing_trades.empty else 0
        
        return {
            'total_trades': total_trades,
            'winning_trades': winning_count,
            'losing_trades': losing_count,
            'win_rate': win_rate,
            'profit_factor': profit_factor,
            'expectancy': expectancy,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'largest_win': largest_win,
            'largest_loss': largest_loss
        }
    
    def _calculate_turnover(self, trades_df: pd.DataFrame) -> float:
        """Calculate portfolio turnover"""
        if trades_df.empty:
            return 0.0
        
        # Calculate turnover as sum of absolute trade values
        total_turnover = trades_df['quantity'].abs().sum()
        
        return total_turnover
    
    def _calculate_exposure(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate average market exposure"""
        if portfolio_df.empty:
            return 0.0
        
        # Calculate exposure as ratio of invested capital to total capital
        if 'holdings' in portfolio_df.columns:
            # Would need to calculate from holdings data
            return 0.5  # Placeholder
        
        return 0.0
    
    def _calculate_concentration(self, portfolio_df: pd.DataFrame) -> float:
        """Calculate portfolio concentration (Herfindahl index)"""
        if portfolio_df.empty:
            return 0.0
        
        # Would need to calculate from holdings data
        # For now, return a placeholder
        return 0.0
