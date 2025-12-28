"""
Market data service using CCXT and free APIs
"""
import asyncio
import ccxt
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import aiohttp
import json
from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.fundamentaldata import FundamentalData

from config import settings
from models.market_data import (
    OHLCVData, SymbolInfo, RealTimeData, 
    ExchangeInfo, Timeframe, MarketType
)

class MarketDataService:
    """Main market data service using multiple sources"""
    
    def __init__(self):
        self.exchanges = {}
        self.alpha_vantage = None
        self.session = None
        self.rate_limiter = asyncio.Semaphore(settings.max_concurrent_requests)
        self.crypto_api_key = settings.crypto_api_key
        
    async def initialize(self):
        """Initialize all data sources"""
        # Initialize CCXT exchanges
        await self._initialize_ccxt_exchanges()
        
        # Initialize Alpha Vantage
        if settings.alpha_vantage_api_key:
            self.alpha_vantage = TimeSeries(key=settings.alpha_vantage_api_key)
        
        # Initialize aiohttp session
        # Initialize aiohttp session with unverified SSL for development
        self.session = aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False))
        
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()
    
    async def _initialize_ccxt_exchanges(self):
        """Initialize CCXT exchanges"""
        # Free exchanges that don't require API keys
        free_exchanges = [
            'binance', 'coinbase', 'kraken', 'bitfinex', 
            'huobi', 'okx', 'bybit', 'kucoin'
        ]
        
        for exchange_id in free_exchanges:
            try:
                exchange_class = getattr(ccxt, exchange_id)
                exchange = exchange_class({
                    'sandbox': False,
                    'enableRateLimit': True,
                    'timeout': 30000,
                })
                
                # Test if exchange is accessible
                await asyncio.get_event_loop().run_in_executor(
                    None, exchange.load_markets
                )
                
                self.exchanges[exchange_id] = exchange
                print(f"✅ Initialized {exchange_id}")
                
            except Exception as e:
                print(f"❌ Failed to initialize {exchange_id}: {e}")
    
    async def get_available_symbols(
        self, 
        exchange: Optional[str] = None,
        market_type: Optional[str] = None
    ) -> List[SymbolInfo]:
        """Get available trading symbols"""
        symbols = []
        
        if exchange and exchange in self.exchanges:
            # Get symbols from specific exchange
            symbols.extend(await self._get_exchange_symbols(exchange, market_type))
        else:
            # Get symbols from all exchanges
            for exchange_id in self.exchanges:
                symbols.extend(await self._get_exchange_symbols(exchange_id, market_type))
        
        return symbols
    
    async def _get_exchange_symbols(
        self, 
        exchange_id: str, 
        market_type: Optional[str] = None
    ) -> List[SymbolInfo]:
        """Get symbols from a specific exchange"""
        symbols = []
        exchange = self.exchanges[exchange_id]
        
        try:
            markets = await asyncio.get_event_loop().run_in_executor(
                None, exchange.load_markets
            )
            
            for symbol_id, market in markets.items():
                if market_type and market.get('type') != market_type:
                    continue
                
                symbol_info = SymbolInfo(
                    symbol=symbol_id,
                    base=market.get('base', ''),
                    quote=market.get('quote', ''),
                    exchange=exchange_id,
                    market_type=MarketType(market.get('type', 'spot')),
                    active=market.get('active', True),
                    precision=market.get('precision', {}),
                    limits=market.get('limits', {}),
                    fees=market.get('fees', {})
                )
                symbols.append(symbol_info)
                
        except Exception as e:
            print(f"Error getting symbols from {exchange_id}: {e}")
        
        return symbols
    
    async def fetch_crypto_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        since: Optional[datetime] = None
    ) -> List[OHLCVData]:
        """Fetch OHLCV data from crypto API"""
        if not self.crypto_api_key:
            raise ValueError("Crypto API key not configured")
        
        try:
            # Map timeframe to API format
            timeframe_map = {
                "1m": "1min",
                "5m": "5min", 
                "15m": "15min",
                "30m": "30min",
                "1h": "1hour",
                "4h": "4hour",
                "1d": "1day",
                "1w": "1week",
                "1M": "1month"
            }
            
            api_timeframe = timeframe_map.get(timeframe, "1hour")
            
            # For now, we'll use a generic crypto API endpoint
            # You may need to adjust this based on your specific API provider
            url = f"https://api.crypto.com/v2/public/get-candlestick"
            
            params = {
                "instrument_name": symbol,
                "timeframe": api_timeframe,
                "count": min(limit, 1000),  # Most APIs have limits
                "api_key": self.crypto_api_key
            }
            
            if since:
                params["start_ts"] = int(since.timestamp() * 1000)
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get("code") == 0:  # Success
                        ohlcv_list = data.get("result", {}).get("data", [])
                        
                        ohlcv_data = []
                        for candle in ohlcv_list:
                            ohlcv_data.append(OHLCVData(
                                timestamp=int(candle["t"]),  # timestamp in milliseconds
                                open=float(candle["o"]),
                                high=float(candle["h"]),
                                low=float(candle["l"]),
                                close=float(candle["c"]),
                                volume=float(candle["v"])
                            ))
                        
                        return ohlcv_data
                    else:
                        raise ValueError(f"API error: {data.get('message', 'Unknown error')}")
                else:
                    raise ValueError(f"HTTP error: {response.status}")
                    
        except Exception as e:
            print(f"Error fetching crypto data: {e}")
            # Fallback to CCXT if available
            return await self._fallback_to_ccxt(symbol, timeframe, limit, since)
    
    async def _fallback_to_ccxt(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        since: Optional[datetime]
    ) -> List[OHLCVData]:
        """Fallback to CCXT if crypto API fails"""
        for exchange_id, exchange in self.exchanges.items():
            try:
                if 'fetchOHLCV' in exchange.has:
                    since_ms = int(since.timestamp() * 1000) if since else None
                    ohlcv = await asyncio.get_event_loop().run_in_executor(
                        None, exchange.fetch_ohlcv, symbol, timeframe, since_ms, limit
                    )
                    
                    ohlcv_data = []
                    for candle in ohlcv:
                        ohlcv_data.append(OHLCVData(
                            timestamp=candle[0],
                            open=candle[1],
                            high=candle[2],
                            low=candle[3],
                            close=candle[4],
                            volume=candle[5]
                        ))
                    
                    return ohlcv_data
            except Exception as e:
                print(f"CCXT fallback failed for {exchange_id}: {e}")
                continue
        
        raise ValueError("All data sources failed")
    
    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 100,
        exchange: Optional[str] = None
    ) -> List[OHLCVData]:
        """Get OHLCV data from multiple sources"""
        async with self.rate_limiter:
            # Try crypto API first if it's a crypto symbol and we have the key
            if self.crypto_api_key and self._is_crypto_symbol(symbol):
                try:
                    data = await self.fetch_crypto_ohlcv(symbol, timeframe, limit)
                    if data:
                        return data
                except Exception as e:
                    print(f"Crypto API failed: {e}")
            
            # Try multiple data sources
            data_sources = [
                self._get_ohlcv_ccxt,
                self._get_ohlcv_yfinance,
                self._get_ohlcv_alpha_vantage
            ]
            
            for source_func in data_sources:
                try:
                    data = await source_func(symbol, timeframe, limit, exchange)
                    if data:
                        return data
                except Exception as e:
                    print(f"Data source failed: {e}")
                    continue
            
            raise Exception("All data sources failed")
    
    def _is_crypto_symbol(self, symbol: str) -> bool:
        """Check if symbol is a crypto pair"""
        crypto_pairs = ["BTC", "ETH", "BNB", "ADA", "SOL", "XRP", "DOT", "DOGE", "AVAX", "MATIC"]
        return any(pair in symbol.upper() for pair in crypto_pairs)
    
    async def _get_ohlcv_ccxt(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        exchange: Optional[str] = None
    ) -> List[OHLCVData]:
        """Get OHLCV data from CCXT"""
        if exchange and exchange in self.exchanges:
            exchanges_to_try = [exchange]
        else:
            exchanges_to_try = list(self.exchanges.keys())
        
        for exchange_id in exchanges_to_try:
            try:
                exchange = self.exchanges[exchange_id]
                
                # Fetch OHLCV data
                ohlcv = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
                )
                
                data = []
                for candle in ohlcv:
                    ohlcv_data = OHLCVData(
                        timestamp=datetime.fromtimestamp(candle[0] / 1000),
                        open=candle[1],
                        high=candle[2],
                        low=candle[3],
                        close=candle[4],
                        volume=candle[5],
                        symbol=symbol,
                        timeframe=timeframe
                    )
                    data.append(ohlcv_data)
                
                return data
                
            except Exception as e:
                print(f"CCXT {exchange_id} failed for {symbol}: {e}")
                continue
        
        return []
    
    async def _get_ohlcv_yfinance(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        exchange: Optional[str] = None
    ) -> List[OHLCVData]:
        """Get OHLCV data from Yahoo Finance"""
        try:
            # Map timeframes
            interval_map = {
                "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
                "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1wk", "1M": "1mo"
            }
            
            interval = interval_map.get(timeframe, "1h")
            period = f"{limit}d" if interval in ["1m", "5m", "15m", "30m", "1h"] else f"{limit}d"
            
            ticker = yf.Ticker(symbol)
            hist = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.history(period=period, interval=interval)
            )
            
            if hist.empty:
                return []
            
            data = []
            for timestamp, row in hist.iterrows():
                ohlcv_data = OHLCVData(
                    timestamp=timestamp.to_pydatetime(),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=float(row['Volume']),
                    symbol=symbol,
                    timeframe=timeframe
                )
                data.append(ohlcv_data)
            
            return data[-limit:] if len(data) > limit else data
            
        except Exception as e:
            print(f"Yahoo Finance failed for {symbol}: {e}")
            return []
    
    async def _get_ohlcv_alpha_vantage(
        self,
        symbol: str,
        timeframe: str,
        limit: int,
        exchange: Optional[str] = None
    ) -> List[OHLCVData]:
        """Get OHLCV data from Alpha Vantage"""
        if not self.alpha_vantage:
            return []
        
        try:
            # Map timeframes to Alpha Vantage intervals
            interval_map = {
                "1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min",
                "1h": "60min", "1d": "daily", "1w": "weekly", "1M": "monthly"
            }
            
            interval = interval_map.get(timeframe, "60min")
            
            if interval == "daily":
                data, _ = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.alpha_vantage.get_daily(symbol=symbol, outputsize='compact')
                )
            else:
                data, _ = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.alpha_vantage.get_intraday(symbol=symbol, interval=interval, outputsize='compact')
                )
            
            ohlcv_list = []
            for date_str, values in data.items():
                ohlcv_data = OHLCVData(
                    timestamp=datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
                    open=float(values['1. open']),
                    high=float(values['2. high']),
                    low=float(values['3. low']),
                    close=float(values['4. close']),
                    volume=float(values['5. volume']),
                    symbol=symbol,
                    timeframe=timeframe
                )
                ohlcv_list.append(ohlcv_data)
            
            # Sort by timestamp and limit
            ohlcv_list.sort(key=lambda x: x.timestamp)
            return ohlcv_list[-limit:] if len(ohlcv_list) > limit else ohlcv_list
            
        except Exception as e:
            print(f"Alpha Vantage failed for {symbol}: {e}")
            return []
    
    async def get_real_time_data(
        self, 
        symbol: str, 
        exchange: Optional[str] = None
    ) -> RealTimeData:
        """Get real-time price data"""
        # Try multiple sources for real-time data
        sources = [
            self._get_real_time_ccxt,
            self._get_real_time_yfinance
        ]
        
        for source_func in sources:
            try:
                data = await source_func(symbol, exchange)
                if data:
                    return data
            except Exception as e:
                print(f"Real-time source failed: {e}")
                continue
        
        raise Exception("All real-time data sources failed")
    
    async def _get_real_time_ccxt(
        self, 
        symbol: str, 
        exchange: Optional[str] = None
    ) -> Optional[RealTimeData]:
        """Get real-time data from CCXT"""
        if exchange and exchange in self.exchanges:
            exchanges_to_try = [exchange]
        else:
            exchanges_to_try = list(self.exchanges.keys())
        
        for exchange_id in exchanges_to_try:
            try:
                exchange = self.exchanges[exchange_id]
                ticker = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: exchange.fetch_ticker(symbol)
                )
                
                return RealTimeData(
                    symbol=symbol,
                    price=float(ticker['last']),
                    volume=float(ticker['baseVolume']),
                    timestamp=datetime.utcnow(),
                    bid=float(ticker['bid']) if ticker['bid'] else None,
                    ask=float(ticker['ask']) if ticker['ask'] else None,
                    change_24h=float(ticker['change']) if ticker['change'] else None,
                    change_percent_24h=float(ticker['percentage']) if ticker['percentage'] else None
                )
                
            except Exception as e:
                print(f"CCXT real-time failed for {exchange_id}: {e}")
                continue
        
        return None
    
    async def _get_real_time_yfinance(
        self, 
        symbol: str, 
        exchange: Optional[str] = None
    ) -> Optional[RealTimeData]:
        """Get real-time data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            info = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.info
            )
            
            return RealTimeData(
                symbol=symbol,
                price=float(info.get('regularMarketPrice', 0)),
                volume=float(info.get('regularMarketVolume', 0)),
                timestamp=datetime.utcnow(),
                bid=float(info.get('bid', 0)) if info.get('bid') else None,
                ask=float(info.get('ask', 0)) if info.get('ask') else None,
                change_24h=float(info.get('regularMarketChange', 0)) if info.get('regularMarketChange') else None,
                change_percent_24h=float(info.get('regularMarketChangePercent', 0)) if info.get('regularMarketChangePercent') else None
            )
            
        except Exception as e:
            print(f"Yahoo Finance real-time failed for {symbol}: {e}")
            return None
    
    async def get_market_info(
        self, 
        symbol: str, 
        exchange: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get market information for a symbol"""
        info = {}
        
        # Try to get info from CCXT
        if exchange and exchange in self.exchanges:
            try:
                exchange_obj = self.exchanges[exchange]
                market = exchange_obj.market(symbol)
                info.update(market)
            except:
                pass
        
        # Try to get info from Yahoo Finance
        try:
            ticker = yf.Ticker(symbol)
            yf_info = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ticker.info
            )
            info.update(yf_info)
        except:
            pass
        
        return info
    
    async def get_supported_exchanges(self) -> List[ExchangeInfo]:
        """Get list of supported exchanges"""
        exchanges = []
        
        for exchange_id, exchange in self.exchanges.items():
            try:
                exchange_info = ExchangeInfo(
                    id=exchange_id,
                    name=exchange.name,
                    countries=exchange.countries,
                    version=exchange.version,
                    certified=exchange.certified,
                    has=exchange.has,
                    urls=exchange.urls,
                    api=exchange.api,
                    fees=exchange.fees,
                    markets=exchange.markets,
                    symbols=list(exchange.markets.keys()),
                    timeframes=list(exchange.timeframes.keys())
                )
                exchanges.append(exchange_info)
            except Exception as e:
                print(f"Error getting info for {exchange_id}: {e}")
        
        # Add Crypto API if key is available
        if self.crypto_api_key:
            try:
                crypto_exchange = ExchangeInfo(
                    id="crypto_api",
                    name="Crypto API",
                    countries=["Global"],
                    version="1.0",
                    certified=True,
                    has={"fetchOHLCV": True, "fetchTicker": True, "fetchMarkets": True},
                    urls={"www": "https://crypto-api.com/"},
                    api={"public": {"get": ["ohlcv", "ticker", "markets"]}},
                    fees={"trading": {"maker": 0.0, "taker": 0.0}},
                    markets={},
                    symbols=["BTC/USDT", "ETH/USDT", "BNB/USDT", "ADA/USDT", "SOL/USDT", "XRP/USDT", "DOT/USDT", "DOGE/USDT", "AVAX/USDT", "MATIC/USDT"],
                    timeframes=["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"]
                )
                exchanges.append(crypto_exchange)
            except Exception as e:
                print(f"Error adding crypto API: {e}")
        
        return exchanges
