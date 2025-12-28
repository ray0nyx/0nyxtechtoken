"""
Monitoring and metrics utilities
"""

import time
import logging
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import FastAPI, Request, Response
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)

# Prometheus metrics
backtest_requests = Counter(
    'backtest_requests_total',
    'Total number of backtest requests',
    ['status']  # status: started, completed, failed
)

backtest_duration = Histogram(
    'backtest_duration_seconds',
    'Time spent on backtest execution',
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600]  # 1s to 1h
)

active_backtests = Gauge(
    'active_backtests',
    'Number of currently active backtests'
)

market_data_requests = Counter(
    'market_data_requests_total',
    'Total number of market data requests',
    ['exchange', 'symbol']
)

exchange_api_calls = Counter(
    'exchange_api_calls_total',
    'Total number of exchange API calls',
    ['exchange', 'endpoint', 'status']
)

database_connections = Gauge(
    'database_connections_active',
    'Number of active database connections'
)

memory_usage = Gauge(
    'memory_usage_bytes',
    'Memory usage in bytes'
)

cpu_usage = Gauge(
    'cpu_usage_percent',
    'CPU usage percentage'
)

# Copy trading metrics
copy_trades_executed = Counter(
    'copy_trades_executed_total',
    'Total copy trades executed successfully',
    ['exchange']
)

copy_trades_failed = Counter(
    'copy_trades_failed_total',
    'Total copy trades that failed',
    ['exchange']
)

realtime_connections = Gauge(
    'realtime_sync_connections',
    'Number of active real-time sync connections',
    ['config_id']
)

sync_latency = Histogram(
    'sync_latency_seconds',
    'Histogram of sync operation latency in seconds'
)

trade_execution_time = Histogram(
    'trade_execution_time_seconds',
    'Histogram of trade execution time in seconds'
)

broker_connections = Gauge(
    'broker_connections',
    'Number of active broker connections',
    ['exchange']
)

broker_errors = Counter(
    'broker_errors_total',
    'Total broker errors',
    ['exchange', 'error_type']
)

broker_latency = Histogram(
    'broker_latency_seconds',
    'Histogram of broker operation latency in seconds'
)

reconciliation_checks = Counter(
    'reconciliation_checks_total',
    'Total reconciliation checks performed',
    ['config_id']
)

reconciliation_errors = Counter(
    'reconciliation_errors_total',
    'Total reconciliation errors',
    ['config_id', 'error_type']
)

reconciliation_corrections = Counter(
    'reconciliation_corrections_total',
    'Total reconciliation corrections made',
    ['config_id', 'correction_type']
)

sync_errors = Counter(
    'sync_errors_total',
    'Total sync errors',
    ['error_type']
)

copy_trading_requests = Counter(
    'copy_trading_requests_total',
    'Total copy trading API requests',
    ['action', 'status']
)

def setup_monitoring(app: FastAPI):
    """Setup monitoring middleware and endpoints"""
    
    @app.middleware("http")
    async def monitoring_middleware(request: Request, call_next):
        """Middleware to track request metrics"""
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log request
        logger.info(
            "Request processed",
            method=request.method,
            url=str(request.url),
            status_code=response.status_code,
            duration=duration
        )
        
        return response
    
    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint"""
        return PlainTextResponse(
            generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "active_backtests": active_backtests._value._value
        }
    
    logger.info("Monitoring setup completed")

def track_backtest_request(status: str):
    """Track backtest request"""
    backtest_requests.labels(status=status).inc()

def track_backtest_duration(duration: float):
    """Track backtest duration"""
    backtest_duration.observe(duration)

def track_market_data_request(exchange: str, symbol: str):
    """Track market data request"""
    market_data_requests.labels(exchange=exchange, symbol=symbol).inc()

def track_exchange_api_call(exchange: str, endpoint: str, status: str):
    """Track exchange API call"""
    exchange_api_calls.labels(exchange=exchange, endpoint=endpoint, status=status).inc()

def update_active_backtests(count: int):
    """Update active backtests count"""
    active_backtests.set(count)

def update_database_connections(count: int):
    """Update database connections count"""
    database_connections.set(count)

def update_memory_usage(bytes_used: int):
    """Update memory usage"""
    memory_usage.set(bytes_used)

def update_cpu_usage(percent: float):
    """Update CPU usage"""
    cpu_usage.set(percent)
