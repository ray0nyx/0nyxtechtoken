"""
Request and Response models for WagyuTech API
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class TokenData(BaseModel):
    """Token data response"""
    symbol: str
    name: Optional[str] = None
    address: str
    price: Decimal
    price_usd: Decimal
    change_24h: Decimal
    volume_24h: Decimal
    liquidity: Decimal
    market_cap: Optional[Decimal] = None
    fdv: Optional[Decimal] = None
    holders: Optional[int] = None
    total_supply: Optional[str] = None
    circulating_supply: Optional[str] = None
    pair_address: Optional[str] = None
    chain: str = "solana"
    dex: Optional[str] = None


class TokenSearchResponse(BaseModel):
    """Token search response"""
    tokens: List[TokenData]
    total: int
    page: int = 1
    limit: int = 50


class PriceResponse(BaseModel):
    """Price data response"""
    symbol: str
    price: Decimal
    price_usd: Decimal
    change_24h: Decimal
    timestamp: datetime
    source: str  # Which API provided the data


class OHLCVData(BaseModel):
    """OHLCV candle data"""
    time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


class OHLCVResponse(BaseModel):
    """OHLCV response"""
    symbol: str
    timeframe: str
    data: List[OHLCVData]


class LiquidityData(BaseModel):
    """Liquidity data"""
    symbol: str
    liquidity_usd: Decimal
    liquidity_base: Decimal
    liquidity_quote: Decimal
    liquidity_ratio: Optional[Decimal] = None  # liquidity / market_cap
    timestamp: datetime


class HolderData(BaseModel):
    """Holder distribution data"""
    address: str
    balance: Decimal
    usd_value: Decimal
    percentage: Decimal


class HolderDistributionResponse(BaseModel):
    """Holder distribution response"""
    symbol: str
    total_holders: int
    holders: List[HolderData]
    concentration_risk: str  # 'low', 'medium', 'high'


class TokenAnalytics(BaseModel):
    """Token analytics data"""
    symbol: str
    volatility_24h: Decimal
    volatility_7d: Decimal
    average_volume_24h: Decimal
    price_range_24h: Dict[str, Decimal]  # {high, low}
    buy_sell_ratio: Optional[Decimal] = None
    whale_transactions_24h: Optional[int] = None
    new_holders_24h: Optional[int] = None


class TradingOrderRequest(BaseModel):
    """Trading order request"""
    pair_symbol: str
    order_type: str = Field(..., pattern="^(market|limit|stop_loss|take_profit)$")
    side: str = Field(..., pattern="^(buy|sell)$")
    amount: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = None  # Required for limit orders
    stop_price: Optional[Decimal] = None  # Required for stop orders
    slippage_tolerance: Decimal = Field(default=Decimal("0.01"), ge=0, le=1)  # 1% default
    wallet_address: Optional[str] = None  # For on-chain execution


class TradingOrderResponse(BaseModel):
    """Trading order response"""
    order_id: str
    status: str  # 'pending', 'executed', 'failed', 'canceled'
    pair_symbol: str
    order_type: str
    side: str
    amount: Decimal
    executed_amount: Optional[Decimal] = None
    price: Optional[Decimal] = None
    fee_amount: Decimal
    fee_percentage: Decimal
    transaction_hash: Optional[str] = None
    created_at: datetime


class MonitoringSubscriptionRequest(BaseModel):
    """Monitoring subscription request"""
    subscription_type: str = Field(..., pattern="^(pump_fun_migration|social_signal|new_token|liquidity_change|large_transaction)$")
    filters: Dict[str, Any] = Field(default_factory=dict)
    webhook_url: Optional[str] = None


class MonitoringEvent(BaseModel):
    """Monitoring event"""
    event_id: str
    subscription_id: str
    event_type: str
    token_symbol: Optional[str] = None
    token_address: Optional[str] = None
    pair_address: Optional[str] = None
    event_data: Dict[str, Any]
    created_at: datetime


class SocialSignal(BaseModel):
    """Social media signal"""
    platform: str
    signal_type: str
    token_symbol: str
    token_address: Optional[str] = None
    content: Optional[str] = None
    sentiment_score: Optional[Decimal] = None  # -1 to 1
    engagement_count: Optional[int] = None
    author: Optional[str] = None
    url: Optional[str] = None
    timestamp: datetime


class APIUsageStats(BaseModel):
    """API usage statistics"""
    total_requests: int
    requests_today: int
    requests_this_hour: int
    requests_remaining_this_hour: int
    requests_remaining_today: int
    tier: str
    rate_limit_per_hour: int
    rate_limit_per_minute: int


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    message: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
