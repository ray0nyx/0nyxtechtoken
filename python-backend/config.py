"""
Configuration settings for the market data service
"""
import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Keys
    alpha_vantage_api_key: str = ""
    polygon_api_key: str = ""
    finnhub_api_key: str = ""
    crypto_api_key: str = "053c040e81b4473080f97c6504680dee"  # Your crypto API key
    helius_api_key: str = os.getenv("HELIUS_API_KEY", "")
    birdeye_api_key: str = os.getenv("BIRDEYE_API_KEY", "")
    tatum_api_key: str = os.getenv("TATUM_API_KEY", "")
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = True
    
    # Rate Limiting
    rate_limit_per_minute: int = 60
    max_concurrent_requests: int = 10
    
    # Data Sources Priority
    preferred_data_source: str = "alpha_vantage"
    fallback_data_sources: List[str] = ["yfinance", "ccxt"]
    
    # Redis Configuration
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_channel_swaps: str = "swaps:{token_address}"
    redis_channel_candles: str = "candles:{token_address}:{timeframe}"
    redis_key_quote_cache: str = "quote:{input}:{output}:{amount}"
    redis_key_token_info: str = "token_info:{token_address}"
    
    # Solana RPC Configuration
    quicknode_rpc_url: str = os.getenv("QUICKNODE_RPC_URL", "")
    alchemy_rpc_url: str = os.getenv("ALCHEMY_RPC_URL", "")
    alchemy_api_key: str = os.getenv("ALCHEMY_API_KEY", "")
    
    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        extra = "ignore"

settings = Settings()
