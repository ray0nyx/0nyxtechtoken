"""
Backtest engine service for running QuantConnect Lean backtests
"""

import asyncio
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, date
from typing import Dict, List, Any, Optional
import docker
import pandas as pd
import numpy as np

from models.backtest_models import BacktestRequest, LeanConfig, LeanResults, Trade, PortfolioValue

logger = logging.getLogger(__name__)

class BacktestEngine:
    """Service for running QuantConnect Lean backtests"""
    
    def __init__(self):
        try:
            self.docker_client = docker.from_env()
            self.docker_available = True
        except Exception as e:
            logger.warning(f"Docker not available: {e}. Backtests requiring Docker will fail.")
            self.docker_client = None
            self.docker_available = False
        self.lean_image = "quantconnect/lean:latest"
        self.data_folder = "/app/data"
        self.results_folder = "/app/results"
        self.strategies_folder = "/app/strategies"
    
    async def prepare_lean_config(
        self,
        request: BacktestRequest,
        market_data: List[Dict[str, Any]],
        job_id: str
    ) -> LeanConfig:
        """Prepare Lean configuration and data files"""
        logger.info(f"Preparing Lean configuration for job {job_id}")
        
        try:
            # Create temporary directories
            temp_dir = tempfile.mkdtemp(prefix=f"lean_backtest_{job_id}_")
            data_dir = os.path.join(temp_dir, "data")
            results_dir = os.path.join(temp_dir, "results")
            strategies_dir = os.path.join(temp_dir, "strategies")
            
            os.makedirs(data_dir, exist_ok=True)
            os.makedirs(results_dir, exist_ok=True)
            os.makedirs(strategies_dir, exist_ok=True)
            
            # Prepare market data files
            await self._prepare_market_data_files(market_data, data_dir)
            
            # Prepare strategy file
            strategy_file = await self._prepare_strategy_file(request, strategies_dir, job_id)
            
            # Prepare Lean configuration
            config_file = await self._prepare_lean_config_file(request, temp_dir, job_id)
            
            return LeanConfig(
                job_id=job_id,
                strategy_code=request.strategy_code,
                data_folder=data_dir,
                results_folder=results_dir,
                config_file=config_file,
                parameters={
                    "start-date": request.start_date.strftime("%Y%m%d"),
                    "end-date": request.end_date.strftime("%Y%m%d"),
                    "initial-cash": request.initial_capital,
                    "symbols": request.symbols,
                    "timeframe": request.timeframe.value if request.timeframe else "1h",
                    "transaction-costs": request.transaction_costs or 0.001,
                    "slippage": request.slippage or 0.0005,
                    "max-positions": request.max_positions or 10,
                    "risk-free-rate": request.risk_free_rate or 0.02,
                    "benchmark": request.benchmark or "BTC/USDT",
                    "warmup-period": request.warmup_period or 30,
                    "max-drawdown-limit": request.max_drawdown_limit or 0.2,
                    "position-sizing": request.position_sizing or "equal"
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to prepare Lean configuration: {e}")
            raise
    
    async def _prepare_market_data_files(
        self,
        market_data: List[Dict[str, Any]],
        data_dir: str
    ):
        """Prepare market data files for Lean"""
        logger.info("Preparing market data files")
        
        # Group data by symbol and exchange
        data_by_symbol = {}
        for record in market_data:
            key = f"{record['symbol']}_{record['exchange']}"
            if key not in data_by_symbol:
                data_by_symbol[key] = []
            data_by_symbol[key].append(record)
        
        # Create data files for each symbol
        for key, records in data_by_symbol.items():
            symbol, exchange = key.split('_', 1)
            
            # Create symbol directory
            symbol_dir = os.path.join(data_dir, "crypto", exchange, symbol.lower())
            os.makedirs(symbol_dir, exist_ok=True)
            
            # Convert to DataFrame and sort by time
            df = pd.DataFrame(records)
            df = df.sort_values('time')
            
            # Create hourly data file
            hourly_file = os.path.join(symbol_dir, "hour.csv")
            df.to_csv(hourly_file, index=False, header=False)
            
            # Create daily data file (aggregate from hourly)
            daily_df = df.set_index('time').resample('D').agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
            
            daily_file = os.path.join(symbol_dir, "daily.csv")
            daily_df.to_csv(daily_file, index=False, header=False)
            
            logger.info(f"Created data files for {symbol} on {exchange}")
    
    async def _prepare_strategy_file(
        self,
        request: BacktestRequest,
        strategies_dir: str,
        job_id: str
    ) -> str:
        """Prepare strategy Python file"""
        logger.info("Preparing strategy file")
        
        # Create a wrapper strategy that includes the user's code
        strategy_code = f"""
# Auto-generated strategy for job {job_id}
from AlgorithmImports import *
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

class InstitutionalStrategy(QCAlgorithm):
    def Initialize(self):
        # Set start and end dates
        self.SetStartDate({request.start_date.year}, {request.start_date.month}, {request.start_date.day})
        self.SetEndDate({request.end_date.year}, {request.end_date.month}, {request.end_date.day})
        
        # Set initial cash
        self.SetCash({request.initial_capital})
        
        # Add symbols
        symbols = {request.symbols}
        for symbol in symbols:
            self.AddCrypto(symbol, Resolution.Hour)
        
        # Set benchmark
        self.SetBenchmark("BTCUSD")
        
        # Set transaction costs and slippage
        self.SetTransactionCosts({request.transaction_costs or 0.001})
        self.SetSlippage({request.slippage or 0.0005})
        
        # Set warmup period
        self.SetWarmUp({request.warmup_period or 30}, Resolution.Daily)
        
        # Initialize variables
        self.max_positions = {request.max_positions or 10}
        self.risk_free_rate = {request.risk_free_rate or 0.02}
        self.max_drawdown_limit = {request.max_drawdown_limit or 0.2}
        self.position_sizing = "{request.position_sizing or 'equal'}"
        
        # Track portfolio metrics
        self.portfolio_values = []
        self.trades = []
        self.current_drawdown = 0
        self.peak_value = self.Portfolio.TotalPortfolioValue
        
        # Schedule rebalancing
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(9, 0),
            self.Rebalance
        )
        
        # User's strategy code
        {request.strategy_code}
    
    def Rebalance(self):
        '''Main rebalancing logic'''
        if self.IsWarmUp:
            return
        
        # Check drawdown limit
        current_value = self.Portfolio.TotalPortfolioValue
        if current_value > self.peak_value:
            self.peak_value = current_value
            self.current_drawdown = 0
        else:
            self.current_drawdown = (self.peak_value - current_value) / self.peak_value
        
        if self.current_drawdown > self.max_drawdown_limit:
            self.Debug(f"Max drawdown limit reached: {{self.current_drawdown:.2%}}")
            return
        
        # Record portfolio value
        self.portfolio_values.append({{
            'time': self.Time,
            'value': current_value,
            'cash': self.Portfolio.Cash,
            'holdings': {{symbol: holding.Quantity for symbol, holding in self.Portfolio.items()}},
            'drawdown': self.current_drawdown
        }})
        
        # Execute user's rebalancing logic
        self.ExecuteStrategy()
    
    def ExecuteStrategy(self):
        '''Execute the user's strategy logic'''
        # This will be overridden by the user's code
        pass
    
    def OnData(self, data):
        '''Handle incoming data'''
        if self.IsWarmUp:
            return
        
        # User's data handling code can go here
        pass
    
    def OnOrderEvent(self, orderEvent):
        '''Handle order events'''
        if orderEvent.Status == OrderStatus.Filled:
            trade = {{
                'symbol': orderEvent.Symbol.Value,
                'side': 'buy' if orderEvent.Quantity > 0 else 'sell',
                'quantity': abs(orderEvent.Quantity),
                'price': orderEvent.FillPrice,
                'timestamp': self.Time,
                'commission': orderEvent.OrderFee.Value.Amount,
                'order_id': orderEvent.OrderId
            }}
            self.trades.append(trade)
            self.Debug(f"Trade executed: {{trade}}")
    
    def OnEndOfAlgorithm(self):
        '''Called at the end of the algorithm'''
        # Save results
        results = {{
            'trades': self.trades,
            'portfolio_values': self.portfolio_values,
            'final_value': self.Portfolio.TotalPortfolioValue,
            'total_return': (self.Portfolio.TotalPortfolioValue - {request.initial_capital}) / {request.initial_capital}
        }}
        
        # Write results to file
        import json
        with open('/app/results/backtest_results.json', 'w') as f:
            json.dump(results, f, default=str)
        
        self.Debug(f"Algorithm completed. Final value: {{self.Portfolio.TotalPortfolioValue}}")
"""
        
        # Write strategy file
        strategy_file = os.path.join(strategies_dir, f"strategy_{job_id}.py")
        with open(strategy_file, 'w') as f:
            f.write(strategy_code)
        
        return strategy_file
    
    async def _prepare_lean_config_file(
        self,
        request: BacktestRequest,
        temp_dir: str,
        job_id: str
    ) -> str:
        """Prepare Lean configuration file"""
        logger.info("Preparing Lean configuration file")
        
        config = {
            "environment": "backtesting",
            "algorithm-type-name": f"strategy_{job_id}",
            "algorithm-location": f"/app/strategies/strategy_{job_id}.py",
            "algorithm-language": "Python",
            "data-folder": "/app/data",
            "results-destination-folder": "/app/results",
            "debugging": True,
            "debugging-method": "LocalCmdline",
            "log-handler": "ConsoleLogHandler",
            "messaging-handler": "StreamingMessageHandler",
            "job-queue-handler": "JobQueue",
            "api-handler": "Api",
            "result-handler": "BacktestingResultHandler",
            "data-queue-handler": "DataQueue",
            "real-time-handler": "BacktestingRealTimeHandler",
            "history-provider": "SubscriptionDataReaderHistoryProvider",
            "transaction-handler": "BacktestingTransactionHandler",
            "map-file-provider": "LocalDiskMapFileProvider",
            "factor-file-provider": "LocalDiskFactorFileProvider",
            "data-provider": "DefaultDataProvider",
            "alpha-handler": "DefaultAlphaHandler",
            "object-store": "LocalObjectStore",
            "data-aggregator": "AggregationManager",
            "data-channel-provider": "DataChannelProvider",
            "parameters": {
                "start-date": request.start_date.strftime("%Y%m%d"),
                "end-date": request.end_date.strftime("%Y%m%d"),
                "initial-cash": request.initial_capital,
                "symbols": ",".join(request.symbols),
                "timeframe": request.timeframe.value if request.timeframe else "1h",
                "transaction-costs": request.transaction_costs or 0.001,
                "slippage": request.slippage or 0.0005,
                "max-positions": request.max_positions or 10,
                "risk-free-rate": request.risk_free_rate or 0.02,
                "benchmark": request.benchmark or "BTC/USDT",
                "warmup-period": request.warmup_period or 30,
                "max-drawdown-limit": request.max_drawdown_limit or 0.2,
                "position-sizing": request.position_sizing or "equal"
            }
        }
        
        config_file = os.path.join(temp_dir, "config.json")
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        return config_file
    
    async def run_lean_backtest(
        self,
        config: LeanConfig,
        job_id: str
    ) -> Dict[str, Any]:
        """Run Lean backtest in Docker container"""
        logger.info(f"Running Lean backtest for job {job_id}")
        
        try:
            # Prepare volumes
            volumes = {
                config.data_folder: {'bind': '/app/data', 'mode': 'rw'},
                config.results_folder: {'bind': '/app/results', 'mode': 'rw'},
                os.path.dirname(config.config_file): {'bind': '/app/config', 'mode': 'rw'},
                os.path.dirname(config.strategy_code): {'bind': '/app/strategies', 'mode': 'rw'}
            }
            
            # Run Lean container
            container = self.docker_client.containers.run(
                self.lean_image,
                command=[
                    "dotnet", "QuantConnect.Lean.Launcher.dll",
                    "--config", "/app/config/config.json"
                ],
                volumes=volumes,
                detach=True,
                name=f"lean_backtest_{job_id}",
                mem_limit="4g",
                cpu_count=2,
                environment={
                    "PYTHONPATH": "/app/strategies",
                    "LEAN_DATA_FOLDER": "/app/data",
                    "LEAN_RESULTS_FOLDER": "/app/results"
                }
            )
            
            logger.info(f"Started Lean container {container.id} for job {job_id}")
            
            # Wait for completion
            result = container.wait(timeout=3600)  # 1 hour timeout
            
            # Get logs
            logs = container.logs().decode('utf-8')
            
            # Parse results
            results = await self._parse_lean_results(config.results_folder, logs)
            
            # Cleanup container
            container.remove()
            
            logger.info(f"Lean backtest completed for job {job_id}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to run Lean backtest: {e}")
            raise
    
    async def _parse_lean_results(
        self,
        results_folder: str,
        logs: str
    ) -> Dict[str, Any]:
        """Parse Lean backtest results"""
        logger.info("Parsing Lean backtest results")
        
        results = {
            "trades": [],
            "portfolio_values": [],
            "benchmark_data": [],
            "logs": logs
        }
        
        try:
            # Try to read results JSON file
            results_file = os.path.join(results_folder, "backtest_results.json")
            if os.path.exists(results_file):
                with open(results_file, 'r') as f:
                    lean_results = json.load(f)
                    results.update(lean_results)
            
            # Parse trades from logs if available
            if not results["trades"]:
                results["trades"] = self._parse_trades_from_logs(logs)
            
            # Parse portfolio values from logs if available
            if not results["portfolio_values"]:
                results["portfolio_values"] = self._parse_portfolio_values_from_logs(logs)
            
        except Exception as e:
            logger.error(f"Failed to parse Lean results: {e}")
        
        return results
    
    def _parse_trades_from_logs(self, logs: str) -> List[Dict[str, Any]]:
        """Parse trades from Lean logs"""
        trades = []
        
        # Look for trade execution patterns in logs
        lines = logs.split('\n')
        for line in lines:
            if "Trade executed:" in line:
                try:
                    # Extract trade data from log line
                    # This is a simplified parser - in production, use proper JSON logging
                    trade_data = line.split("Trade executed:")[-1].strip()
                    if trade_data.startswith('{') and trade_data.endswith('}'):
                        trade = json.loads(trade_data)
                        trades.append(trade)
                except:
                    continue
        
        return trades
    
    def _parse_portfolio_values_from_logs(self, logs: str) -> List[Dict[str, Any]]:
        """Parse portfolio values from Lean logs"""
        portfolio_values = []
        
        # Look for portfolio value patterns in logs
        lines = logs.split('\n')
        for line in lines:
            if "Portfolio value:" in line or "Total portfolio value:" in line:
                try:
                    # Extract portfolio value data from log line
                    # This is a simplified parser - in production, use proper JSON logging
                    value_str = line.split(":")[-1].strip()
                    value = float(value_str.replace(',', ''))
                    
                    portfolio_values.append({
                        'time': datetime.now(),  # Approximate timestamp
                        'value': value,
                        'cash': 0,  # Would need to parse from logs
                        'holdings': {},
                        'drawdown': 0
                    })
                except:
                    continue
        
        return portfolio_values
