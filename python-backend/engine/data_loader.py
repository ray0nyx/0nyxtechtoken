"""
Data Loader - Load and cache OHLCV data from various sources

Supports:
- CCXT for exchange data
- CSV files
- Parquet files
- JSON data
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import pandas as pd
import numpy as np

try:
    import pyarrow.parquet as pq
    PARQUET_AVAILABLE = True
except ImportError:
    PARQUET_AVAILABLE = False

try:
    import ccxt
    CCXT_AVAILABLE = True
except ImportError:
    CCXT_AVAILABLE = False


class DataLoader:
    """
    Unified data loader for backtesting.
    
    Handles loading from multiple sources and caching.
    """
    
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._exchanges: Dict[str, Any] = {}
        
    def load_csv(self, filepath: str, symbol: Optional[str] = None) -> pd.DataFrame:
        """
        Load OHLCV data from CSV file.
        
        Expected columns: timestamp, open, high, low, close, volume
        """
        df = pd.read_csv(filepath)
        
        # Standardize column names
        df.columns = [c.lower() for c in df.columns]
        
        # Ensure required columns
        required = ['open', 'high', 'low', 'close', 'volume']
        for col in required:
            if col not in df.columns:
                raise ValueError(f"Missing required column: {col}")
        
        # Handle timestamp
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        elif 'date' in df.columns:
            df['timestamp'] = pd.to_datetime(df['date'])
        elif 'datetime' in df.columns:
            df['timestamp'] = pd.to_datetime(df['datetime'])
        else:
            # Try to use index
            df['timestamp'] = pd.to_datetime(df.index)
        
        # Add symbol if provided
        if symbol:
            df['symbol'] = symbol
        
        return df[['timestamp', 'open', 'high', 'low', 'close', 'volume'] + (['symbol'] if symbol else [])]
    
    def load_parquet(self, filepath: str) -> pd.DataFrame:
        """Load OHLCV data from Parquet file"""
        if not PARQUET_AVAILABLE:
            raise ImportError("pyarrow not installed. Install with: pip install pyarrow")
        
        df = pq.read_table(filepath).to_pandas()
        df.columns = [c.lower() for c in df.columns]
        
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        return df
    
    def load_json(self, filepath: str) -> pd.DataFrame:
        """Load OHLCV data from JSON file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        df = pd.DataFrame(data)
        df.columns = [c.lower() for c in df.columns]
        
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        return df
    
    def load_from_exchange(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str = '1h',
        since: Optional[datetime] = None,
        limit: int = 1000,
    ) -> pd.DataFrame:
        """
        Load OHLCV data from a crypto exchange via CCXT.
        
        Args:
            exchange_id: Exchange name (e.g., 'binance', 'coinbase')
            symbol: Trading pair (e.g., 'BTC/USDT')
            timeframe: Candle timeframe (e.g., '1m', '1h', '1d')
            since: Start datetime (optional)
            limit: Maximum number of candles
            
        Returns:
            DataFrame with OHLCV data
        """
        if not CCXT_AVAILABLE:
            raise ImportError("ccxt not installed. Install with: pip install ccxt")
        
        # Get or create exchange instance
        if exchange_id not in self._exchanges:
            exchange_class = getattr(ccxt, exchange_id)
            self._exchanges[exchange_id] = exchange_class({
                'enableRateLimit': True,
            })
        
        exchange = self._exchanges[exchange_id]
        
        # Convert since to milliseconds
        since_ms = None
        if since:
            since_ms = int(since.timestamp() * 1000)
        
        # Fetch OHLCV data
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=limit)
        
        # Convert to DataFrame
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df['symbol'] = symbol
        
        return df
    
    def cache_data(self, df: pd.DataFrame, cache_key: str) -> str:
        """
        Cache DataFrame to Parquet file.
        
        Returns path to cached file.
        """
        if not PARQUET_AVAILABLE:
            # Fall back to CSV
            filepath = self.cache_dir / f"{cache_key}.csv"
            df.to_csv(filepath, index=False)
            return str(filepath)
        
        filepath = self.cache_dir / f"{cache_key}.parquet"
        df.to_parquet(filepath, index=False)
        return str(filepath)
    
    def load_cached(self, cache_key: str) -> Optional[pd.DataFrame]:
        """
        Load data from cache if available.
        
        Returns None if not cached.
        """
        parquet_path = self.cache_dir / f"{cache_key}.parquet"
        csv_path = self.cache_dir / f"{cache_key}.csv"
        
        if parquet_path.exists() and PARQUET_AVAILABLE:
            return self.load_parquet(str(parquet_path))
        elif csv_path.exists():
            return self.load_csv(str(csv_path))
        
        return None
    
    def get_or_fetch(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str = '1h',
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        use_cache: bool = True,
    ) -> pd.DataFrame:
        """
        Get data from cache or fetch from exchange.
        
        This is the main method for getting backtest data.
        """
        cache_key = f"{exchange_id}_{symbol.replace('/', '_')}_{timeframe}"
        
        if use_cache:
            cached = self.load_cached(cache_key)
            if cached is not None:
                # Filter by date range
                if start_date:
                    cached = cached[cached['timestamp'] >= pd.to_datetime(start_date)]
                if end_date:
                    cached = cached[cached['timestamp'] <= pd.to_datetime(end_date)]
                
                if len(cached) > 0:
                    return cached
        
        # Fetch from exchange
        since = datetime.fromisoformat(start_date) if start_date else None
        
        all_data = []
        current_since = since
        
        while True:
            df = self.load_from_exchange(
                exchange_id=exchange_id,
                symbol=symbol,
                timeframe=timeframe,
                since=current_since,
                limit=1000,
            )
            
            if len(df) == 0:
                break
            
            all_data.append(df)
            
            # Check if we've reached end_date
            if end_date and df['timestamp'].max() >= pd.to_datetime(end_date):
                break
            
            # Move to next batch
            current_since = df['timestamp'].max() + timedelta(seconds=1)
            
            # Prevent infinite loop
            if len(df) < 1000:
                break
        
        if not all_data:
            return pd.DataFrame()
        
        result = pd.concat(all_data, ignore_index=True)
        result = result.drop_duplicates(subset=['timestamp'])
        result = result.sort_values('timestamp')
        
        # Filter by end_date
        if end_date:
            result = result[result['timestamp'] <= pd.to_datetime(end_date)]
        
        # Cache the result
        if use_cache and len(result) > 0:
            self.cache_data(result, cache_key)
        
        return result
    
    def combine_data(self, *dfs: pd.DataFrame) -> pd.DataFrame:
        """Combine multiple DataFrames into one aligned dataset"""
        if not dfs:
            return pd.DataFrame()
        
        combined = pd.concat(dfs, ignore_index=True)
        combined = combined.sort_values('timestamp')
        return combined
    
    def resample(self, df: pd.DataFrame, target_timeframe: str) -> pd.DataFrame:
        """
        Resample OHLCV data to a different timeframe.
        
        Args:
            df: Source OHLCV DataFrame
            target_timeframe: Target timeframe (e.g., '4h', '1d')
        """
        # Parse timeframe
        timeframe_map = {
            '1m': '1T',
            '5m': '5T',
            '15m': '15T',
            '30m': '30T',
            '1h': '1H',
            '2h': '2H',
            '4h': '4H',
            '6h': '6H',
            '12h': '12H',
            '1d': '1D',
            '1w': '1W',
        }
        
        pandas_freq = timeframe_map.get(target_timeframe, target_timeframe)
        
        # Set timestamp as index
        df = df.set_index('timestamp')
        
        # Resample
        resampled = df.resample(pandas_freq).agg({
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum',
        }).dropna()
        
        resampled = resampled.reset_index()
        
        if 'symbol' in df.columns:
            resampled['symbol'] = df['symbol'].iloc[0]
        
        return resampled


