"""
WagyuTech API Main Application
FastAPI service for meme coin trading and analytics
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from .models.api_models import (
    TokenData, TokenSearchResponse, PriceResponse, OHLCVResponse,
    LiquidityData, HolderDistributionResponse, TokenAnalytics,
    TradingOrderRequest, TradingOrderResponse,
    MonitoringSubscriptionRequest, MonitoringEvent, SocialSignal,
    APIUsageStats, ErrorResponse
)
from .models.fee_models import get_fee_structure
from .data_aggregator import DataAggregator
from .auth_service import validate_api_key, log_api_usage
from .rate_limiter import check_rate_limit
from .billing_service import BillingService
from .trading_service import TradingService
from .onchain_monitor import OnChainMonitor
from .social_monitor import SocialMonitor

logger = logging.getLogger(__name__)

# Initialize services
billing_service = BillingService()
onchain_monitor = OnChainMonitor()
social_monitor = SocialMonitor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting WagyuTech API service")
    # Try to start monitoring services, but don't fail if they can't connect
    try:
        await onchain_monitor.start_monitoring()
    except Exception as e:
        logger.warning(f"On-chain monitor failed to start: {e}. Continuing without it.")
    try:
        await social_monitor.start_monitoring()
    except Exception as e:
        logger.warning(f"Social monitor failed to start: {e}. Continuing without it.")
    yield
    # Shutdown
    logger.info("Shutting down WagyuTech API service")
    try:
        await onchain_monitor.stop_monitoring()
    except Exception:
        pass
    try:
        await social_monitor.stop_monitoring()
    except Exception:
        pass


app = FastAPI(
    title="WagyuTech API",
    description="Comprehensive API for meme coin trading and analytics",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency for API key authentication
async def get_api_key_info(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> dict:
    """Validate API key and return user info"""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header."
        )
    
    key_info = await validate_api_key(x_api_key)
    if not key_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return key_info


# Dependency for rate limiting
async def check_rate_limit_dep(
    api_key_info: dict = Depends(get_api_key_info)
) -> dict:
    """Check rate limits before processing request"""
    is_allowed, rate_info = await check_rate_limit(
        api_key_info['key_id'],
        api_key_info['rate_limit_per_minute'],
        api_key_info['rate_limit_per_hour']
    )
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. {rate_info}",
            headers={
                "X-RateLimit-Remaining-Minute": str(rate_info['remaining_per_minute']),
                "X-RateLimit-Remaining-Hour": str(rate_info['remaining_per_hour']),
                "X-RateLimit-Reset": str(rate_info.get('reset_at', 0)),
            }
        )
    
    return api_key_info


# Middleware to log API usage
@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    """Log all API requests"""
    start_time = time.time()
    
    # Get API key from header
    api_key = request.headers.get("X-API-Key")
    api_key_id = None
    user_id = None
    
    if api_key:
        key_info = await validate_api_key(api_key)
        if key_info:
            api_key_id = key_info['key_id']
            user_id = key_info['user_id']
    
    # Process request
    response = await call_next(request)
    
    # Log usage
    process_time = int((time.time() - start_time) * 1000)
    if api_key_id and user_id:
        await log_api_usage(
            api_key_id=api_key_id,
            user_id=user_id,
            endpoint=request.url.path,
            method=request.method,
            response_time_ms=process_time,
            status_code=response.status_code,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    
    # Add rate limit headers
    if api_key_id:
        _, rate_info = await check_rate_limit(
            api_key_id,
            100,  # Would get from key_info
            1000
        )
        response.headers["X-RateLimit-Remaining-Minute"] = str(rate_info['remaining_per_minute'])
        response.headers["X-RateLimit-Remaining-Hour"] = str(rate_info['remaining_per_hour'])
    
    return response


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "WagyuTech API"}


# Public endpoints (no auth required) - for frontend use
@app.get("/api/public/tokens/new")
async def get_new_tokens_public(limit: int = 20):
    """Get newly listed tokens - public endpoint"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.fetch_new_tokens(limit)
        return {
            "tokens": tokens_data,
            "total": len(tokens_data),
            "limit": limit
        }


