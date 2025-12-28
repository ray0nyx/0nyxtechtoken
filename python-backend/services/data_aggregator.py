"""
Data aggregator service for backtesting
Enhanced with Parquet caching and DataLoader integration
"""
import asyncio
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
# Try to import ta (technical analysis library)
try:
    import ta
    from ta.trend import SMAIndicator, EMAIndicator, MACD
    from ta.momentum import RSIIndicator, StochasticOscillator
    from ta.volatility import BollingerBands, AverageTrueRange
    from ta.volume import VolumeSMAIndicator, OnBalanceVolumeIndicator
    TA_AVAILABLE = True
except ImportError:
    TA_AVAILABLE = False
    # Create dummy classes to prevent errors
    class SMAIndicator:
        pass
    class EMAIndicator:
        pass
    class MACD:
        pass
    class RSIIndicator:
        pass
    class StochasticOscillator:
        pass
    class BollingerBands:
        pass
    class AverageTrueRange:
        pass
    class VolumeSMAIndicator:
        pass
    class OnBalanceVolumeIndicator:
        pass

from models.market_data import BacktestDataRequest, OHLCVData, TechnicalIndicator
from services.market_data_service import MarketDataService

# Try to import pyarrow for Parquet support
try:
    import pyarrow.parquet as pq
    import pyarrow as pa
    PARQUET_AVAILABLE = True
except ImportError:
    PARQUET_AVAILABLE = False


class ParquetCache:
    """Parquet-based caching for OHLCV data"""
    
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_path(self, symbol: str, exchange: str, timeframe: str) -> Path:
        """Get the cache file path for a symbol"""
        # Sanitize symbol for filename
        safe_symbol = symbol.replace("/", "_").replace(":", "_")
        return self.cache_dir / exchange / f"{safe_symbol}_{timeframe}.parquet"
    
    def get(self, symbol: str, exchange: str, timeframe: str) -> Optional[pd.DataFrame]:
        """Get cached data if available"""
        if not PARQUET_AVAILABLE:
            return None
        
        cache_path = self._get_cache_path(symbol, exchange, timeframe)
        
        if not cache_path.exists():
            return None
        
        try:
            df = pq.read_table(cache_path).to_pandas()
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            return df
        except Exception as e:
            print(f"Error reading cache for {symbol}: {e}")
            return None
    
    def set(self, symbol: str, exchange: str, timeframe: str, data: pd.DataFrame) -> bool:
        """Cache data to Parquet file"""
        if not PARQUET_AVAILABLE or data.empty:
            return False
        
        cache_path = self._get_cache_path(symbol, exchange, timeframe)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Ensure timestamp is in the right format
            df = data.copy()
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp']).astype(str)
            
            table = pa.Table.from_pandas(df, preserve_index=False)
            pq.write_table(table, cache_path, compression='snappy')
            return True
        except Exception as e:
            print(f"Error caching data for {symbol}: {e}")
            return False
    
    def update(self, symbol: str, exchange: str, timeframe: str, new_data: pd.DataFrame) -> bool:
        """Update cached data with new data"""
        existing = self.get(symbol, exchange, timeframe)
        
        if existing is not None:
            # Merge with existing data
            combined = pd.concat([existing, new_data], ignore_index=True)
            combined = combined.drop_duplicates(subset=['timestamp'], keep='last')
            combined = combined.sort_values('timestamp')
            return self.set(symbol, exchange, timeframe, combined)
        else:
            return self.set(symbol, exchange, timeframe, new_data)
    
    def clear(self, symbol: str = None, exchange: str = None):
        """Clear cache for specific symbol or all"""
        if symbol and exchange:
            # Clear specific symbol
            for timeframe in ['1m', '5m', '15m', '1h', '4h', '1d']:
                cache_path = self._get_cache_path(symbol, exchange, timeframe)
                if cache_path.exists():
                    cache_path.unlink()
        elif exchange:
            # Clear all symbols for exchange
            exchange_dir = self.cache_dir / exchange
            if exchange_dir.exists():
                import shutil
                shutil.rmtree(exchange_dir)
        else:
            # Clear all cache
            import shutil
            if self.cache_dir.exists():
                shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir(parents=True, exist_ok=True)


