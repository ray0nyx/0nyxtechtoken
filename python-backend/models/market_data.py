"""
Pydantic models for market data
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class Timeframe(str, Enum):
    """Supported timeframes"""
    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"

class MarketType(str, Enum):
    """Market types"""
    SPOT = "spot"
    FUTURES = "futures"
    OPTIONS = "options"
    MARGIN = "margin"

class OHLCVData(BaseModel):
    """OHLCV data point"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    symbol: str
    timeframe: str

class SymbolInfo(BaseModel):
    """Symbol information"""
    symbol: str
    base: str
    quote: str
    exchange: str
    market_type: MarketType
    active: bool
    precision: Dict[str, Any]
    limits: Dict[str, Any]
    fees: Dict[str, Any]

class MarketDataRequest(BaseModel):
    """Market data request"""
    symbol: str
    timeframe: Timeframe = Timeframe.HOUR_1
    limit: int = Field(default=100, ge=1, le=1000)
    exchange: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class BacktestDataRequest(BaseModel):
    """Backtest data request"""
    symbols: List[str]
    timeframe: Timeframe = Timeframe.HOUR_1
    start_date: datetime
    end_date: datetime
    exchanges: Optional[List[str]] = None
    include_indicators: bool = True
    indicators: Optional[List[str]] = None

class RealTimeData(BaseModel):
    """Real-time market data"""
    symbol: str
    price: float
    volume: float
    timestamp: datetime
    bid: Optional[float] = None
    ask: Optional[float] = None
    change_24h: Optional[float] = None
    change_percent_24h: Optional[float] = None

class ExchangeInfo(BaseModel):
    """Exchange information"""
    id: str
    name: str
    countries: List[str]
    version: str
    certified: bool
    has: Dict[str, bool]
    urls: Dict[str, List[str]]
    api: Dict[str, Any]
    fees: Dict[str, Any]
    markets: Dict[str, Any]
    symbols: List[str]
    timeframes: List[str]

class TechnicalIndicator(BaseModel):
    """Technical indicator data"""
    name: str
    symbol: str
    timeframe: str
    values: List[float]
    timestamps: List[datetime]
    parameters: Dict[str, Any]