# Corporate actions handler
class CorporateActionsHandler:
    """
    Handles corporate actions like splits and dividends.
    
    For crypto, this mainly handles:
    - Token splits/consolidations
    - Token migrations
    - Delistings
    """
    
    def __init__(self, adjustments_file: Optional[str] = None):
        self.adjustments: Dict[str, List[Dict[str, Any]]] = {}
        
        if adjustments_file and os.path.exists(adjustments_file):
            with open(adjustments_file, 'r') as f:
                self.adjustments = json.load(f)
    
    def adjust_for_splits(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Adjust historical prices for token splits"""
        if symbol not in self.adjustments:
            return df
        
        df = df.copy()
        
        for action in self.adjustments[symbol]:
            if action['type'] == 'split':
                ratio = action['ratio']
                action_date = pd.to_datetime(action['date'])
                
                # Adjust prices before the split
                mask = df['timestamp'] < action_date
                df.loc[mask, 'open'] /= ratio
                df.loc[mask, 'high'] /= ratio
                df.loc[mask, 'low'] /= ratio
                df.loc[mask, 'close'] /= ratio
                df.loc[mask, 'volume'] *= ratio
        
        return df
    
    def filter_delisted(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Filter out data after a token was delisted"""
        if symbol not in self.adjustments:
            return df
        
        for action in self.adjustments[symbol]:
            if action['type'] == 'delist':
                delist_date = pd.to_datetime(action['date'])
                df = df[df['timestamp'] < delist_date]
        
        return df

