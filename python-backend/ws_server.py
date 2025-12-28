"""
WebSocket Server for Real-Time Backtest Streaming

Provides WebSocket endpoints for:
- Backtest progress updates
- Real-time equity curve streaming
- Trade execution notifications
- Parameter optimization progress
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Set, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import pandas as pd

from engine.backtest_runner import BacktestRunner, BacktestConfig, ParameterOptimizer
from engine.strategy_executor import create_strategy_function, StrategyExecutor, STRATEGY_TEMPLATES
from engine.data_loader import DataLoader


class MessageType(str, Enum):
    """WebSocket message types"""
    BACKTEST_START = "backtest_start"
    BACKTEST_PROGRESS = "backtest_progress"
    BACKTEST_EQUITY = "backtest_equity"
    BACKTEST_TRADE = "backtest_trade"
    BACKTEST_COMPLETE = "backtest_complete"
    BACKTEST_ERROR = "backtest_error"
    OPTIMIZATION_START = "optimization_start"
    OPTIMIZATION_PROGRESS = "optimization_progress"
    OPTIMIZATION_COMPLETE = "optimization_complete"


@dataclass
class WSMessage:
    """WebSocket message structure"""
    type: MessageType
    job_id: str
    data: Dict[str, Any]
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()
    
    def to_json(self) -> str:
        d = asdict(self)
        d['type'] = self.type.value
        return json.dumps(d)


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        # job_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Global subscribers (for all jobs)
        self.global_subscribers: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, job_id: Optional[str] = None):
        await websocket.accept()
        
        if job_id:
            if job_id not in self.active_connections:
                self.active_connections[job_id] = set()
            self.active_connections[job_id].add(websocket)
        else:
            self.global_subscribers.add(websocket)
    
    def disconnect(self, websocket: WebSocket, job_id: Optional[str] = None):
        if job_id and job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        
        self.global_subscribers.discard(websocket)
    
    async def send_to_job(self, job_id: str, message: WSMessage):
        """Send message to all connections watching a specific job"""
        json_msg = message.to_json()
        
        # Send to job-specific subscribers
        if job_id in self.active_connections:
            disconnected = set()
            for websocket in self.active_connections[job_id]:
                try:
                    await websocket.send_text(json_msg)
                except:
                    disconnected.add(websocket)
            
            for ws in disconnected:
                self.active_connections[job_id].discard(ws)
        
        # Send to global subscribers
        disconnected = set()
        for websocket in self.global_subscribers:
            try:
                await websocket.send_text(json_msg)
            except:
                disconnected.add(websocket)
        
        for ws in disconnected:
            self.global_subscribers.discard(ws)
    
    async def broadcast(self, message: WSMessage):
        """Broadcast to all connections"""
        json_msg = message.to_json()
        
        all_websockets = set()
        for connections in self.active_connections.values():
            all_websockets.update(connections)
        all_websockets.update(self.global_subscribers)
        
        for websocket in all_websockets:
            try:
                await websocket.send_text(json_msg)
            except:
                pass


class BacktestJob:
    """Represents a running backtest job"""
    
    def __init__(
        self,
        job_id: str,
        config: BacktestConfig,
        strategy_code: str,
        connection_manager: ConnectionManager,
    ):
        self.job_id = job_id
        self.config = config
        self.strategy_code = strategy_code
        self.connection_manager = connection_manager
        self.status = "pending"
        self.progress = 0.0
        self.current_equity = config.initial_capital
        self.equity_curve: list = []
        self.result = None
        self.error = None
    
    async def run(self, data: pd.DataFrame):
        """Run the backtest with real-time updates"""
        self.status = "running"
        
        # Notify start
        await self.connection_manager.send_to_job(
            self.job_id,
            WSMessage(
                type=MessageType.BACKTEST_START,
                job_id=self.job_id,
                data={
                    "config": self.config.to_dict(),
                    "status": "running",
                }
            )
        )
        
        try:
            # Create strategy function
            strategy_func = create_strategy_function(self.strategy_code)
            
            # Create runner with callbacks
            runner = BacktestRunner(self.config)
            
            # Set up progress callback
            async def on_progress(progress: float, equity: float):
                self.progress = progress
                self.current_equity = equity
                
                await self.connection_manager.send_to_job(
                    self.job_id,
                    WSMessage(
                        type=MessageType.BACKTEST_PROGRESS,
                        job_id=self.job_id,
                        data={
                            "progress": progress,
                            "equity": equity,
                        }
                    )
                )
            
            # Set up equity callback
            async def on_equity(timestamp: str, equity: float, equity_curve: list):
                self.equity_curve = equity_curve
                
                # Send equity update every 10 points to reduce message volume
                if len(equity_curve) % 10 == 0:
                    await self.connection_manager.send_to_job(
                        self.job_id,
                        WSMessage(
                            type=MessageType.BACKTEST_EQUITY,
                            job_id=self.job_id,
                            data={
                                "timestamp": timestamp,
                                "equity": equity,
                                "equity_curve": equity_curve[-100:],  # Last 100 points
                            }
                        )
                    )
            
            # Set up trade callback
            async def on_trade(trade: dict):
                await self.connection_manager.send_to_job(
                    self.job_id,
                    WSMessage(
                        type=MessageType.BACKTEST_TRADE,
                        job_id=self.job_id,
                        data={"trade": trade}
                    )
                )
            
            # Wrap callbacks to be sync
            def sync_progress(progress: float, equity: float):
                asyncio.create_task(on_progress(progress, equity))
            
            def sync_equity(timestamp: str, equity: float, equity_curve: list):
                asyncio.create_task(on_equity(timestamp, equity, equity_curve))
            
            def sync_trade(trade: dict):
                asyncio.create_task(on_trade(trade))
            
            runner.set_progress_callback(sync_progress)
            runner.set_equity_callback(sync_equity)
            runner.set_trade_callback(sync_trade)
            
            # Run the backtest
            self.result = await runner.run_backtest(data, strategy_func)
            self.status = "completed"
            
            # Send completion message
            await self.connection_manager.send_to_job(
                self.job_id,
                WSMessage(
                    type=MessageType.BACKTEST_COMPLETE,
                    job_id=self.job_id,
                    data={
                        "status": "completed",
                        "result": self.result.to_dict(),
                    }
                )
            )
            
        except Exception as e:
            self.status = "error"
            self.error = str(e)
            
            await self.connection_manager.send_to_job(
                self.job_id,
                WSMessage(
                    type=MessageType.BACKTEST_ERROR,
                    job_id=self.job_id,
                    data={
                        "status": "error",
                        "error": str(e),
                    }
                )
            )


class OptimizationJob:
    """Represents a parameter optimization job"""
    
    def __init__(
        self,
        job_id: str,
        config: BacktestConfig,
        strategy_factory,
        parameter_grid: Dict[str, list],
        connection_manager: ConnectionManager,
    ):
        self.job_id = job_id
        self.config = config
        self.strategy_factory = strategy_factory
        self.parameter_grid = parameter_grid
        self.connection_manager = connection_manager
        self.status = "pending"
        self.progress = 0
        self.total = 1
        self.results: list = []
    
    async def run(self, data: pd.DataFrame):
        """Run optimization with real-time updates"""
        self.status = "running"
        
        # Calculate total combinations
        self.total = 1
        for values in self.parameter_grid.values():
            self.total *= len(values)
        
        # Notify start
        await self.connection_manager.send_to_job(
            self.job_id,
            WSMessage(
                type=MessageType.OPTIMIZATION_START,
                job_id=self.job_id,
                data={
                    "status": "running",
                    "total_combinations": self.total,
                    "parameter_grid": self.parameter_grid,
                }
            )
        )
        
        try:
            optimizer = ParameterOptimizer(self.config)
            
            async def on_progress(current: int, total: int, params: dict, result):
                self.progress = current
                
                await self.connection_manager.send_to_job(
                    self.job_id,
                    WSMessage(
                        type=MessageType.OPTIMIZATION_PROGRESS,
                        job_id=self.job_id,
                        data={
                            "current": current,
                            "total": total,
                            "progress_pct": current / total * 100,
                            "params": params,
                            "sharpe": result.sharpe_ratio,
                            "return": result.total_return,
                            "drawdown": result.max_drawdown,
                        }
                    )
                )
            
            self.results = await optimizer.optimize(
                data,
                self.strategy_factory,
                self.parameter_grid,
                progress_callback=on_progress,
            )
            
            self.status = "completed"
            
            # Send completion with all results
            await self.connection_manager.send_to_job(
                self.job_id,
                WSMessage(
                    type=MessageType.OPTIMIZATION_COMPLETE,
                    job_id=self.job_id,
                    data={
                        "status": "completed",
                        "best_params": optimizer.get_best_params(),
                        "results": [
                            {
                                "params": r["params"],
                                "sharpe": r["sharpe"],
                                "return": r["return"],
                                "drawdown": r["drawdown"],
                            }
                            for r in self.results[:100]  # Top 100 results
                        ],
                    }
                )
            )
            
        except Exception as e:
            self.status = "error"
            
            await self.connection_manager.send_to_job(
                self.job_id,
                WSMessage(
                    type=MessageType.BACKTEST_ERROR,
                    job_id=self.job_id,
                    data={
                        "status": "error",
                        "error": str(e),
                    }
                )
            )


# Global instances
connection_manager = ConnectionManager()
active_jobs: Dict[str, BacktestJob] = {}
data_loader = DataLoader()


def create_ws_app() -> FastAPI:
    """Create the WebSocket application"""
    
    app = FastAPI(title="WagYu Backtest WebSocket Server")
    
    @app.websocket("/ws/backtest/{job_id}")
    async def websocket_backtest(websocket: WebSocket, job_id: str):
        """WebSocket endpoint for a specific backtest job"""
        await connection_manager.connect(websocket, job_id)
        
        try:
            while True:
                # Keep connection alive and receive any client messages
                data = await websocket.receive_text()
                
                # Handle client commands
                try:
                    msg = json.loads(data)
                    if msg.get("command") == "status":
                        if job_id in active_jobs:
                            job = active_jobs[job_id]
                            await websocket.send_json({
                                "type": "status",
                                "job_id": job_id,
                                "status": job.status,
                                "progress": job.progress,
                                "equity": job.current_equity,
                            })
                except:
                    pass
                    
        except WebSocketDisconnect:
            connection_manager.disconnect(websocket, job_id)
    
    @app.websocket("/ws/backtests")
    async def websocket_all_backtests(websocket: WebSocket):
        """WebSocket endpoint for all backtest updates"""
        await connection_manager.connect(websocket, None)
        
        try:
            while True:
                data = await websocket.receive_text()
                
                try:
                    msg = json.loads(data)
                    
                    if msg.get("command") == "list":
                        # List all active jobs
                        jobs_info = [
                            {
                                "job_id": job_id,
                                "status": job.status,
                                "progress": job.progress,
                            }
                            for job_id, job in active_jobs.items()
                        ]
                        await websocket.send_json({
                            "type": "job_list",
                            "jobs": jobs_info,
                        })
                        
                except:
                    pass
                    
        except WebSocketDisconnect:
            connection_manager.disconnect(websocket, None)
    
    @app.post("/api/backtest/start")
    async def start_backtest(request: dict):
        """Start a new backtest job"""
        job_id = str(uuid.uuid4())
        
        # Parse config
        config = BacktestConfig(
            initial_capital=request.get("initialCapital", 100000),
            start_date=request.get("startDate", "2023-01-01"),
            end_date=request.get("endDate", "2024-01-01"),
            symbols=request.get("symbols", ["BTC/USDT"]),
            timeframe=request.get("timeframe", "1h"),
            maker_fee=request.get("makerFee", 0.001),
            taker_fee=request.get("takerFee", 0.001),
            slippage_pct=request.get("slippagePct", 0.0005),
        )
        
        strategy_code = request.get("code", STRATEGY_TEMPLATES["rsi_momentum"])
        
        # Create job
        job = BacktestJob(job_id, config, strategy_code, connection_manager)
        active_jobs[job_id] = job
        
        # Load data
        exchange = request.get("exchange", "binance")
        data = data_loader.get_or_fetch(
            exchange_id=exchange,
            symbol=config.symbols[0],
            timeframe=config.timeframe,
            start_date=config.start_date,
            end_date=config.end_date,
        )
        
        # Start backtest in background
        asyncio.create_task(job.run(data))
        
        return {
            "job_id": job_id,
            "status": "started",
            "websocket_url": f"/ws/backtest/{job_id}",
        }
    
    @app.post("/api/optimization/start")
    async def start_optimization(request: dict):
        """Start a parameter optimization job"""
        job_id = str(uuid.uuid4())
        
        # Parse config
        config = BacktestConfig(
            initial_capital=request.get("initialCapital", 100000),
            start_date=request.get("startDate", "2023-01-01"),
            end_date=request.get("endDate", "2024-01-01"),
            symbols=request.get("symbols", ["BTC/USDT"]),
            timeframe=request.get("timeframe", "1h"),
        )
        
        parameter_grid = request.get("parameterGrid", {
            "rsi_period": [10, 14, 20, 30],
            "rsi_oversold": [25, 30, 35],
            "rsi_overbought": [65, 70, 75],
        })
        
        strategy_template = request.get("strategyTemplate", "rsi_momentum")
        
        def strategy_factory(params):
            code = STRATEGY_TEMPLATES.get(strategy_template, STRATEGY_TEMPLATES["rsi_momentum"])
            return create_strategy_function(code, params)
        
        job = OptimizationJob(job_id, config, strategy_factory, parameter_grid, connection_manager)
        
        # Load data
        exchange = request.get("exchange", "binance")
        data = data_loader.get_or_fetch(
            exchange_id=exchange,
            symbol=config.symbols[0],
            timeframe=config.timeframe,
            start_date=config.start_date,
            end_date=config.end_date,
        )
        
        # Start optimization in background
        asyncio.create_task(job.run(data))
        
        return {
            "job_id": job_id,
            "status": "started",
            "websocket_url": f"/ws/backtest/{job_id}",
            "total_combinations": job.total,
        }
    
    @app.get("/api/backtest/{job_id}/status")
    async def get_backtest_status(job_id: str):
        """Get status of a backtest job"""
        if job_id not in active_jobs:
            return {"error": "Job not found"}
        
        job = active_jobs[job_id]
        return {
            "job_id": job_id,
            "status": job.status,
            "progress": job.progress,
            "equity": job.current_equity,
            "result": job.result.to_dict() if job.result else None,
            "error": job.error,
        }
    
    return app


# For running standalone
if __name__ == "__main__":
    import uvicorn
    
    app = create_ws_app()
    uvicorn.run(app, host="0.0.0.0", port=8001)

