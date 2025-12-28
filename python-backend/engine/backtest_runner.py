"""
Backtest Runner - Orchestrates backtesting with the Rust engine
"""

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
import pandas as pd
import numpy as np

from .metrics import calculate_metrics


@dataclass
class BacktestConfig:
    """Configuration for a backtest run"""
    initial_capital: float = 100000.0
    start_date: str = "2023-01-01"
    end_date: str = "2024-01-01"
    symbols: List[str] = field(default_factory=lambda: ["BTC/USDT"])
    timeframe: str = "1h"
    maker_fee: float = 0.001
    taker_fee: float = 0.001
    slippage_pct: float = 0.0005
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "initial_capital": self.initial_capital,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "symbols": self.symbols,
            "timeframe": self.timeframe,
            "maker_fee": self.maker_fee,
            "taker_fee": self.taker_fee,
            "slippage_pct": self.slippage_pct,
        }


@dataclass
class BacktestResult:
    """Results from a backtest run"""
    # Return metrics
    total_return: float = 0.0
    annual_return: float = 0.0
    monthly_return: float = 0.0
    
    # Risk metrics
    volatility: float = 0.0
    downside_volatility: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_duration: int = 0
    
    # Risk-adjusted metrics
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    
    # Market metrics
    alpha: float = 0.0
    beta: float = 0.0
    information_ratio: float = 0.0
    treynor_ratio: float = 0.0
    
    # Risk measures
    var_95: float = 0.0
    cvar_95: float = 0.0
    
    # Trade statistics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    consecutive_wins: int = 0
    consecutive_losses: int = 0
    
    # Equity curve
    equity_curve: List[float] = field(default_factory=list)
    timestamps: List[str] = field(default_factory=list)
    
    # Trade history
    trades: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_return": self.total_return,
            "annual_return": self.annual_return,
            "monthly_return": self.monthly_return,
            "volatility": self.volatility,
            "downside_volatility": self.downside_volatility,
            "max_drawdown": self.max_drawdown,
            "max_drawdown_duration": self.max_drawdown_duration,
            "sharpe_ratio": self.sharpe_ratio,
            "sortino_ratio": self.sortino_ratio,
            "calmar_ratio": self.calmar_ratio,
            "alpha": self.alpha,
            "beta": self.beta,
            "information_ratio": self.information_ratio,
            "treynor_ratio": self.treynor_ratio,
            "var_95": self.var_95,
            "cvar_95": self.cvar_95,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": self.win_rate,
            "profit_factor": self.profit_factor,
            "average_win": self.average_win,
            "average_loss": self.average_loss,
            "largest_win": self.largest_win,
            "largest_loss": self.largest_loss,
            "consecutive_wins": self.consecutive_wins,
            "consecutive_losses": self.consecutive_losses,
            "equity_curve": self.equity_curve,
            "timestamps": self.timestamps,
            "trades": self.trades,
        }


