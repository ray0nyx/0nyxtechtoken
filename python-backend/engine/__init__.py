"""
WagYu Backtest Engine Python Wrapper

This module provides a Python interface to the Rust backtesting engine,
along with Empyrical integration for performance metrics.
"""

from .backtest_runner import BacktestRunner, BacktestConfig, BacktestResult
from .metrics import calculate_metrics, calculate_tearsheet
from .strategy_executor import StrategyExecutor
from .data_loader import DataLoader
from .notebook_manager import NotebookManager, get_notebook_manager

__all__ = [
    'BacktestRunner',
    'BacktestConfig',
    'BacktestResult',
    'calculate_metrics',
    'calculate_tearsheet',
    'StrategyExecutor',
    'DataLoader',
    'NotebookManager',
    'get_notebook_manager',
]