@app.get("/api/public/tokens/surging")
async def get_surging_tokens_public(limit: int = 20):
    """Get surging tokens - public endpoint"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.fetch_surging_tokens(limit)
        return {
            "tokens": tokens_data,
            "total": len(tokens_data),
            "limit": limit
        }


# Token endpoints
@app.get("/api/v1/tokens/search", response_model=TokenSearchResponse)
async def search_tokens(
    q: str,
    limit: int = 50,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Search for tokens"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.search_tokens(q, limit)
        
        tokens = [
            TokenData(
                symbol=token['symbol'],
                address=token.get('address', ''),
                price=token['price'],
                price_usd=token.get('price_usd', token['price']),
                change_24h=token.get('change_24h', Decimal('0')),
                volume_24h=token.get('volume_24h', Decimal('0')),
                liquidity=token.get('liquidity', Decimal('0')),
                pair_address=token.get('pair_address'),
            )
            for token in tokens_data
        ]
        
        return TokenSearchResponse(
            tokens=tokens,
            total=len(tokens),
            limit=limit
        )


@app.get("/api/v1/tokens/{symbol}", response_model=TokenData)
async def get_token_data(
    symbol: str,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get token data"""
    async with DataAggregator() as aggregator:
        token_data = await aggregator.fetch_token_data(symbol)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Token {symbol} not found"
            )
        
        return TokenData(**token_data)


