"""
Strategy Executor - Safely executes user-provided Python strategies

Provides a sandboxed environment for running trading strategies.
"""

import ast
import sys
import traceback
from io import StringIO
from typing import Dict, Any, Callable, Optional, List
import pandas as pd
import numpy as np


class StrategyExecutionError(Exception):
    """Raised when strategy execution fails"""
    pass


class StrategyValidator:
    """Validates strategy code for safety and correctness"""
    
    FORBIDDEN_MODULES = {
        'os', 'sys', 'subprocess', 'shutil', 'socket', 'http',
        'urllib', 'ftplib', 'smtplib', 'telnetlib', 'pickle',
        'shelve', 'marshal', 'builtins', '__builtins__',
        'importlib', 'ctypes', 'multiprocessing',
    }
    
    FORBIDDEN_FUNCTIONS = {
        'exec', 'eval', 'compile', 'open', 'input', '__import__',
        'globals', 'locals', 'vars', 'getattr', 'setattr', 'delattr',
        'breakpoint', 'exit', 'quit',
    }
    
    REQUIRED_METHODS = ['Initialize', 'OnData']
    
    def validate(self, code: str) -> List[str]:
        """
        Validate strategy code.
        
        Returns list of error messages (empty if valid).
        """
        errors = []
        
        if not code or len(code.strip()) < 20:
            errors.append("Code is too short or empty")
            return errors
        
        # Check for syntax errors
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            errors.append(f"Syntax error: {e.msg} at line {e.lineno}")
            return errors
        
        # Check for forbidden imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split('.')[0] in self.FORBIDDEN_MODULES:
                        errors.append(f"Forbidden import: {alias.name}")
                        
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.module.split('.')[0] in self.FORBIDDEN_MODULES:
                    errors.append(f"Forbidden import: {node.module}")
                    
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in self.FORBIDDEN_FUNCTIONS:
                        errors.append(f"Forbidden function: {node.func.id}")
        
        # Check for required class structure
        has_class = False
        has_initialize = False
        has_on_data = False
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                has_class = True
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        if item.name == 'Initialize':
                            has_initialize = True
                        elif item.name == 'OnData':
                            has_on_data = True
        
        if not has_class:
            errors.append("Strategy must define a class")
        if not has_initialize:
            errors.append("Strategy must have an Initialize method")
        if not has_on_data:
            errors.append("Strategy must have an OnData method")
        
        return errors