class BacktestRunner:
    """
    Runs backtests using the Rust engine with Python strategy execution.
    
    This class provides:
    - Integration with the Rust backtest engine
    - Python strategy execution
    - Real-time progress updates via callbacks
    - Empyrical metrics calculation
    """
    
    def __init__(self, config: BacktestConfig):
        self.config = config
        self._progress_callback: Optional[Callable[[float, float], None]] = None
        self._equity_callback: Optional[Callable[[float, float, List[float]], None]] = None
        self._trade_callback: Optional[Callable[[Dict[str, Any]], None]] = None
        self._is_running = False
        self._current_progress = 0.0
        self._current_equity = config.initial_capital
        
    def set_progress_callback(self, callback: Callable[[float, float], None]):
        """Set callback for progress updates: callback(progress_pct, current_equity)"""
        self._progress_callback = callback
        
    def set_equity_callback(self, callback: Callable[[float, float, List[float]], None]):
        """Set callback for equity updates: callback(timestamp, equity, equity_curve)"""
        self._equity_callback = callback
        
    def set_trade_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """Set callback for trade execution: callback(trade_dict)"""
        self._trade_callback = callback
    
    async def run_backtest(
        self,
        data: pd.DataFrame,
        strategy_func: Callable[[pd.DataFrame], pd.Series],
        benchmark_returns: Optional[pd.Series] = None,
    ) -> BacktestResult:
        """
        Run a backtest with the given data and strategy.
        
        Args:
            data: OHLCV DataFrame with columns: timestamp, open, high, low, close, volume
            strategy_func: Function that takes OHLCV data and returns signals (-1, 0, 1)
            benchmark_returns: Optional benchmark returns for alpha/beta calculation
            
        Returns:
            BacktestResult with all metrics
        """
        self._is_running = True
        self._current_progress = 0.0
        self._current_equity = self.config.initial_capital
        
        try:
            # Generate signals from strategy
            signals = strategy_func(data)
            
            # Run the backtest simulation
            result = await self._simulate_backtest(data, signals, benchmark_returns)
            
            return result
            
        finally:
            self._is_running = False
    
    async def _simulate_backtest(
        self,
        data: pd.DataFrame,
        signals: pd.Series,
        benchmark_returns: Optional[pd.Series] = None,
    ) -> BacktestResult:
        """Simulate the backtest with given signals"""
        
        # Initialize tracking
        cash = self.config.initial_capital
        position = 0.0
        avg_price = 0.0
        equity_curve = [cash]
        timestamps = [data.iloc[0]['timestamp'] if 'timestamp' in data.columns else str(data.index[0])]
        trades = []
        realized_pnl = 0.0
        
        n_bars = len(data)
        
        for i in range(len(data)):
            row = data.iloc[i]
            price = row['close']
            signal = signals.iloc[i] if i < len(signals) else 0
            
            timestamp = row['timestamp'] if 'timestamp' in data.columns else str(data.index[i])
            
            # Execute trades based on signals
            if signal == 1 and position <= 0:  # Buy
                if position < 0:  # Close short
                    pnl = (avg_price - price) * abs(position)
                    cash += pnl - abs(position) * price * self.config.taker_fee
                    realized_pnl += pnl
                    trades.append({
                        'timestamp': timestamp,
                        'side': 'buy_to_close',
                        'quantity': abs(position),
                        'price': price,
                        'pnl': pnl,
                    })
                    position = 0
                
                # Open long
                size = (cash * 0.95) / price  # Use 95% of capital
                fee = size * price * self.config.taker_fee
                cash -= size * price + fee
                position = size
                avg_price = price
                trades.append({
                    'timestamp': timestamp,
                    'side': 'buy',
                    'quantity': size,
                    'price': price,
                    'fee': fee,
                })
                
                if self._trade_callback:
                    self._trade_callback(trades[-1])
                    
            elif signal == -1 and position > 0:  # Sell
                pnl = (price - avg_price) * position
                fee = position * price * self.config.taker_fee
                cash += position * price - fee
                realized_pnl += pnl
                trades.append({
                    'timestamp': timestamp,
                    'side': 'sell',
                    'quantity': position,
                    'price': price,
                    'pnl': pnl,
                    'fee': fee,
                })
                position = 0
                avg_price = 0
                
                if self._trade_callback:
                    self._trade_callback(trades[-1])
            
            # Calculate current equity
            unrealized = position * price if position > 0 else 0
            equity = cash + unrealized
            equity_curve.append(equity)
            timestamps.append(timestamp)
            
            # Update progress
            self._current_progress = (i + 1) / n_bars * 100
            self._current_equity = equity
            
            if self._progress_callback:
                self._progress_callback(self._current_progress, equity)
                
            if self._equity_callback:
                self._equity_callback(timestamp, equity, equity_curve)
            
            # Yield to allow WebSocket updates
            if i % 100 == 0:
                await asyncio.sleep(0)
        
        # Close any remaining position
        if position > 0:
            final_price = data.iloc[-1]['close']
            pnl = (final_price - avg_price) * position
            cash += position * final_price
            realized_pnl += pnl
            position = 0
        
        # Calculate metrics using Empyrical
        returns = pd.Series(equity_curve).pct_change().dropna()
        metrics = calculate_metrics(returns, benchmark_returns)
        
        # Calculate trade statistics
        closed_trades = [t for t in trades if 'pnl' in t]
        winning = [t for t in closed_trades if t['pnl'] > 0]
        losing = [t for t in closed_trades if t['pnl'] < 0]
        
        # Build result
        result = BacktestResult(
            total_return=metrics['total_return'],
            annual_return=metrics['annual_return'],
            monthly_return=metrics['monthly_return'],
            volatility=metrics['volatility'],
            downside_volatility=metrics['downside_volatility'],
            max_drawdown=metrics['max_drawdown'],
            max_drawdown_duration=metrics['max_drawdown_duration'],
            sharpe_ratio=metrics['sharpe_ratio'],
            sortino_ratio=metrics['sortino_ratio'],
            calmar_ratio=metrics['calmar_ratio'],
            alpha=metrics['alpha'],
            beta=metrics['beta'],
            var_95=metrics['var_95'],
            cvar_95=metrics['cvar_95'],
            total_trades=len(closed_trades),
            winning_trades=len(winning),
            losing_trades=len(losing),
            win_rate=len(winning) / max(len(closed_trades), 1) * 100,
            profit_factor=sum(t['pnl'] for t in winning) / max(abs(sum(t['pnl'] for t in losing)), 1) if losing else float('inf'),
            average_win=np.mean([t['pnl'] for t in winning]) if winning else 0,
            average_loss=np.mean([abs(t['pnl']) for t in losing]) if losing else 0,
            largest_win=max([t['pnl'] for t in winning]) if winning else 0,
            largest_loss=max([abs(t['pnl']) for t in losing]) if losing else 0,
            equity_curve=equity_curve,
            timestamps=timestamps,
            trades=trades,
        )
        
        return result
    
    def get_progress(self) -> float:
        """Get current progress percentage"""
        return self._current_progress
    
    def get_current_equity(self) -> float:
        """Get current equity value"""
        return self._current_equity
    
    def is_running(self) -> bool:
        """Check if backtest is currently running"""
        return self._is_running