@app.get("/api/v1/tokens/trending", response_model=List[TokenData])
async def get_trending_tokens(
    limit: int = 20,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get trending tokens"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.fetch_trending_tokens(limit)
        
        return [
            TokenData(
                symbol=token['symbol'],
                address=token.get('address', ''),
                price=token['price'],
                price_usd=token.get('price_usd', token['price']),
                change_24h=token.get('change_24h', Decimal('0')),
                volume_24h=token.get('volume_24h', Decimal('0')),
                liquidity=token.get('liquidity', Decimal('0')),
            )
            for token in tokens_data
        ]


@app.get("/api/v1/tokens/new")
async def get_new_tokens(
    limit: int = 20,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get newly listed tokens - sorted by creation time"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.fetch_new_tokens(limit)
        
        return {
            "tokens": tokens_data,
            "total": len(tokens_data),
            "limit": limit
        }


@app.get("/api/v1/tokens/surging")
async def get_surging_tokens(
    limit: int = 20,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get tokens with highest volume/price surge in last 24h"""
    async with DataAggregator() as aggregator:
        tokens_data = await aggregator.fetch_surging_tokens(limit)
        
        return {
            "tokens": tokens_data,
            "total": len(tokens_data),
            "limit": limit
        }


@app.get("/api/v1/prices/{symbol}", response_model=PriceResponse)
async def get_price(
    symbol: str,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get real-time price"""
    async with DataAggregator() as aggregator:
        token_data = await aggregator.fetch_token_data(symbol)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Price data not found for {symbol}"
            )
        
        return PriceResponse(
            symbol=symbol,
            price=token_data.get('price', Decimal('0')),
            price_usd=token_data.get('price_usd', token_data.get('price', Decimal('0'))),
            change_24h=token_data.get('change_24h', Decimal('0')),
            timestamp=datetime.now(),
            source=token_data.get('source', 'unknown')
        )


@app.get("/api/v1/ohlcv/{symbol}", response_model=OHLCVResponse)
async def get_ohlcv(
    symbol: str,
    timeframe: str = "1h",
    limit: int = 100,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get OHLCV data"""
    async with DataAggregator() as aggregator:
        ohlcv_data = await aggregator.fetch_ohlcv(symbol, timeframe, limit)
        
        # Convert to response format
        from .models.api_models import OHLCVData as OHLCVDataModel
        
        candles = [
            OHLCVDataModel(
                time=datetime.fromisoformat(candle['time']) if isinstance(candle['time'], str) else candle['time'],
                open=Decimal(str(candle['open'])),
                high=Decimal(str(candle['high'])),
                low=Decimal(str(candle['low'])),
                close=Decimal(str(candle['close'])),
                volume=Decimal(str(candle.get('volume', 0))),
            )
            for candle in ohlcv_data
        ]
        
        return OHLCVResponse(
            symbol=symbol,
            timeframe=timeframe,
            data=candles
        )


@app.get("/api/v1/liquidity/{symbol}", response_model=LiquidityData)
async def get_liquidity(
    symbol: str,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get liquidity data"""
    async with DataAggregator() as aggregator:
        liquidity_data = await aggregator.fetch_liquidity(symbol)
        
        if not liquidity_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Liquidity data not found for {symbol}"
            )
        
        return LiquidityData(
            symbol=symbol,
            liquidity_usd=liquidity_data['liquidity_usd'],
            liquidity_base=Decimal('0'),  # Would need pair data
            liquidity_quote=Decimal('0'),
            liquidity_ratio=liquidity_data.get('liquidity_ratio'),
            timestamp=liquidity_data['timestamp']
        )


@app.get("/api/v1/holders/{symbol}", response_model=HolderDistributionResponse)
async def get_holders(
    symbol: str,
    limit: int = 100,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get holder distribution"""
    # Would need token address, not just symbol
    # For now, return placeholder
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Holder distribution requires token address. Use /api/v1/tokens/{symbol} first to get address."
    )


@app.get("/api/v1/analytics/{symbol}", response_model=TokenAnalytics)
async def get_analytics(
    symbol: str,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get token analytics"""
    async with DataAggregator() as aggregator:
        token_data = await aggregator.fetch_token_data(symbol)
        
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Token {symbol} not found"
            )
        
        # Calculate basic analytics
        # In production, would calculate from historical data
        return TokenAnalytics(
            symbol=symbol,
            volatility_24h=abs(token_data.get('change_24h', Decimal('0'))),
            volatility_7d=Decimal('0'),  # Would need historical data
            average_volume_24h=token_data.get('volume_24h', Decimal('0')),
            price_range_24h={
                'high': token_data.get('price', Decimal('0')) * Decimal('1.1'),
                'low': token_data.get('price', Decimal('0')) * Decimal('0.9'),
            },
        )


# Monitoring endpoints
@app.post("/api/v1/monitor/pump-fun")
async def subscribe_pump_fun(
    subscription: MonitoringSubscriptionRequest,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Subscribe to Pump.fun migration events"""
    # Check tier allows monitoring
    tier = api_key_info['tier']
    if tier == 'free':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Monitoring requires Pro or Enterprise tier"
        )
    
    # Create subscription in database
    # In production, would store in monitoring_subscriptions table
    return {"subscription_id": "sub_123", "status": "active"}


@app.post("/api/v1/monitor/social")
async def subscribe_social(
    subscription: MonitoringSubscriptionRequest,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Subscribe to social signals"""
    tier = api_key_info['tier']
    if tier == 'free':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Social monitoring requires Pro or Enterprise tier"
        )
    
    return {"subscription_id": "sub_456", "status": "active"}


@app.get("/api/v1/monitor/events", response_model=List[MonitoringEvent])
async def get_monitoring_events(
    subscription_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get monitoring events"""
    # Query monitoring_events table
    # Filter by user's subscriptions
    return []


# Trading endpoints
@app.post("/api/v1/trade/market", response_model=TradingOrderResponse)
async def execute_market_order(
    order: TradingOrderRequest,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Execute market order with fees"""
    tier = api_key_info['tier']
    if tier == 'free':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trading requires Pro or Enterprise tier"
        )
    
    async with TradingService() as trading_service:
        order_result = await trading_service.execute_market_order(
            user_id=api_key_info['user_id'],
            api_key_id=api_key_info['key_id'],
            pair_symbol=order.pair_symbol,
            side=order.side,
            amount=order.amount,
            slippage_tolerance=order.slippage_tolerance,
            wallet_address=order.wallet_address,
            user_tier=tier
        )
        
        return TradingOrderResponse(**order_result)


@app.post("/api/v1/trade/limit", response_model=TradingOrderResponse)
async def create_limit_order(
    order: TradingOrderRequest,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Create limit order"""
    tier = api_key_info['tier']
    if tier == 'free':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trading requires Pro or Enterprise tier"
        )
    
    if not order.price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price required for limit orders"
        )
    
    async with TradingService() as trading_service:
        order_result = await trading_service.create_limit_order(
            user_id=api_key_info['user_id'],
            api_key_id=api_key_info['key_id'],
            pair_symbol=order.pair_symbol,
            side=order.side,
            amount=order.amount,
            price=order.price,
            user_tier=tier
        )
        
        return TradingOrderResponse(**order_result)


@app.get("/api/v1/trade/orders", response_model=List[TradingOrderResponse])
async def get_orders(
    status_filter: Optional[str] = None,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get user's orders"""
    # Query orders from database
    # Filter by user_id and optional status
    return []


@app.delete("/api/v1/trade/orders/{order_id}")
async def cancel_order(
    order_id: str,
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Cancel an order"""
    # Cancel order in database/system
    return {"order_id": order_id, "status": "canceled"}


# Billing endpoints
@app.get("/api/v1/billing/usage", response_model=APIUsageStats)
async def get_usage_stats(
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get API usage statistics"""
    stats = await billing_service.get_api_usage_stats(
        user_id=api_key_info['user_id'],
        api_key_id=api_key_info['key_id']
    )
    
    return APIUsageStats(**stats)


@app.get("/api/v1/billing/invoice")
async def get_invoices(
    api_key_info: dict = Depends(check_rate_limit_dep)
):
    """Get billing history"""
    # Query trading_fees and subscription history
    fees_summary = await billing_service.get_trading_fees_summary(
        user_id=api_key_info['user_id']
    )
    
    return fees_summary


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
