"""
Pydantic models for backtest requests and responses
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, validator
from enum import Enum

class BacktestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TimeFrame(str, Enum):
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    HOUR_8 = "8h"
    HOUR_12 = "12h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"

class ExchangeType(str, Enum):
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"
    BYBIT = "bybit"
    OKX = "okx"
    POLYGON = "polygon"

class BacktestRequest(BaseModel):
    """Request model for starting a backtest"""
    name: str = Field(..., min_length=1, max_length=100, description="Name of the backtest")
    description: Optional[str] = Field(None, max_length=500, description="Description of the backtest")
    strategy_code: str = Field(..., min_length=10, description="Python strategy code")
    symbols: List[str] = Field(..., min_items=1, max_items=10, description="List of symbols to trade")
    start_date: date = Field(..., description="Start date for backtest")
    end_date: date = Field(..., description="End date for backtest")
    initial_capital: float = Field(..., gt=0, le=10000000, description="Initial capital amount")
    timeframe: Optional[TimeFrame] = Field(TimeFrame.HOUR_1, description="Data timeframe")
    exchanges: Optional[List[ExchangeType]] = Field([ExchangeType.BINANCE], description="Data exchanges")
    
    # Strategy parameters
    rebalance_frequency: Optional[str] = Field("daily", description="Rebalancing frequency")
    transaction_costs: Optional[float] = Field(0.001, ge=0, le=0.01, description="Transaction costs per trade")
    slippage: Optional[float] = Field(0.0005, ge=0, le=0.01, description="Slippage per trade")
    max_positions: Optional[int] = Field(10, ge=1, le=50, description="Maximum number of positions")
    risk_free_rate: Optional[float] = Field(0.02, ge=0, le=0.1, description="Risk-free rate for calculations")
    benchmark: Optional[str] = Field("BTC/USDT", description="Benchmark symbol")
    
    # Advanced parameters
    warmup_period: Optional[int] = Field(30, ge=0, le=365, description="Warmup period in days")
    max_drawdown_limit: Optional[float] = Field(0.2, ge=0, le=1, description="Maximum drawdown limit")
    position_sizing: Optional[str] = Field("equal", description="Position sizing method")
    
    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v
    
    @validator('symbols')
    def symbols_must_be_valid(cls, v):
        for symbol in v:
            if not symbol or len(symbol.split('/')) != 2:
                raise ValueError(f'Invalid symbol format: {symbol}. Expected format: BASE/QUOTE')
        return v

class BacktestResponse(BaseModel):
    """Response model for backtest creation"""
    job_id: str = Field(..., description="Unique job identifier")
    status: BacktestStatus = Field(..., description="Current backtest status")
    message: str = Field(..., description="Status message")

class BacktestResult(BaseModel):
    """Response model for backtest results"""
    job_id: str = Field(..., description="Unique job identifier")
    status: BacktestStatus = Field(..., description="Current backtest status")
    progress: int = Field(0, ge=0, le=100, description="Progress percentage")
    results: Optional[Dict[str, Any]] = Field(None, description="Backtest results")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    created_at: datetime = Field(..., description="Creation timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")

class MarketDataRequest(BaseModel):
    """Request model for fetching market data"""
    symbols: List[str] = Field(..., min_items=1, max_items=10, description="List of symbols")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    timeframe: TimeFrame = Field(TimeFrame.HOUR_1, description="Data timeframe")
    exchanges: List[ExchangeType] = Field([ExchangeType.BINANCE], description="Data exchanges")
    
    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v

class Trade(BaseModel):
    """Model for individual trade"""
    symbol: str = Field(..., description="Trading symbol")
    side: str = Field(..., description="Trade side (buy/sell)")
    quantity: float = Field(..., gt=0, description="Trade quantity")
    price: float = Field(..., gt=0, description="Trade price")
    timestamp: datetime = Field(..., description="Trade timestamp")
    commission: float = Field(0, ge=0, description="Commission paid")
    slippage: float = Field(0, ge=0, description="Slippage incurred")
    order_id: Optional[str] = Field(None, description="Order identifier")

class PortfolioValue(BaseModel):
    """Model for portfolio value at a point in time"""
    timestamp: datetime = Field(..., description="Timestamp")
    total_value: float = Field(..., gt=0, description="Total portfolio value")
    cash: float = Field(..., ge=0, description="Cash amount")
    holdings: Dict[str, float] = Field(..., description="Holdings by symbol")
    pnl: float = Field(..., description="Profit and loss")
    drawdown: float = Field(..., le=0, description="Current drawdown")

class BacktestMetrics(BaseModel):
    """Model for backtest performance metrics"""
    # Return metrics
    total_return: float = Field(..., description="Total return percentage")
    annualized_return: float = Field(..., description="Annualized return percentage")
    cagr: float = Field(..., description="Compound Annual Growth Rate")
    
    # Risk metrics
    volatility: float = Field(..., ge=0, description="Volatility (standard deviation)")
    max_drawdown: float = Field(..., le=0, description="Maximum drawdown percentage")
    max_drawdown_duration: int = Field(..., ge=0, description="Maximum drawdown duration in days")
    var_95: float = Field(..., description="95% Value at Risk")
    var_99: float = Field(..., description="99% Value at Risk")
    expected_shortfall: float = Field(..., description="Expected Shortfall (CVaR)")
    
    # Risk-adjusted metrics
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    sortino_ratio: float = Field(..., description="Sortino ratio")
    calmar_ratio: float = Field(..., description="Calmar ratio")
    information_ratio: float = Field(..., description="Information ratio")
    
    # Benchmark comparison
    alpha: float = Field(..., description="Alpha vs benchmark")
    beta: float = Field(..., description="Beta vs benchmark")
    tracking_error: float = Field(..., ge=0, description="Tracking error")
    
    # Trade statistics
    total_trades: int = Field(..., ge=0, description="Total number of trades")
    winning_trades: int = Field(..., ge=0, description="Number of winning trades")
    losing_trades: int = Field(..., ge=0, description="Number of losing trades")
    win_rate: float = Field(..., ge=0, le=1, description="Win rate percentage")
    profit_factor: float = Field(..., ge=0, description="Profit factor")
    expectancy: float = Field(..., description="Trade expectancy")
    avg_win: float = Field(..., description="Average winning trade")
    avg_loss: float = Field(..., description="Average losing trade")
    largest_win: float = Field(..., description="Largest winning trade")
    largest_loss: float = Field(..., description="Largest losing trade")
    
    # Additional metrics
    turnover: float = Field(..., ge=0, description="Portfolio turnover")
    exposure: float = Field(..., ge=0, le=1, description="Average market exposure")
    concentration: float = Field(..., ge=0, le=1, description="Portfolio concentration")

class ExchangeCredentials(BaseModel):
    """Model for exchange API credentials"""
    exchange_name: ExchangeType = Field(..., description="Exchange name")
    api_key: str = Field(..., min_length=10, description="API key")
    api_secret: str = Field(..., min_length=10, description="API secret")
    passphrase: Optional[str] = Field(None, description="Passphrase (for some exchanges)")
    sandbox: bool = Field(True, description="Use sandbox environment")
    
class LeanConfig(BaseModel):
    """Model for Lean backtest configuration"""
    job_id: str = Field(..., description="Job identifier")
    strategy_code: str = Field(..., description="Strategy code")
    data_folder: str = Field(..., description="Data folder path")
    results_folder: str = Field(..., description="Results folder path")
    config_file: str = Field(..., description="Configuration file path")
    parameters: Dict[str, Any] = Field(..., description="Strategy parameters")

class LeanResults(BaseModel):
    """Model for Lean backtest results"""
    trades: List[Trade] = Field(..., description="List of trades")
    portfolio_values: List[PortfolioValue] = Field(..., description="Portfolio values over time")
    benchmark_data: List[PortfolioValue] = Field(..., description="Benchmark performance")
    metrics: BacktestMetrics = Field(..., description="Calculated metrics")
    execution_time: float = Field(..., description="Execution time in seconds")
    lean_logs: Optional[str] = Field(None, description="Lean execution logs")