class DataAggregator:
    """Aggregates and processes market data for backtesting with Parquet caching"""
    
    def __init__(self, market_data_service: MarketDataService):
        self.market_data_service = market_data_service
        self.cache = {}
        self.parquet_cache = ParquetCache()
        
    async def initialize(self):
        """Initialize the data aggregator"""
        pass
    
    async def cleanup(self):
        """Cleanup resources"""
        pass
    
    async def get_backtest_data(self, request: BacktestDataRequest) -> Dict[str, Any]:
        """Get comprehensive data for backtesting"""
        results = {
            "symbols": {},
            "metadata": {
                "start_date": request.start_date,
                "end_date": request.end_date,
                "timeframe": request.timeframe,
                "symbols": request.symbols
            }
        }
        
        # Fetch data for each symbol
        tasks = []
        for symbol in request.symbols:
            task = self._process_symbol_data(symbol, request)
            tasks.append(task)
        
        symbol_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(symbol_results):
            symbol = request.symbols[i]
            if isinstance(result, Exception):
                print(f"Error processing {symbol}: {result}")
                results["symbols"][symbol] = {"error": str(result)}
            else:
                results["symbols"][symbol] = result
        
        return results
    
    async def _process_symbol_data(
        self, 
        symbol: str, 
        request: BacktestDataRequest
    ) -> Dict[str, Any]:
        """Process data for a single symbol"""
        # Get OHLCV data
        ohlcv_data = await self._get_historical_data(symbol, request)
        
        if not ohlcv_data:
            return {"error": "No data available"}
        
        # Convert to DataFrame
        df = self._ohlcv_to_dataframe(ohlcv_data)
        
        result = {
            "ohlcv": ohlcv_data,
            "dataframe": df.to_dict('records'),
            "statistics": self._calculate_statistics(df)
        }
        
        # Add technical indicators if requested
        if request.include_indicators:
            indicators = await self._calculate_indicators(df, symbol, request)
            result["indicators"] = indicators
        
        return result
    
    async def _get_historical_data(
        self, 
        symbol: str, 
        request: BacktestDataRequest,
        exchange: str = "binance"
    ) -> List[OHLCVData]:
        """Get historical data for a symbol with Parquet caching"""
        # Calculate number of periods needed
        days_diff = (request.end_date - request.start_date).days
        timeframe_days = self._timeframe_to_days(request.timeframe)
        periods_needed = int(days_diff / timeframe_days) + 50  # Add buffer
        
        # Try to get from Parquet cache first
        cached_df = self.parquet_cache.get(symbol, exchange, request.timeframe)
        
        if cached_df is not None:
            # Filter to requested date range
            cached_df = cached_df[
                (cached_df['timestamp'] >= request.start_date) & 
                (cached_df['timestamp'] <= request.end_date)
            ]
            
            if len(cached_df) >= periods_needed * 0.9:  # If we have 90% of data cached
                return self._dataframe_to_ohlcv(cached_df)
        
        # Fetch fresh data from market data service
        ohlcv_data = await self.market_data_service.get_ohlcv(
            symbol=symbol,
            timeframe=request.timeframe,
            limit=periods_needed
        )
        
        # Cache the new data in Parquet format
        if ohlcv_data:
            df = self._ohlcv_to_dataframe_for_cache(ohlcv_data)
            self.parquet_cache.update(symbol, exchange, request.timeframe, df)
        
        # Filter by date range
        filtered_data = [
            data for data in ohlcv_data
            if request.start_date <= data.timestamp <= request.end_date
        ]
        
        return filtered_data
    
    def _ohlcv_to_dataframe_for_cache(self, ohlcv_data: List[OHLCVData]) -> pd.DataFrame:
        """Convert OHLCV data to DataFrame for caching"""
        data = []
        for ohlcv in ohlcv_data:
            data.append({
                'timestamp': ohlcv.timestamp,
                'open': ohlcv.open,
                'high': ohlcv.high,
                'low': ohlcv.low,
                'close': ohlcv.close,
                'volume': ohlcv.volume
            })
        return pd.DataFrame(data)
    
    def _dataframe_to_ohlcv(self, df: pd.DataFrame) -> List[OHLCVData]:
        """Convert DataFrame back to OHLCV list"""
        result = []
        for _, row in df.iterrows():
            result.append(OHLCVData(
                timestamp=row['timestamp'],
                open=row['open'],
                high=row['high'],
                low=row['low'],
                close=row['close'],
                volume=row['volume']
            ))
        return result
    
    def _timeframe_to_days(self, timeframe: str) -> float:
        """Convert timeframe to days"""
        timeframe_map = {
            "1m": 1/1440,  # 1 minute
            "5m": 5/1440,  # 5 minutes
            "15m": 15/1440,  # 15 minutes
            "30m": 30/1440,  # 30 minutes
            "1h": 1/24,  # 1 hour
            "4h": 4/24,  # 4 hours
            "1d": 1,  # 1 day
            "1w": 7,  # 1 week
            "1M": 30,  # 1 month
        }
        return timeframe_map.get(timeframe, 1)
    
    def _ohlcv_to_dataframe(self, ohlcv_data: List[OHLCVData]) -> pd.DataFrame:
        """Convert OHLCV data to pandas DataFrame"""
        data = []
        for ohlcv in ohlcv_data:
            data.append({
                'timestamp': ohlcv.timestamp,
                'open': ohlcv.open,
                'high': ohlcv.high,
                'low': ohlcv.low,
                'close': ohlcv.close,
                'volume': ohlcv.volume
            })
        
        df = pd.DataFrame(data)
        df.set_index('timestamp', inplace=True)
        df.sort_index(inplace=True)
        
        return df
    
    def _calculate_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate basic statistics for the data"""
        if df.empty:
            return {}
        
        returns = df['close'].pct_change().dropna()
        
        stats = {
            "total_periods": len(df),
            "start_date": df.index[0].isoformat(),
            "end_date": df.index[-1].isoformat(),
            "price_range": {
                "min": float(df['low'].min()),
                "max": float(df['high'].max()),
                "start": float(df['open'].iloc[0]),
                "end": float(df['close'].iloc[-1])
            },
            "volume_stats": {
                "total": float(df['volume'].sum()),
                "average": float(df['volume'].mean()),
                "max": float(df['volume'].max()),
                "min": float(df['volume'].min())
            },
            "returns": {
                "total_return": float((df['close'].iloc[-1] / df['open'].iloc[0] - 1) * 100),
                "average_daily_return": float(returns.mean() * 100),
                "volatility": float(returns.std() * 100),
                "sharpe_ratio": float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0,
                "max_drawdown": float(self._calculate_max_drawdown(df['close']))
            }
        }
        
        return stats
    
    def _calculate_max_drawdown(self, prices: pd.Series) -> float:
        """Calculate maximum drawdown"""
        peak = prices.expanding().max()
        drawdown = (prices - peak) / peak
        return float(drawdown.min() * 100)
    
    async def _calculate_indicators(
        self, 
        df: pd.DataFrame, 
        symbol: str, 
        request: BacktestDataRequest
    ) -> Dict[str, TechnicalIndicator]:
        """Calculate technical indicators"""
        indicators = {}
        
        # Default indicators to calculate
        default_indicators = [
            "sma_20", "sma_50", "ema_12", "ema_26", "rsi_14", 
            "macd", "bollinger_bands", "stochastic", "atr_14"
        ]
        
        indicators_to_calculate = request.indicators or default_indicators
        
        for indicator_name in indicators_to_calculate:
            try:
                indicator_data = self._calculate_single_indicator(df, indicator_name, symbol, request.timeframe)
                if indicator_data:
                    indicators[indicator_name] = indicator_data
            except Exception as e:
                print(f"Error calculating {indicator_name} for {symbol}: {e}")
        
        return indicators
    
    def _calculate_single_indicator(
        self, 
        df: pd.DataFrame, 
        indicator_name: str, 
        symbol: str, 
        timeframe: str
    ) -> Optional[TechnicalIndicator]:
        """Calculate a single technical indicator"""
        if not TA_AVAILABLE:
            raise ImportError("ta library is required for technical indicators. Install with: pip install ta")
        
        try:
            if indicator_name == "sma_20":
                indicator = SMAIndicator(df['close'], window=20)
                values = indicator.sma_indicator().dropna()
            elif indicator_name == "sma_50":
                indicator = SMAIndicator(df['close'], window=50)
                values = indicator.sma_indicator().dropna()
            elif indicator_name == "ema_12":
                indicator = EMAIndicator(df['close'], window=12)
                values = indicator.ema_indicator().dropna()
            elif indicator_name == "ema_26":
                indicator = EMAIndicator(df['close'], window=26)
                values = indicator.ema_indicator().dropna()
            elif indicator_name == "rsi_14":
                indicator = RSIIndicator(df['close'], window=14)
                values = indicator.rsi().dropna()
            elif indicator_name == "macd":
                indicator = MACD(df['close'])
                values = indicator.macd().dropna()
            elif indicator_name == "bollinger_bands":
                indicator = BollingerBands(df['close'], window=20, window_dev=2)
                values = indicator.bollinger_mavg().dropna()
            elif indicator_name == "stochastic":
                indicator = StochasticOscillator(df['high'], df['low'], df['close'])
                values = indicator.stoch().dropna()
            elif indicator_name == "atr_14":
                indicator = AverageTrueRange(df['high'], df['low'], df['close'], window=14)
                values = indicator.average_true_range().dropna()
            else:
                return None
            
            return TechnicalIndicator(
                name=indicator_name,
                symbol=symbol,
                timeframe=timeframe,
                values=values.tolist(),
                timestamps=[ts.isoformat() for ts in values.index],
                parameters={}
            )
            
        except Exception as e:
            print(f"Error calculating {indicator_name}: {e}")
            return None
