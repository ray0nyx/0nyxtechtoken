"""
QuantConnect Lean Backtesting Service
FastAPI microservice for running institutional backtests
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, validator
import docker
import asyncpg
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from services.data_bridge import DataBridge
from services.backtest_engine import BacktestEngine
from services.metrics_calculator import MetricsCalculator
from services.exchange_service import ExchangeService
from models.backtest_models import (
    BacktestRequest, BacktestResponse, BacktestStatus, 
    BacktestResult, MarketDataRequest, ExchangeCredentials
)
from utils.database import get_database_connection
from utils.security import SecurityManager
from utils.monitoring import setup_monitoring, backtest_requests, backtest_duration, active_backtests

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="QuantConnect Lean Backtesting Service",
    description="Institutional backtesting service with QuantConnect Lean integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
)

# Setup monitoring
setup_monitoring(app)

# Initialize services
data_bridge = DataBridge()
backtest_engine = BacktestEngine()
metrics_calculator = MetricsCalculator()
exchange_service = ExchangeService()
security_manager = SecurityManager()

# Docker client for Lean containers (optional)
try:
    docker_client = docker.from_env()
    docker_available = True
except Exception as e:
    docker_client = None
    docker_available = False
    print(f"Warning: Docker not available: {e}")

# In-memory storage for active backtests (in production, use Redis)
active_backtests_storage: Dict[str, Dict] = {}

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting QuantConnect Lean Backtesting Service")
    
    # Test database connection
    try:
        conn = await get_database_connection()
        await conn.close()
        logger.info("Database connection established")
    except Exception as e:
        logger.warning("Database connection failed (non-fatal)", error=str(e))
    
    # Test Docker connection (optional)
    if docker_available:
        try:
            docker_client.ping()
            logger.info("Docker connection established")
        except Exception as e:
            logger.warning("Docker connection failed (optional)", error=str(e))
    else:
        logger.warning("Docker not available - backtest features will be limited")
    
    logger.info("Service startup completed")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down QuantConnect Lean Backtesting Service")
    
    # Cleanup active backtests
    for job_id, backtest_info in active_backtests_storage.items():
        if backtest_info.get("status") == "running":
            try:
                container = docker_client.containers.get(job_id)
                container.stop(timeout=10)
                logger.info("Stopped backtest container", job_id=job_id)
            except Exception as e:
                logger.error("Failed to stop container", job_id=job_id, error=str(e))
    
    logger.info("Service shutdown completed")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "active_backtests": len([b for b in active_backtests_storage.values() if b["status"] == "running"])
    }

@app.post("/backtest", response_model=BacktestResponse)
@limiter.limit("10/minute")
async def run_backtest(
    request: BacktestRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(security_manager.get_user_id)
):
    """
    Run a new backtest with QuantConnect Lean
    """
    logger.info("Starting backtest", user_id=user_id, strategy=request.name)
    
    # Validate user has institutional access
    if not await security_manager.has_institutional_access(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional access required"
        )
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    try:
        # Store backtest info
        backtest_info = {
            "job_id": job_id,
            "user_id": user_id,
            "status": "pending",
            "request": request.dict(),
            "created_at": datetime.utcnow(),
            "progress": 0
        }
        active_backtests_storage[job_id] = backtest_info
        
        # Start backtest in background
        background_tasks.add_task(
            execute_backtest,
            job_id=job_id,
            user_id=user_id,
            request=request
        )
        
        # Log audit event
        await security_manager.log_audit_event(
            user_id=user_id,
            action="backtest_started",
            resource_type="backtest",
            resource_id=job_id,
            details={"strategy": request.name, "symbols": request.symbols}
        )
        
        backtest_requests.labels(status="started").inc()
        active_backtests.inc()
        
        return BacktestResponse(
            job_id=job_id,
            status="pending",
            message="Backtest queued for execution"
        )
        
    except Exception as e:
        logger.error("Failed to start backtest", error=str(e), user_id=user_id)
        backtest_requests.labels(status="failed").inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start backtest: {str(e)}"
        )

@app.get("/backtest/{job_id}", response_model=BacktestResult)
async def get_backtest_status(
    job_id: str,
    user_id: str = Depends(security_manager.get_user_id)
):
    """
    Get the status and results of a backtest
    """
    if job_id not in active_backtests_storage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backtest not found"
        )
    
    backtest_info = active_backtests_storage[job_id]
    
    # Check user ownership
    if backtest_info["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return BacktestResult(
        job_id=job_id,
        status=backtest_info["status"],
        progress=backtest_info.get("progress", 0),
        results=backtest_info.get("results"),
        error_message=backtest_info.get("error_message"),
        created_at=backtest_info["created_at"],
        completed_at=backtest_info.get("completed_at")
    )

@app.get("/backtests")
async def list_backtests(
    user_id: str = Depends(security_manager.get_user_id),
    limit: int = 50,
    offset: int = 0
):
    """
    List user's backtests
    """
    user_backtests = [
        {
            "job_id": job_id,
            "status": info["status"],
            "name": info["request"]["name"],
            "created_at": info["created_at"],
            "progress": info.get("progress", 0)
        }
        for job_id, info in active_backtests_storage.items()
        if info["user_id"] == user_id
    ]
    
    # Sort by created_at descending
    user_backtests.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "backtests": user_backtests[offset:offset + limit],
        "total": len(user_backtests),
        "limit": limit,
        "offset": offset
    }

@app.delete("/backtest/{job_id}")
async def cancel_backtest(
    job_id: str,
    user_id: str = Depends(security_manager.get_user_id)
):
    """
    Cancel a running backtest
    """
    if job_id not in active_backtests_storage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backtest not found"
        )
    
    backtest_info = active_backtests_storage[job_id]
    
    # Check user ownership
    if backtest_info["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if backtest_info["status"] not in ["pending", "running"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel completed or failed backtest"
        )
    
    try:
        # Stop Docker container if running
        if backtest_info["status"] == "running":
            container = docker_client.containers.get(job_id)
            container.stop(timeout=10)
        
        # Update status
        backtest_info["status"] = "cancelled"
        backtest_info["completed_at"] = datetime.utcnow()
        
        active_backtests.dec()
        
        # Log audit event
        await security_manager.log_audit_event(
            user_id=user_id,
            action="backtest_cancelled",
            resource_type="backtest",
            resource_id=job_id
        )
        
        return {"message": "Backtest cancelled successfully"}
        
    except Exception as e:
        logger.error("Failed to cancel backtest", error=str(e), job_id=job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel backtest: {str(e)}"
        )

@app.post("/market-data")
async def fetch_market_data(
    request: MarketDataRequest,
    user_id: str = Depends(security_manager.get_user_id)
):
    """
    Fetch market data for backtesting
    """
    if not await security_manager.has_institutional_access(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional access required"
        )
    
    try:
        data = await data_bridge.fetch_market_data(
            symbols=request.symbols,
            start_date=request.start_date,
            end_date=request.end_date,
            timeframe=request.timeframe,
            exchanges=request.exchanges
        )
        
        return {
            "data": data,
            "symbols": request.symbols,
            "timeframe": request.timeframe,
            "count": len(data)
        }
        
    except Exception as e:
        logger.error("Failed to fetch market data", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch market data: {str(e)}"
        )

async def execute_backtest(
    job_id: str,
    user_id: str,
    request: BacktestRequest
):
    """
    Execute backtest in background
    """
    logger.info("Executing backtest", job_id=job_id, user_id=user_id)
    
    start_time = datetime.utcnow()
    
    try:
        # Update status to running
        active_backtests_storage[job_id]["status"] = "running"
        active_backtests_storage[job_id]["started_at"] = start_time
        
        # Fetch market data
        logger.info("Fetching market data", job_id=job_id)
        active_backtests_storage[job_id]["progress"] = 10
        
        market_data = await data_bridge.fetch_market_data(
            symbols=request.symbols,
            start_date=request.start_date,
            end_date=request.end_date,
            timeframe=request.timeframe or "1h",
            exchanges=request.exchanges or ["binance"]
        )
        
        if not market_data:
            raise Exception("No market data available for the specified symbols and date range")
        
        # Prepare Lean configuration
        logger.info("Preparing Lean configuration", job_id=job_id)
        active_backtests_storage[job_id]["progress"] = 20
        
        lean_config = await backtest_engine.prepare_lean_config(
            request=request,
            market_data=market_data,
            job_id=job_id
        )
        
        # Run Lean backtest
        logger.info("Running Lean backtest", job_id=job_id)
        active_backtests_storage[job_id]["progress"] = 30
        
        lean_results = await backtest_engine.run_lean_backtest(
            config=lean_config,
            job_id=job_id
        )
        
        # Calculate metrics
        logger.info("Calculating metrics", job_id=job_id)
        active_backtests_storage[job_id]["progress"] = 80
        
        metrics = await metrics_calculator.calculate_metrics(
            trades=lean_results.get("trades", []),
            portfolio_values=lean_results.get("portfolio_values", []),
            benchmark_data=lean_results.get("benchmark_data", [])
        )
        
        # Store results
        results = {
            "trades": lean_results.get("trades", []),
            "portfolio_values": lean_results.get("portfolio_values", []),
            "metrics": metrics,
            "config": request.dict(),
            "execution_time": (datetime.utcnow() - start_time).total_seconds()
        }
        
        active_backtests_storage[job_id]["results"] = results
        active_backtests_storage[job_id]["status"] = "completed"
        active_backtests_storage[job_id]["progress"] = 100
        active_backtests_storage[job_id]["completed_at"] = datetime.utcnow()
        
        # Log audit event
        await security_manager.log_audit_event(
            user_id=user_id,
            action="backtest_completed",
            resource_type="backtest",
            resource_id=job_id,
            details={"execution_time": results["execution_time"]}
        )
        
        backtest_requests.labels(status="completed").inc()
        backtest_duration.observe(results["execution_time"])
        active_backtests.dec()
        
        logger.info("Backtest completed successfully", job_id=job_id, execution_time=results["execution_time"])
        
    except Exception as e:
        logger.error("Backtest failed", error=str(e), job_id=job_id)
        
        active_backtests_storage[job_id]["status"] = "failed"
        active_backtests_storage[job_id]["error_message"] = str(e)
        active_backtests_storage[job_id]["completed_at"] = datetime.utcnow()
        
        # Log audit event
        await security_manager.log_audit_event(
            user_id=user_id,
            action="backtest_failed",
            resource_type="backtest",
            resource_id=job_id,
            details={"error": str(e)}
        )
        
        backtest_requests.labels(status="failed").inc()
        active_backtests.dec()

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("ENVIRONMENT") == "development",
        log_level="info"
    )
