"""
Broker Integration Service
Handles integration with free broker APIs (Binance, Coinbase, Kraken)
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import aiohttp
import ccxt.pro as ccxt

from utils.security import SecurityUtils
from utils.monitoring import broker_connections, broker_errors, broker_latency

logger = logging.getLogger(__name__)

@dataclass
class BrokerConfig:
    """Configuration for broker integration"""
    exchange_name: str
    api_key: str
    api_secret: str
    sandbox: bool = False
    rate_limit: int = 1200  # requests per minute
    timeout: int = 30

@dataclass
class OrderRequest:
    """Order request structure"""
    symbol: str
    side: str  # 'buy' or 'sell'
    amount: float
    price: Optional[float] = None
    order_type: str = 'market'  # 'market', 'limit', 'stop'
    time_in_force: str = 'GTC'  # 'GTC', 'IOC', 'FOK'
    client_order_id: Optional[str] = None

@dataclass
class OrderResponse:
    """Order response structure"""
    order_id: str
    symbol: str
    side: str
    amount: float
    price: float
    status: str  # 'new', 'filled', 'canceled', 'rejected'
    filled_amount: float = 0.0
    filled_price: float = 0.0
    timestamp: datetime = None
    error_message: Optional[str] = None

class BrokerIntegrationService:
    """Service for integrating with free broker APIs"""
    
    def __init__(self, encryption_key: str):
        self.security_utils = SecurityUtils()
        self.security_utils.encryption_key = encryption_key
        
        # Exchange clients cache
        self.exchange_clients: Dict[str, ccxt.Exchange] = {}
        
        # Rate limiting tracking
        self.rate_limits: Dict[str, Dict[str, Any]] = {}
        
        # Supported exchanges with free APIs
        self.supported_exchanges = {
            'binance': {
                'name': 'Binance',
                'type': 'crypto',
                'free_features': ['spot_trading', 'futures_trading', 'websocket', 'market_data'],
                'rate_limits': {'requests_per_minute': 1200, 'orders_per_second': 10},
                'min_order_size': 0.001,
                'supported_symbols': ['BTC/USDT', 'ETH/USDT', 'BNB/USDT']
            },
            'coinbase': {
                'name': 'Coinbase Pro',
                'type': 'crypto',
                'free_features': ['spot_trading', 'websocket', 'market_data'],
                'rate_limits': {'requests_per_minute': 300, 'orders_per_second': 3},
                'min_order_size': 0.01,
                'supported_symbols': ['BTC-USD', 'ETH-USD', 'LTC-USD']
            },
            'kraken': {
                'name': 'Kraken',
                'type': 'crypto',
                'free_features': ['spot_trading', 'websocket', 'market_data'],
                'rate_limits': {'requests_per_minute': 60, 'orders_per_second': 1},
                'min_order_size': 0.0001,
                'supported_symbols': ['BTC/USD', 'ETH/USD', 'LTC/USD']
            }
        }
        
        logger.info("Broker Integration Service initialized")

    async def connect_exchange(self, exchange_name: str, api_key: str, api_secret: str, sandbox: bool = False) -> bool:
        """Connect to an exchange"""
        try:
            exchange_name = exchange_name.lower()
            
            if exchange_name not in self.supported_exchanges:
                logger.error(f"Unsupported exchange: {exchange_name}")
                return False
            
            # Create exchange client
            exchange_class = getattr(ccxt, exchange_name)
            client = exchange_class({
                'apiKey': api_key,
                'secret': api_secret,
                'sandbox': sandbox,
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'spot'  # Start with spot trading
                }
            })
            
            # Test connection
            await client.load_markets()
            balance = await client.fetch_balance()
            
            # Store client
            self.exchange_clients[exchange_name] = client
            
            # Initialize rate limiting
            self.rate_limits[exchange_name] = {
                'last_request': datetime.now(),
                'request_count': 0,
                'requests_per_minute': self.supported_exchanges[exchange_name]['rate_limits']['requests_per_minute']
            }
            
            broker_connections.labels(exchange=exchange_name).inc()
            logger.info(f"Successfully connected to {exchange_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='connection').inc()
            return False

    async def place_order(self, exchange_name: str, order_request: OrderRequest) -> OrderResponse:
        """Place an order on an exchange"""
        try:
            start_time = datetime.now()
            
            # Check rate limits
            if not await self._check_rate_limit(exchange_name):
                return OrderResponse(
                    order_id="",
                    symbol=order_request.symbol,
                    side=order_request.side,
                    amount=order_request.amount,
                    price=order_request.price or 0.0,
                    status="rejected",
                    error_message="Rate limit exceeded"
                )
            
            # Get exchange client
            client = self.exchange_clients.get(exchange_name)
            if not client:
                return OrderResponse(
                    order_id="",
                    symbol=order_request.symbol,
                    side=order_request.side,
                    amount=order_request.amount,
                    price=order_request.price or 0.0,
                    status="rejected",
                    error_message=f"Exchange {exchange_name} not connected"
                )
            
            # Validate order
            validation_result = await self._validate_order(exchange_name, order_request)
            if not validation_result['valid']:
                return OrderResponse(
                    order_id="",
                    symbol=order_request.symbol,
                    side=order_request.side,
                    amount=order_request.amount,
                    price=order_request.price or 0.0,
                    status="rejected",
                    error_message=validation_result['error']
                )
            
            # Place order
            order = await client.create_order(
                symbol=order_request.symbol,
                type=order_request.order_type,
                side=order_request.side,
                amount=order_request.amount,
                price=order_request.price,
                params={'timeInForce': order_request.time_in_force}
            )
            
            # Record latency
            latency = (datetime.now() - start_time).total_seconds()
            broker_latency.labels(exchange=exchange_name).observe(latency)
            
            # Convert to OrderResponse
            response = OrderResponse(
                order_id=order.get('id', ''),
                symbol=order.get('symbol', order_request.symbol),
                side=order.get('side', order_request.side),
                amount=order.get('amount', order_request.amount),
                price=order.get('price', order_request.price or 0.0),
                status=order.get('status', 'new'),
                filled_amount=order.get('filled', 0.0),
                filled_price=order.get('average', 0.0),
                timestamp=datetime.now()
            )
            
            logger.info(f"Order placed on {exchange_name}: {response.order_id}")
            return response
            
        except Exception as e:
            logger.error(f"Error placing order on {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='order_placement').inc()
            
            return OrderResponse(
                order_id="",
                symbol=order_request.symbol,
                side=order_request.side,
                amount=order_request.amount,
                price=order_request.price or 0.0,
                status="rejected",
                error_message=str(e)
            )

    async def get_order_status(self, exchange_name: str, order_id: str, symbol: str = None) -> OrderResponse:
        """Get order status"""
        try:
            client = self.exchange_clients.get(exchange_name)
            if not client:
                return OrderResponse(
                    order_id=order_id,
                    symbol=symbol or "",
                    side="",
                    amount=0.0,
                    price=0.0,
                    status="rejected",
                    error_message=f"Exchange {exchange_name} not connected"
                )
            
            # Check rate limits
            if not await self._check_rate_limit(exchange_name):
                return OrderResponse(
                    order_id=order_id,
                    symbol=symbol or "",
                    side="",
                    amount=0.0,
                    price=0.0,
                    status="rejected",
                    error_message="Rate limit exceeded"
                )
            
            # Fetch order
            order = await client.fetch_order(order_id, symbol)
            
            return OrderResponse(
                order_id=order.get('id', order_id),
                symbol=order.get('symbol', symbol or ""),
                side=order.get('side', ""),
                amount=order.get('amount', 0.0),
                price=order.get('price', 0.0),
                status=order.get('status', 'unknown'),
                filled_amount=order.get('filled', 0.0),
                filled_price=order.get('average', 0.0),
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error getting order status from {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='order_status').inc()
            
            return OrderResponse(
                order_id=order_id,
                symbol=symbol or "",
                side="",
                amount=0.0,
                price=0.0,
                status="rejected",
                error_message=str(e)
            )

    async def cancel_order(self, exchange_name: str, order_id: str, symbol: str = None) -> bool:
        """Cancel an order"""
        try:
            client = self.exchange_clients.get(exchange_name)
            if not client:
                logger.error(f"Exchange {exchange_name} not connected")
                return False
            
            # Check rate limits
            if not await self._check_rate_limit(exchange_name):
                logger.error(f"Rate limit exceeded for {exchange_name}")
                return False
            
            # Cancel order
            await client.cancel_order(order_id, symbol)
            
            logger.info(f"Order {order_id} cancelled on {exchange_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling order on {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='order_cancellation').inc()
            return False

    async def get_balance(self, exchange_name: str) -> Dict[str, float]:
        """Get account balance"""
        try:
            client = self.exchange_clients.get(exchange_name)
            if not client:
                logger.error(f"Exchange {exchange_name} not connected")
                return {}
            
            # Check rate limits
            if not await self._check_rate_limit(exchange_name):
                logger.error(f"Rate limit exceeded for {exchange_name}")
                return {}
            
            # Fetch balance
            balance = await client.fetch_balance()
            
            # Extract free balances
            free_balances = {}
            for currency, amounts in balance.items():
                if isinstance(amounts, dict) and 'free' in amounts:
                    free_balances[currency] = amounts['free']
            
            return free_balances
            
        except Exception as e:
            logger.error(f"Error getting balance from {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='balance').inc()
            return {}

    async def get_market_data(self, exchange_name: str, symbol: str) -> Dict[str, Any]:
        """Get market data for a symbol"""
        try:
            client = self.exchange_clients.get(exchange_name)
            if not client:
                logger.error(f"Exchange {exchange_name} not connected")
                return {}
            
            # Check rate limits
            if not await self._check_rate_limit(exchange_name):
                logger.error(f"Rate limit exceeded for {exchange_name}")
                return {}
            
            # Fetch ticker
            ticker = await client.fetch_ticker(symbol)
            
            return {
                'symbol': ticker.get('symbol', symbol),
                'last': ticker.get('last', 0.0),
                'bid': ticker.get('bid', 0.0),
                'ask': ticker.get('ask', 0.0),
                'high': ticker.get('high', 0.0),
                'low': ticker.get('low', 0.0),
                'volume': ticker.get('baseVolume', 0.0),
                'timestamp': ticker.get('timestamp', datetime.now().timestamp())
            }
            
        except Exception as e:
            logger.error(f"Error getting market data from {exchange_name}: {e}")
            broker_errors.labels(exchange=exchange_name, error_type='market_data').inc()
            return {}

    async def _check_rate_limit(self, exchange_name: str) -> bool:
        """Check and update rate limits"""
        try:
            if exchange_name not in self.rate_limits:
                return True
            
            now = datetime.now()
            rate_limit = self.rate_limits[exchange_name]
            
            # Reset counter if more than a minute has passed
            if (now - rate_limit['last_request']).total_seconds() > 60:
                rate_limit['request_count'] = 0
                rate_limit['last_request'] = now
            
            # Check if we're within limits
            if rate_limit['request_count'] >= rate_limit['requests_per_minute']:
                return False
            
            # Update counter
            rate_limit['request_count'] += 1
            rate_limit['last_request'] = now
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return False

    async def _validate_order(self, exchange_name: str, order_request: OrderRequest) -> Dict[str, Any]:
        """Validate order before placement"""
        try:
            exchange_info = self.supported_exchanges.get(exchange_name)
            if not exchange_info:
                return {'valid': False, 'error': f'Unsupported exchange: {exchange_name}'}
            
            # Check minimum order size
            min_order_size = exchange_info.get('min_order_size', 0.001)
            if order_request.amount < min_order_size:
                return {
                    'valid': False, 
                    'error': f'Order amount {order_request.amount} below minimum {min_order_size}'
                }
            
            # Check supported symbols
            supported_symbols = exchange_info.get('supported_symbols', [])
            if supported_symbols and order_request.symbol not in supported_symbols:
                return {
                    'valid': False,
                    'error': f'Symbol {order_request.symbol} not supported on {exchange_name}'
                }
            
            # Check order type
            if order_request.order_type not in ['market', 'limit', 'stop']:
                return {
                    'valid': False,
                    'error': f'Invalid order type: {order_request.order_type}'
                }
            
            # Check side
            if order_request.side not in ['buy', 'sell']:
                return {
                    'valid': False,
                    'error': f'Invalid order side: {order_request.side}'
                }
            
            return {'valid': True}
            
        except Exception as e:
            logger.error(f"Error validating order: {e}")
            return {'valid': False, 'error': str(e)}

    async def get_supported_exchanges(self) -> Dict[str, Any]:
        """Get list of supported exchanges"""
        return self.supported_exchanges

    async def get_exchange_info(self, exchange_name: str) -> Dict[str, Any]:
        """Get information about a specific exchange"""
        return self.supported_exchanges.get(exchange_name.lower(), {})

    async def test_connection(self, exchange_name: str, api_key: str, api_secret: str) -> Dict[str, Any]:
        """Test connection to an exchange"""
        try:
            # Create temporary client for testing
            exchange_class = getattr(ccxt, exchange_name.lower())
            client = exchange_class({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
                'sandbox': True  # Use sandbox for testing
            })
            
            # Test connection
            await client.load_markets()
            balance = await client.fetch_balance()
            
            return {
                'success': True,
                'exchange': exchange_name,
                'markets_count': len(client.markets),
                'has_balance': bool(balance),
                'message': 'Connection successful'
            }
            
        except Exception as e:
            logger.error(f"Error testing connection to {exchange_name}: {e}")
            return {
                'success': False,
                'exchange': exchange_name,
                'error': str(e),
                'message': 'Connection failed'
            }

    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Close all exchange clients
            for client in self.exchange_clients.values():
                if hasattr(client, 'close'):
                    await client.close()
            
            self.exchange_clients.clear()
            self.rate_limits.clear()
            
            logger.info("Broker integration service cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
