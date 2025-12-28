"""
Data bridge service for fetching market data from various sources
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import ccxt
import asyncpg
from polygon import RESTClient
import os
import json

from models.backtest_models import MarketDataRequest, TimeFrame, ExchangeType

logger = logging.getLogger(__name__)

class DataBridge:
    """Service for fetching and managing market data"""
    
    def __init__(self):
        self.polygon_client = None
        self.timescale_connection = None
        self.exchanges = {}
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize external API clients"""
        try:
            # Initialize Polygon client
            polygon_api_key = os.getenv('POLYGON_API_KEY')
            if polygon_api_key:
                self.polygon_client = RESTClient(api_key=polygon_api_key)
                logger.info("Polygon client initialized")
            
            # Initialize CCXT exchanges
            self._initialize_ccxt_exchanges()
            
        except Exception as e:
            logger.error(f"Failed to initialize clients: {e}")
    
    def _initialize_ccxt_exchanges(self):
        """Initialize CCXT exchange clients"""
        exchange_configs = {
            'binance': {
                'apiKey': os.getenv('BINANCE_API_KEY'),
                'secret': os.getenv('BINANCE_SECRET'),
                'sandbox': True,
                'rateLimit': 1200
            },
            'coinbase': {
                'apiKey': os.getenv('COINBASE_API_KEY'),
                'secret': os.getenv('COINBASE_SECRET'),
                'passphrase': os.getenv('COINBASE_PASSPHRASE'),
                'sandbox': True,
                'rateLimit': 1000
            },
            'kraken': {
                'apiKey': os.getenv('KRAKEN_API_KEY'),
                'secret': os.getenv('KRAKEN_SECRET'),
                'sandbox': True,
                'rateLimit': 3000
            }
        }
        
        for exchange_name, config in exchange_configs.items():
            if config.get('apiKey') and config.get('secret'):
                try:
                    exchange_class = getattr(ccxt, exchange_name)
                    self.exchanges[exchange_name] = exchange_class(config)
                    logger.info(f"Initialized {exchange_name} exchange")
                except Exception as e:
                    logger.warning(f"Failed to initialize {exchange_name}: {e}")
    
    async def get_timescale_connection(self):
        """Get TimescaleDB connection"""
        if not self.timescale_connection:
            timescale_url = os.getenv('TIMESCALE_URL')
            if timescale_url:
                self.timescale_connection = await asyncpg.connect(timescale_url)
        return self.timescale_connection
    
    async def fetch_market_data(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        timeframe: TimeFrame = TimeFrame.HOUR_1,
        exchanges: List[ExchangeType] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch market data from various sources
        """
        if exchanges is None:
            exchanges = [ExchangeType.BINANCE]
        
        logger.info(f"Fetching market data for {symbols} from {exchanges}")
        
        all_data = []
        
        for symbol in symbols:
            for exchange in exchanges:
                try:
                    if exchange == ExchangeType.POLYGON:
                        data = await self._fetch_polygon_data(symbol, start_date, end_date, timeframe)
                    else:
                        data = await self._fetch_crypto_data(symbol, exchange.value, start_date, end_date, timeframe)
                    
                    if data:
                        all_data.extend(data)
                        logger.info(f"Fetched {len(data)} records for {symbol} from {exchange}")
                    
                except Exception as e:
                    logger.error(f"Failed to fetch data for {symbol} from {exchange}: {e}")
                    continue
        
        # Store data in TimescaleDB
        if all_data:
            await self._store_market_data(all_data)
        
        return all_data
    
    async def _fetch_crypto_data(
        self,
        symbol: str,
        exchange_name: str,
        start_date: date,
        end_date: date,
        timeframe: TimeFrame
    ) -> List[Dict[str, Any]]:
        """Fetch crypto data via CCXT"""
        if exchange_name not in self.exchanges:
            logger.warning(f"Exchange {exchange_name} not available")
            return []
        
        exchange = self.exchanges[exchange_name]
        
        try:
            # Convert timeframe to CCXT format
            ccxt_timeframe = self._convert_timeframe_to_ccxt(timeframe)
            
            # Convert dates to timestamps
            since = int(datetime.combine(start_date, datetime.min.time()).timestamp() * 1000)
            until = int(datetime.combine(end_date, datetime.max.time()).timestamp() * 1000)
            
            # Fetch OHLCV data
            ohlcv = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: exchange.fetch_ohlcv(symbol, ccxt_timeframe, since=since, limit=1000)
            )
            
            # Convert to our format
            data = []
            for candle in ohlcv:
                if candle[0] >= since and candle[0] <= until:
                    data.append({
                        'time': datetime.fromtimestamp(candle[0] / 1000),
                        'symbol': symbol,
                        'exchange': exchange_name,
                        'timeframe': timeframe.value,
                        'open': float(candle[1]),
                        'high': float(candle[2]),
                        'low': float(candle[3]),
                        'close': float(candle[4]),
                        'volume': float(candle[5]),
                        'trade_count': 0,
                        'vwap': None
                    })
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching crypto data for {symbol} from {exchange_name}: {e}")
            return []
    
    async def _fetch_polygon_data(
        self,
        symbol: str,
        start_date: date,
        end_date: date,
        timeframe: TimeFrame
    ) -> List[Dict[str, Any]]:
        """Fetch stock data via Polygon"""
        if not self.polygon_client:
            logger.warning("Polygon client not available")
            return []
        
        try:
            # Convert timeframe to Polygon format
            polygon_timespan = self._convert_timeframe_to_polygon(timeframe)
            
            # Fetch aggregates
            bars = self.polygon_client.get_aggs(
                ticker=symbol,
                multiplier=1,
                timespan=polygon_timespan,
                from_=start_date.strftime('%Y-%m-%d'),
                to=end_date.strftime('%Y-%m-%d'),
                limit=50000
            )
            
            # Convert to our format
            data = []
            for bar in bars:
                data.append({
                    'time': datetime.fromtimestamp(bar.timestamp / 1000),
                    'symbol': symbol,
                    'exchange': 'polygon',
                    'timeframe': timeframe.value,
                    'open': float(bar.open),
                    'high': float(bar.high),
                    'low': float(bar.low),
                    'close': float(bar.close),
                    'volume': float(bar.volume),
                    'trade_count': int(bar.transactions) if hasattr(bar, 'transactions') else 0,
                    'vwap': float(bar.vwap) if hasattr(bar, 'vwap') else None
                })
            
            return data
            
        except Exception as e:
            logger.error(f"Error fetching Polygon data for {symbol}: {e}")
            return []
    
    def _convert_timeframe_to_ccxt(self, timeframe: TimeFrame) -> str:
        """Convert our timeframe to CCXT format"""
        mapping = {
            TimeFrame.MINUTE_1: '1m',
            TimeFrame.MINUTE_5: '5m',
            TimeFrame.MINUTE_15: '15m',
            TimeFrame.MINUTE_30: '30m',
            TimeFrame.HOUR_1: '1h',
            TimeFrame.HOUR_4: '4h',
            TimeFrame.HOUR_8: '8h',
            TimeFrame.HOUR_12: '12h',
            TimeFrame.DAY_1: '1d',
            TimeFrame.WEEK_1: '1w',
            TimeFrame.MONTH_1: '1M'
        }
        return mapping.get(timeframe, '1h')
    
    def _convert_timeframe_to_polygon(self, timeframe: TimeFrame) -> str:
        """Convert our timeframe to Polygon format"""
        mapping = {
            TimeFrame.MINUTE_1: 'minute',
            TimeFrame.MINUTE_5: 'minute',
            TimeFrame.MINUTE_15: 'minute',
            TimeFrame.MINUTE_30: 'minute',
            TimeFrame.HOUR_1: 'hour',
            TimeFrame.HOUR_4: 'hour',
            TimeFrame.HOUR_8: 'hour',
            TimeFrame.HOUR_12: 'hour',
            TimeFrame.DAY_1: 'day',
            TimeFrame.WEEK_1: 'week',
            TimeFrame.MONTH_1: 'month'
        }
        return mapping.get(timeframe, 'hour')
    
    async def _store_market_data(self, data: List[Dict[str, Any]]):
        """Store market data in TimescaleDB"""
        try:
            conn = await self.get_timescale_connection()
            if not conn:
                logger.warning("No TimescaleDB connection available")
                return
            
            # Prepare data for insertion
            values = []
            for record in data:
                values.append((
                    record['time'],
                    record['symbol'],
                    record['exchange'],
                    record['timeframe'],
                    record['open'],
                    record['high'],
                    record['low'],
                    record['close'],
                    record['volume'],
                    record['trade_count'],
                    record['vwap']
                ))
            
            # Insert data
            await conn.executemany(
                """
                INSERT INTO market_data (
                    time, symbol, exchange, timeframe, open, high, low, close, 
                    volume, trade_count, vwap
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (time, symbol, exchange, timeframe) 
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    trade_count = EXCLUDED.trade_count,
                    vwap = EXCLUDED.vwap
                """,
                values
            )
            
            logger.info(f"Stored {len(data)} market data records in TimescaleDB")
            
        except Exception as e:
            logger.error(f"Failed to store market data: {e}")
    
    async def get_market_data(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        timeframe: TimeFrame = TimeFrame.HOUR_1,
        exchanges: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Get market data from TimescaleDB"""
        try:
            conn = await self.get_timescale_connection()
            if not conn:
                logger.warning("No TimescaleDB connection available")
                return []
            
            if exchanges is None:
                exchanges = ['binance', 'coinbase', 'kraken']
            
            # Build query
            placeholders = ','.join([f'${i+1}' for i in range(len(symbols))])
            exchange_placeholders = ','.join([f'${i+len(symbols)+1}' for i in range(len(exchanges))])
            
            query = f"""
                SELECT time, symbol, exchange, timeframe, open, high, low, close, volume, trade_count, vwap
                FROM market_data
                WHERE symbol IN ({placeholders})
                AND exchange IN ({exchange_placeholders})
                AND timeframe = ${len(symbols) + len(exchanges) + 1}
                AND time >= ${len(symbols) + len(exchanges) + 2}
                AND time <= ${len(symbols) + len(exchanges) + 3}
                ORDER BY time, symbol, exchange
            """
            
            params = (
                symbols + 
                exchanges + 
                [timeframe.value, start_date, end_date]
            )
            
            rows = await conn.fetch(query, *params)
            
            # Convert to list of dictionaries
            data = []
            for row in rows:
                data.append({
                    'time': row['time'],
                    'symbol': row['symbol'],
                    'exchange': row['exchange'],
                    'timeframe': row['timeframe'],
                    'open': float(row['open']),
                    'high': float(row['high']),
                    'low': float(row['low']),
                    'close': float(row['close']),
                    'volume': float(row['volume']),
                    'trade_count': row['trade_count'],
                    'vwap': float(row['vwap']) if row['vwap'] else None
                })
            
            logger.info(f"Retrieved {len(data)} market data records from TimescaleDB")
            return data
            
        except Exception as e:
            logger.error(f"Failed to get market data: {e}")
            return []
    
    async def get_latest_prices(self, symbols: List[str], exchanges: List[str] = None) -> Dict[str, float]:
        """Get latest prices for symbols"""
        try:
            conn = await self.get_timescale_connection()
            if not conn:
                logger.warning("No TimescaleDB connection available")
                return {}
            
            if exchanges is None:
                exchanges = ['binance', 'coinbase', 'kraken']
            
            placeholders = ','.join([f'${i+1}' for i in range(len(symbols))])
            exchange_placeholders = ','.join([f'${i+len(symbols)+1}' for i in range(len(exchanges))])
            
            query = f"""
                SELECT DISTINCT ON (symbol) symbol, close
                FROM market_data
                WHERE symbol IN ({placeholders})
                AND exchange IN ({exchange_placeholders})
                ORDER BY symbol, time DESC
            """
            
            params = symbols + exchanges
            rows = await conn.fetch(query, *params)
            
            prices = {row['symbol']: float(row['close']) for row in rows}
            return prices
            
        except Exception as e:
            logger.error(f"Failed to get latest prices: {e}")
            return {}
    
    async def close_connections(self):
        """Close database connections"""
        if self.timescale_connection:
            await self.timescale_connection.close()
            self.timescale_connection = None
