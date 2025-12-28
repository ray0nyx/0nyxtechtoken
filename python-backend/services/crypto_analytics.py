"""
Crypto Analytics Service

Provides crypto-specific data for backtesting:
- Perpetual funding rates
- Liquidation data
- Open interest
- On-chain analytics (basic)
"""

import asyncio
import aiohttp
import ccxt.async_support as ccxt
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import pandas as pd
import numpy as np


@dataclass
class FundingRate:
    """Funding rate data point"""
    timestamp: str
    symbol: str
    rate: float
    predicted_rate: Optional[float] = None
    funding_interval: int = 8  # hours


@dataclass
class Liquidation:
    """Liquidation event"""
    timestamp: str
    symbol: str
    side: str  # 'long' or 'short'
    price: float
    qty: float
    value_usd: float


@dataclass
class OpenInterest:
    """Open interest data point"""
    timestamp: str
    symbol: str
    open_interest: float
    open_interest_usd: float


class CryptoAnalyticsService:
    """
    Service for fetching crypto-specific analytics data.
    
    Supports:
    - Binance perpetual futures
    - Bybit
    - OKX
    - Coinbase (spot only)
    """

    def __init__(self):
        self.exchanges: Dict[str, ccxt.Exchange] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    async def initialize(self):
        """Initialize exchange connections"""
        # Initialize exchanges for funding rate data
        self.exchanges['binance'] = ccxt.binance({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'future',  # Use futures API
            }
        })
        
        self.exchanges['bybit'] = ccxt.bybit({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'linear',
            }
        })
        
        self._session = aiohttp.ClientSession()

    async def cleanup(self):
        """Cleanup connections"""
        for exchange in self.exchanges.values():
            await exchange.close()
        if self._session:
            await self._session.close()

    # ==================== FUNDING RATES ====================

    async def get_funding_rate(self, exchange: str, symbol: str) -> Optional[FundingRate]:
        """Get current funding rate for a symbol"""
        if exchange not in self.exchanges:
            return None
        
        ex = self.exchanges[exchange]
        
        try:
            if exchange == 'binance':
                # Binance funding rate API
                funding = await ex.fetch_funding_rate(symbol)
                return FundingRate(
                    timestamp=datetime.utcnow().isoformat(),
                    symbol=symbol,
                    rate=funding.get('fundingRate', 0) * 100,  # Convert to percentage
                    predicted_rate=funding.get('markPrice', 0),
                )
            elif exchange == 'bybit':
                funding = await ex.fetch_funding_rate(symbol)
                return FundingRate(
                    timestamp=datetime.utcnow().isoformat(),
                    symbol=symbol,
                    rate=funding.get('fundingRate', 0) * 100,
                )
        except Exception as e:
            print(f"Error fetching funding rate: {e}")
            return None

    async def get_funding_rate_history(
        self,
        exchange: str,
        symbol: str,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100,
    ) -> List[FundingRate]:
        """Get historical funding rates"""
        if exchange not in self.exchanges:
            return []
        
        ex = self.exchanges[exchange]
        
        try:
            if exchange == 'binance':
                since = int(start_time.timestamp() * 1000) if start_time else None
                
                # Binance specific endpoint
                params = {
                    'symbol': symbol.replace('/', ''),
                    'limit': limit,
                }
                if since:
                    params['startTime'] = since
                
                funding_history = await ex.fapiPublic_get_fundingrate(params)
                
                return [
                    FundingRate(
                        timestamp=datetime.fromtimestamp(f['fundingTime'] / 1000).isoformat(),
                        symbol=symbol,
                        rate=float(f['fundingRate']) * 100,
                    )
                    for f in funding_history
                ]
        except Exception as e:
            print(f"Error fetching funding rate history: {e}")
            return []

    async def get_all_funding_rates(self, exchange: str) -> Dict[str, FundingRate]:
        """Get funding rates for all perpetual contracts"""
        if exchange not in self.exchanges:
            return {}
        
        ex = self.exchanges[exchange]
        result = {}
        
        try:
            if exchange == 'binance':
                # Binance provides a bulk endpoint
                rates = await ex.fapiPublic_get_premiumindex()
                for rate in rates:
                    symbol = rate.get('symbol', '')
                    if 'USDT' in symbol:
                        result[symbol] = FundingRate(
                            timestamp=datetime.utcnow().isoformat(),
                            symbol=symbol,
                            rate=float(rate.get('lastFundingRate', 0)) * 100,
                            predicted_rate=float(rate.get('markPrice', 0)),
                        )
        except Exception as e:
            print(f"Error fetching all funding rates: {e}")
        
        return result

    # ==================== OPEN INTEREST ====================

    async def get_open_interest(self, exchange: str, symbol: str) -> Optional[OpenInterest]:
        """Get current open interest for a symbol"""
        if exchange not in self.exchanges:
            return None
        
        ex = self.exchanges[exchange]
        
        try:
            if exchange == 'binance':
                params = {'symbol': symbol.replace('/', '')}
                oi = await ex.fapiPublic_get_openinterest(params)
                
                ticker = await ex.fetch_ticker(symbol)
                price = ticker.get('last', 0)
                
                return OpenInterest(
                    timestamp=datetime.utcnow().isoformat(),
                    symbol=symbol,
                    open_interest=float(oi.get('openInterest', 0)),
                    open_interest_usd=float(oi.get('openInterest', 0)) * price,
                )
        except Exception as e:
            print(f"Error fetching open interest: {e}")
            return None

    async def get_open_interest_history(
        self,
        exchange: str,
        symbol: str,
        period: str = '5m',
        limit: int = 100,
    ) -> List[OpenInterest]:
        """Get historical open interest"""
        if exchange not in self.exchanges:
            return []
        
        ex = self.exchanges[exchange]
        
        try:
            if exchange == 'binance':
                params = {
                    'symbol': symbol.replace('/', ''),
                    'period': period,
                    'limit': limit,
                }
                oi_history = await ex.fapiData_get_openinteresthist(params)
                
                return [
                    OpenInterest(
                        timestamp=datetime.fromtimestamp(o['timestamp'] / 1000).isoformat(),
                        symbol=symbol,
                        open_interest=float(o.get('sumOpenInterest', 0)),
                        open_interest_usd=float(o.get('sumOpenInterestValue', 0)),
                    )
                    for o in oi_history
                ]
        except Exception as e:
            print(f"Error fetching open interest history: {e}")
            return []

    # ==================== LIQUIDATIONS ====================

    async def get_liquidations(
        self,
        exchange: str,
        symbol: str,
        limit: int = 100,
    ) -> List[Liquidation]:
        """Get recent liquidations (requires specific API access)"""
        # Note: Most exchanges don't provide liquidation data via public API
        # This is a placeholder for future integration with liquidation feeds
        
        # For now, return empty list - would need to subscribe to WebSocket
        # or use third-party liquidation aggregators
        return []

    async def aggregate_liquidations(
        self,
        symbol: str,
        interval: str = '1h',
        lookback_hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Aggregate liquidation data (mock for now).
        In production, this would aggregate from multiple sources.
        """
        return {
            "symbol": symbol,
            "interval": interval,
            "total_long_liquidations_usd": 0,
            "total_short_liquidations_usd": 0,
            "largest_liquidation_usd": 0,
            "liquidation_count": 0,
            "lookback_hours": lookback_hours,
        }

    # ==================== ON-CHAIN ANALYTICS ====================

    async def get_exchange_flows(self, symbol: str = "BTC") -> Dict[str, Any]:
        """
        Get exchange inflow/outflow data.
        Note: This would require integration with on-chain data providers
        like Glassnode, CryptoQuant, or IntoTheBlock.
        """
        # Placeholder - would need API keys for real data
        return {
            "symbol": symbol,
            "inflow_24h": 0,
            "outflow_24h": 0,
            "net_flow_24h": 0,
            "exchange_balance": 0,
            "data_source": "placeholder",
        }

    async def get_whale_transactions(
        self,
        symbol: str = "BTC",
        min_value_usd: float = 1000000,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get large whale transactions.
        Note: Would require integration with Whale Alert API or similar.
        """
        return []

    # ==================== INTEGRATED ANALYTICS ====================

    async def get_market_sentiment(self, symbol: str) -> Dict[str, Any]:
        """
        Calculate market sentiment score based on multiple factors.
        """
        try:
            # Get funding rate
            funding = await self.get_funding_rate('binance', symbol)
            
            # Get open interest
            oi = await self.get_open_interest('binance', symbol)
            
            # Calculate sentiment score (-100 to +100)
            sentiment_score = 0
            
            if funding:
                # Positive funding = more longs than shorts
                if funding.rate > 0.01:
                    sentiment_score += 20  # Bullish
                elif funding.rate < -0.01:
                    sentiment_score -= 20  # Bearish
            
            return {
                "symbol": symbol,
                "sentiment_score": sentiment_score,
                "funding_rate": funding.rate if funding else 0,
                "open_interest": oi.open_interest if oi else 0,
                "open_interest_usd": oi.open_interest_usd if oi else 0,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            print(f"Error calculating market sentiment: {e}")
            return {
                "symbol": symbol,
                "sentiment_score": 0,
                "error": str(e),
            }

    async def get_funding_arbitrage_opportunities(
        self,
        min_rate_diff: float = 0.01,
    ) -> List[Dict[str, Any]]:
        """
        Find funding rate arbitrage opportunities across exchanges.
        """
        opportunities = []
        
        try:
            # Get funding rates from multiple exchanges
            binance_rates = await self.get_all_funding_rates('binance')
            
            # In production, would compare with other exchanges
            # For now, just return high funding rate symbols
            for symbol, rate in binance_rates.items():
                if abs(rate.rate) > min_rate_diff:
                    opportunities.append({
                        "symbol": symbol,
                        "exchange": "binance",
                        "funding_rate": rate.rate,
                        "strategy": "short" if rate.rate > 0 else "long",
                        "expected_yield_8h": abs(rate.rate),
                    })
            
            # Sort by absolute funding rate
            opportunities.sort(key=lambda x: abs(x['funding_rate']), reverse=True)
            
        except Exception as e:
            print(f"Error finding arbitrage opportunities: {e}")
        
        return opportunities[:20]  # Top 20


# ==================== DATA FOR BACKTESTING ====================

class CryptoDataEnricher:
    """
    Enriches OHLCV data with crypto-specific metrics for backtesting.
    """

    def __init__(self, analytics_service: CryptoAnalyticsService):
        self.analytics = analytics_service

    async def enrich_with_funding_rates(
        self,
        data: pd.DataFrame,
        exchange: str,
        symbol: str,
    ) -> pd.DataFrame:
        """
        Add funding rate column to OHLCV data.
        """
        # Get funding rate history
        funding_history = await self.analytics.get_funding_rate_history(
            exchange, symbol, 
            start_time=data.index[0] if isinstance(data.index[0], datetime) else None,
            limit=500,
        )
        
        if not funding_history:
            data['funding_rate'] = 0
            return data
        
        # Create funding rate series
        funding_df = pd.DataFrame([
            {'timestamp': f.timestamp, 'funding_rate': f.rate}
            for f in funding_history
        ])
        funding_df['timestamp'] = pd.to_datetime(funding_df['timestamp'])
        funding_df = funding_df.set_index('timestamp')
        
        # Merge with data
        if 'timestamp' in data.columns:
            data['timestamp_dt'] = pd.to_datetime(data['timestamp'])
            data = data.set_index('timestamp_dt')
        
        # Forward fill funding rates
        data = data.join(funding_df, how='left')
        data['funding_rate'] = data['funding_rate'].fillna(method='ffill').fillna(0)
        
        return data.reset_index()

    async def enrich_with_open_interest(
        self,
        data: pd.DataFrame,
        exchange: str,
        symbol: str,
    ) -> pd.DataFrame:
        """
        Add open interest column to OHLCV data.
        """
        # Get OI history
        oi_history = await self.analytics.get_open_interest_history(
            exchange, symbol, period='1h', limit=500
        )
        
        if not oi_history:
            data['open_interest'] = 0
            data['open_interest_usd'] = 0
            return data
        
        # Create OI series
        oi_df = pd.DataFrame([
            {
                'timestamp': o.timestamp,
                'open_interest': o.open_interest,
                'open_interest_usd': o.open_interest_usd,
            }
            for o in oi_history
        ])
        oi_df['timestamp'] = pd.to_datetime(oi_df['timestamp'])
        oi_df = oi_df.set_index('timestamp')
        
        # Merge with data
        if 'timestamp' in data.columns:
            data['timestamp_dt'] = pd.to_datetime(data['timestamp'])
            data = data.set_index('timestamp_dt')
        
        # Forward fill OI
        data = data.join(oi_df, how='left')
        data['open_interest'] = data['open_interest'].fillna(method='ffill').fillna(0)
        data['open_interest_usd'] = data['open_interest_usd'].fillna(method='ffill').fillna(0)
        
        return data.reset_index()

    def calculate_funding_adjusted_returns(
        self,
        data: pd.DataFrame,
        position_column: str = 'position',
    ) -> pd.DataFrame:
        """
        Calculate returns adjusted for funding payments.
        """
        if 'funding_rate' not in data.columns:
            return data
        
        # Funding payment = position * funding_rate (every 8 hours)
        # For simplicity, assume funding is applied at each bar
        data['funding_payment'] = 0
        
        if position_column in data.columns:
            # Negative for longs when funding is positive
            data['funding_payment'] = -data[position_column] * data['funding_rate'] / 100
        
        return data


# Singleton instances
_analytics_service: Optional[CryptoAnalyticsService] = None
_data_enricher: Optional[CryptoDataEnricher] = None


async def get_analytics_service() -> CryptoAnalyticsService:
    """Get the crypto analytics service singleton"""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = CryptoAnalyticsService()
        await _analytics_service.initialize()
    return _analytics_service


def get_data_enricher() -> CryptoDataEnricher:
    """Get the data enricher singleton"""
    global _data_enricher
    if _data_enricher is None:
        # Need to initialize analytics service first
        raise RuntimeError("Call get_analytics_service() first to initialize")
    return _data_enricher