class StrategyExecutor:
    """
    Executes trading strategies in a controlled environment.
    
    Provides:
    - Code validation
    - Sandboxed execution
    - Signal generation from strategy logic
    """
    
    def __init__(self):
        self.validator = StrategyValidator()
        self._strategy_class = None
        self._strategy_instance = None
        
    def compile_strategy(self, code: str) -> Dict[str, Any]:
        """
        Compile and validate strategy code.
        
        Returns:
            Dict with 'success', 'errors', 'warnings'
        """
        errors = self.validator.validate(code)
        warnings = []
        
        if errors:
            return {
                'success': False,
                'errors': errors,
                'warnings': warnings,
            }
        
        # Check for common issues that aren't errors
        if 'print(' in code:
            warnings.append("Consider using self.Log() instead of print()")
        
        if 'time.sleep(' in code:
            warnings.append("time.sleep() will be ignored in backtesting")
        
        # Try to compile
        try:
            compile(code, '<strategy>', 'exec')
        except Exception as e:
            errors.append(f"Compilation error: {str(e)}")
            return {
                'success': False,
                'errors': errors,
                'warnings': warnings,
            }
        
        return {
            'success': True,
            'errors': [],
            'warnings': warnings,
        }
    
    def load_strategy(self, code: str) -> bool:
        """
        Load a strategy from code.
        
        Returns True if successful.
        """
        # Validate first
        result = self.compile_strategy(code)
        if not result['success']:
            raise StrategyExecutionError('\n'.join(result['errors']))
        
        # Create execution namespace with allowed modules
        namespace = self._create_namespace()
        
        try:
            exec(code, namespace)
        except Exception as e:
            raise StrategyExecutionError(f"Execution error: {str(e)}")
        
        # Find the strategy class
        strategy_class = None
        for name, obj in namespace.items():
            if isinstance(obj, type) and hasattr(obj, 'Initialize') and hasattr(obj, 'OnData'):
                strategy_class = obj
                break
        
        if strategy_class is None:
            raise StrategyExecutionError("No valid strategy class found")
        
        self._strategy_class = strategy_class
        
        # Instantiate the strategy
        try:
            self._strategy_instance = strategy_class()
        except Exception as e:
            raise StrategyExecutionError(f"Strategy instantiation error: {str(e)}")
        
        return True
    
    def _create_namespace(self) -> Dict[str, Any]:
        """Create a safe execution namespace"""
        return {
            '__builtins__': {
                'range': range,
                'len': len,
                'min': min,
                'max': max,
                'abs': abs,
                'sum': sum,
                'int': int,
                'float': float,
                'str': str,
                'bool': bool,
                'list': list,
                'dict': dict,
                'tuple': tuple,
                'set': set,
                'enumerate': enumerate,
                'zip': zip,
                'map': map,
                'filter': filter,
                'sorted': sorted,
                'reversed': reversed,
                'round': round,
                'pow': pow,
                'isinstance': isinstance,
                'hasattr': hasattr,
                'print': self._safe_print,
                'True': True,
                'False': False,
                'None': None,
            },
            'pd': pd,
            'np': np,
            'pandas': pd,
            'numpy': np,
        }
    
    def _safe_print(self, *args, **kwargs):
        """Safe print that logs instead of printing"""
        message = ' '.join(str(arg) for arg in args)
        if hasattr(self, '_log'):
            self._log.append(message)
    
    def generate_signals(
        self,
        data: pd.DataFrame,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> pd.Series:
        """
        Generate trading signals from the loaded strategy.
        
        Args:
            data: OHLCV DataFrame
            parameters: Optional strategy parameters
            
        Returns:
            Series of signals (-1, 0, 1)
        """
        if self._strategy_instance is None:
            raise StrategyExecutionError("No strategy loaded")
        
        # Apply parameters if provided
        if parameters:
            for key, value in parameters.items():
                if hasattr(self._strategy_instance, key):
                    setattr(self._strategy_instance, key, value)
        
        # Initialize the strategy
        try:
            self._strategy_instance.Initialize()
        except Exception as e:
            raise StrategyExecutionError(f"Initialize error: {str(e)}")
        
        # Generate signals for each bar
        signals = []
        
        for i in range(len(data)):
            bar_data = data.iloc[:i+1]
            
            try:
                signal = self._strategy_instance.OnData(bar_data)
                
                # Normalize signal to -1, 0, 1
                if signal is None:
                    signal = 0
                elif signal > 0:
                    signal = 1
                elif signal < 0:
                    signal = -1
                else:
                    signal = 0
                    
                signals.append(signal)
                
            except Exception as e:
                # Log error but continue
                signals.append(0)
        
        return pd.Series(signals, index=data.index)


def create_strategy_function(code: str, parameters: Optional[Dict[str, Any]] = None) -> Callable[[pd.DataFrame], pd.Series]:
    """
    Create a callable strategy function from code.
    
    This is a convenience function for the backtesting runner.
    
    Args:
        code: Strategy Python code
        parameters: Optional parameters to pass to the strategy
        
    Returns:
        Function that takes OHLCV data and returns signals
    """
    executor = StrategyExecutor()
    executor.load_strategy(code)
    
    def strategy_func(data: pd.DataFrame) -> pd.Series:
        return executor.generate_signals(data, parameters)
    
    return strategy_func


# Built-in strategy templates
STRATEGY_TEMPLATES = {
    'rsi_momentum': '''
class RSIMomentumStrategy:
    def __init__(self):
        self.rsi_period = 14
        self.rsi_oversold = 30
        self.rsi_overbought = 70
        self.position = 0
    
    def Initialize(self):
        pass
    
    def calculate_rsi(self, prices):
        delta = prices.diff()
        gain = delta.where(delta > 0, 0).rolling(self.rsi_period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(self.rsi_period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))
    
    def OnData(self, data):
        if len(data) < self.rsi_period + 1:
            return 0
        
        rsi = self.calculate_rsi(data['close']).iloc[-1]
        
        if rsi < self.rsi_oversold and self.position <= 0:
            self.position = 1
            return 1
        elif rsi > self.rsi_overbought and self.position >= 0:
            self.position = -1
            return -1
        
        return 0
''',
    
    'macd_crossover': '''
class MACDCrossoverStrategy:
    def __init__(self):
        self.fast = 12
        self.slow = 26
        self.signal = 9
        self.position = 0
    
    def Initialize(self):
        pass
    
    def calculate_macd(self, prices):
        exp1 = prices.ewm(span=self.fast, adjust=False).mean()
        exp2 = prices.ewm(span=self.slow, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=self.signal, adjust=False).mean()
        return macd, signal
    
    def OnData(self, data):
        if len(data) < self.slow + self.signal:
            return 0
        
        macd, signal = self.calculate_macd(data['close'])
        macd_now = macd.iloc[-1]
        signal_now = signal.iloc[-1]
        macd_prev = macd.iloc[-2]
        signal_prev = signal.iloc[-2]
        
        # Bullish crossover
        if macd_prev < signal_prev and macd_now > signal_now:
            self.position = 1
            return 1
        # Bearish crossover
        elif macd_prev > signal_prev and macd_now < signal_now:
            self.position = -1
            return -1
        
        return 0
''',
    
    'bollinger_bands': '''
class BollingerBandsStrategy:
    def __init__(self):
        self.period = 20
        self.std_dev = 2.0
        self.position = 0
    
    def Initialize(self):
        pass
    
    def calculate_bands(self, prices):
        sma = prices.rolling(self.period).mean()
        std = prices.rolling(self.period).std()
        upper = sma + self.std_dev * std
        lower = sma - self.std_dev * std
        return sma, upper, lower
    
    def OnData(self, data):
        if len(data) < self.period:
            return 0
        
        close = data['close'].iloc[-1]
        sma, upper, lower = self.calculate_bands(data['close'])
        
        if close < lower.iloc[-1] and self.position <= 0:
            self.position = 1
            return 1
        elif close > upper.iloc[-1] and self.position >= 0:
            self.position = -1
            return -1
        
        return 0
''',
}