class ParameterOptimizer:
    """
    Grid search parameter optimization for strategies.
    """
    
    def __init__(self, base_config: BacktestConfig):
        self.base_config = base_config
        self._results: List[Dict[str, Any]] = []
        
    async def optimize(
        self,
        data: pd.DataFrame,
        strategy_factory: Callable[[Dict[str, float]], Callable[[pd.DataFrame], pd.Series]],
        parameter_grid: Dict[str, List[float]],
        progress_callback: Optional[Callable[[int, int, Dict[str, float], BacktestResult], None]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Run grid search optimization.
        
        Args:
            data: OHLCV DataFrame
            strategy_factory: Function that takes parameters and returns a strategy function
            parameter_grid: Dict of parameter name to list of values
            progress_callback: Optional callback(current, total, params, result)
            
        Returns:
            List of (params, result) dicts sorted by Sharpe ratio
        """
        from itertools import product
        
        # Generate all parameter combinations
        param_names = list(parameter_grid.keys())
        param_values = list(parameter_grid.values())
        combinations = list(product(*param_values))
        
        total = len(combinations)
        self._results = []
        
        for i, values in enumerate(combinations):
            params = dict(zip(param_names, values))
            
            # Create strategy with these parameters
            strategy_func = strategy_factory(params)
            
            # Run backtest
            runner = BacktestRunner(self.base_config)
            result = await runner.run_backtest(data, strategy_func)
            
            self._results.append({
                'params': params,
                'result': result,
                'sharpe': result.sharpe_ratio,
                'return': result.total_return,
                'drawdown': result.max_drawdown,
            })
            
            if progress_callback:
                progress_callback(i + 1, total, params, result)
        
        # Sort by Sharpe ratio
        self._results.sort(key=lambda x: x['sharpe'], reverse=True)
        
        return self._results
    
    def get_best_params(self) -> Dict[str, float]:
        """Get the best performing parameters"""
        if not self._results:
            return {}
        return self._results[0]['params']
    
    def get_optimization_surface(self, param_x: str, param_y: str, metric: str = 'sharpe') -> pd.DataFrame:
        """Get a 2D surface for visualization"""
        rows = []
        for r in self._results:
            rows.append({
                param_x: r['params'].get(param_x, 0),
                param_y: r['params'].get(param_y, 0),
                metric: r.get(metric, r['result'].sharpe_ratio if metric == 'sharpe' else 0),
            })
        return pd.DataFrame(rows)

