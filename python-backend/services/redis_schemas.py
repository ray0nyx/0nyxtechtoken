"""
Redis Schema Definitions

Defines all Redis keys and channels used throughout the system.
This ensures consistency and makes it easy to understand the data structure.

Key Naming Convention:
- Pub/Sub channels: lowercase with colons (e.g., "swaps:token_address")
- Cache keys: lowercase with colons (e.g., "quote:input:output:amount")
- Sorted sets: lowercase with colons (e.g., "swaps:ordered:token_address")
"""

# ============ Pub/Sub Channels ============

def swap_pubsub_key(token_address: str) -> str:
    """Channel for real-time swap events"""
    return f"swaps:{token_address}"


def candle_pubsub_key(token_address: str, timeframe: str) -> str:
    """Channel for OHLCV candle updates"""
    return f"candles:{token_address}:{timeframe}"


def token_info_pubsub_key(token_address: str) -> str:
    """Channel for token metadata updates"""
    return f"token_info:{token_address}"


def migration_pubsub_key() -> str:
    """Channel for Pump.fun -> Raydium migration events"""
    return "migrations:events"


def whale_alert_pubsub_key() -> str:
    """Channel for whale transaction alerts"""
    return "alerts:whale"


# ============ Cache Keys ============

def quote_key(input_mint: str, output_mint: str, amount: int) -> str:
    """Cache key for Jupiter quotes"""
    return f"quote:{input_mint}:{output_mint}:{amount}"


def token_info_key(token_address: str) -> str:
    """Cache key for token metadata"""
    return f"token_info:{token_address}"


def token_supply_key(token_address: str) -> str:
    """Cache key for token supply (with TTL for refresh)"""
    return f"token_supply:{token_address}"


def sol_price_key() -> str:
    """Cache key for SOL/USD price"""
    return "price:sol_usd"


# ============ Sorted Set Keys (for event ordering) ============

def swap_ordered_key(token_address: str) -> str:
    """Sorted set key for ordered swap events"""
    return f"swaps:ordered:{token_address}"


def candle_history_key(token_address: str, timeframe: str) -> str:
    """Sorted set key for historical candles (optional, for persistence)"""
    return f"candles:history:{token_address}:{timeframe}"


# ============ Set Keys (for tracking) ============

def processed_signatures_key() -> str:
    """Set key for tracking processed transaction signatures (deduplication)"""
    return "processed:signatures"


def active_tokens_key() -> str:
    """Set key for tracking currently active/monitored tokens"""
    return "tokens:active"


def subscribed_tokens_key() -> str:
    """Set key for tokens with active WebSocket subscriptions"""
    return "tokens:subscribed"


# ============ Hash Keys (for metadata) ============

def token_metadata_key(token_address: str) -> str:
    """Hash key for token metadata (supply, decimals, etc.)"""
    return f"token:metadata:{token_address}"


def aggregator_state_key(token_address: str, timeframe: str) -> str:
    """Hash key for aggregator state (current candle, last processed time)"""
    return f"aggregator:state:{token_address}:{timeframe}"


def sequence_key(token_address: str) -> str:
    """Key for per-token sequence counter (atomic increment)"""
    return f"seq:{token_address}"


# ============ TTL Constants ============

# Quote cache TTL (very short, quotes expire quickly)
QUOTE_TTL_SECONDS = 1

# Token info cache TTL (moderate, metadata doesn't change often)
TOKEN_INFO_TTL_SECONDS = 60

# Token supply cache TTL (short, supply can change via mints/burns)
TOKEN_SUPPLY_TTL_SECONDS = 300

# SOL price cache TTL (moderate, price updates frequently but not every second)
SOL_PRICE_TTL_SECONDS = 10

# Processed signatures TTL (long, prevent reprocessing for a while)
PROCESSED_SIGNATURES_TTL_SECONDS = 3600  # 1 hour

# ============ Key Patterns (for cleanup/scanning) ============

def swap_pattern() -> str:
    """Pattern for all swap channels"""
    return "swaps:*"


def candle_pattern() -> str:
    """Pattern for all candle channels"""
    return "candles:*"


def quote_pattern() -> str:
    """Pattern for all quote cache keys"""
    return "quote:*"


def token_info_pattern() -> str:
    """Pattern for all token info keys"""
    return "token_info:*"


def indicator_key(token_address: str, timeframe: str, time: int) -> str:
    """Cache key for indicator values"""
    return f"indicators:{token_address}:{timeframe}:{time}"


def rsi_key(token_address: str, timeframe: str) -> str:
    """Cache key for RSI value"""
    return f"rsi:{token_address}:{timeframe}"


def macd_key(token_address: str, timeframe: str) -> str:
    """Cache key for MACD values"""
    return f"macd:{token_address}:{timeframe}"


def volume_profile_key(token_address: str, timeframe: str) -> str:
    """Cache key for volume profile"""
    return f"volume_profile:{token_address}:{timeframe}"


def token_state_key(token_address: str) -> str:
    """Cache key for token state (pump_fun vs raydium)"""
    return f"token_state:{token_address}"


# ============ Additional TTL Constants ============

# Indicator cache TTL (long, indicators don't change once computed)
INDICATOR_TTL_SECONDS = 86400  # 24 hours

