"""
Exchange service for managing exchange connections and copy trading
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
import ccxt
import asyncpg

from models.backtest_models import ExchangeCredentials, ExchangeType

logger = logging.getLogger(__name__)

class ExchangeService:
    """Service for managing exchange connections and copy trading"""
    
    def __init__(self):
        self.exchanges = {}
        self._initialize_exchanges()
    
    def _initialize_exchanges(self):
        """Initialize exchange clients"""
        exchange_configs = {
            'binance': {
                'class': ccxt.binance,
                'sandbox': True,
                'rateLimit': 1200
            },
            'coinbase': {
                'class': ccxt.coinbasepro,
                'sandbox': True,
                'rateLimit': 1000
            },
            'kraken': {
                'class': ccxt.kraken,
                'sandbox': True,
                'rateLimit': 3000
            }
        }
        
        for exchange_name, config in exchange_configs.items():
            try:
                self.exchanges[exchange_name] = config
                logger.info(f"Initialized {exchange_name} exchange configuration")
            except Exception as e:
                logger.warning(f"Failed to initialize {exchange_name}: {e}")
    
    async def test_connection(self, exchange_name: str, credentials: ExchangeCredentials) -> bool:
        """Test exchange connection"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'apiKey': credentials.api_key,
                'secret': credentials.api_secret,
                'passphrase': credentials.passphrase,
                'sandbox': credentials.sandbox,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            # Test connection by fetching balance
            balance = await asyncio.get_event_loop().run_in_executor(
                None,
                exchange.fetch_balance
            )
            
            logger.info(f"Successfully connected to {exchange_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {exchange_name}: {e}")
            return False
    
    async def get_account_balance(self, exchange_name: str, credentials: ExchangeCredentials) -> Dict[str, float]:
        """Get account balance"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'apiKey': credentials.api_key,
                'secret': credentials.api_secret,
                'passphrase': credentials.passphrase,
                'sandbox': credentials.sandbox,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            balance = await asyncio.get_event_loop().run_in_executor(
                None,
                exchange.fetch_balance
            )
            
            return {
                'free': balance.get('free', {}),
                'used': balance.get('used', {}),
                'total': balance.get('total', {})
            }
            
        except Exception as e:
            logger.error(f"Failed to get balance from {exchange_name}: {e}")
            return {}
    
    async def place_order(
        self,
        exchange_name: str,
        credentials: ExchangeCredentials,
        symbol: str,
        side: str,
        quantity: float,
        price: Optional[float] = None,
        order_type: str = 'market'
    ) -> Dict[str, Any]:
        """Place order on exchange"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'apiKey': credentials.api_key,
                'secret': credentials.api_secret,
                'passphrase': credentials.passphrase,
                'sandbox': credentials.sandbox,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            # Place order
            order = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: exchange.create_order(
                    symbol=symbol,
                    type=order_type,
                    side=side,
                    amount=quantity,
                    price=price
                )
            )
            
            logger.info(f"Order placed on {exchange_name}: {order}")
            return order
            
        except Exception as e:
            logger.error(f"Failed to place order on {exchange_name}: {e}")
            raise
    
    async def get_order_status(
        self,
        exchange_name: str,
        credentials: ExchangeCredentials,
        order_id: str,
        symbol: str
    ) -> Dict[str, Any]:
        """Get order status"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'apiKey': credentials.api_key,
                'secret': credentials.api_secret,
                'passphrase': credentials.passphrase,
                'sandbox': credentials.sandbox,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            order = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: exchange.fetch_order(order_id, symbol)
            )
            
            return order
            
        except Exception as e:
            logger.error(f"Failed to get order status from {exchange_name}: {e}")
            raise
    
    async def cancel_order(
        self,
        exchange_name: str,
        credentials: ExchangeCredentials,
        order_id: str,
        symbol: str
    ) -> bool:
        """Cancel order"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'apiKey': credentials.api_key,
                'secret': credentials.api_secret,
                'passphrase': credentials.passphrase,
                'sandbox': credentials.sandbox,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: exchange.cancel_order(order_id, symbol)
            )
            
            logger.info(f"Order cancelled on {exchange_name}: {result}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cancel order on {exchange_name}: {e}")
            return False
    
    async def get_trading_fees(self, exchange_name: str, symbol: str) -> Dict[str, float]:
        """Get trading fees for symbol"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'sandbox': True,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            fees = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: exchange.fetch_trading_fees([symbol])
            )
            
            return fees.get(symbol, {})
            
        except Exception as e:
            logger.error(f"Failed to get trading fees from {exchange_name}: {e}")
            return {}
    
    async def get_symbol_info(self, exchange_name: str, symbol: str) -> Dict[str, Any]:
        """Get symbol information"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'sandbox': True,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            markets = await asyncio.get_event_loop().run_in_executor(
                None,
                exchange.load_markets
            )
            
            return markets.get(symbol, {})
            
        except Exception as e:
            logger.error(f"Failed to get symbol info from {exchange_name}: {e}")
            return {}
    
    async def validate_symbol(self, exchange_name: str, symbol: str) -> bool:
        """Validate if symbol is available on exchange"""
        try:
            symbol_info = await self.get_symbol_info(exchange_name, symbol)
            return bool(symbol_info)
        except Exception as e:
            logger.error(f"Failed to validate symbol {symbol} on {exchange_name}: {e}")
            return False
    
    async def get_supported_symbols(self, exchange_name: str) -> List[str]:
        """Get list of supported symbols"""
        try:
            exchange_class = self.exchanges[exchange_name]['class']
            exchange = exchange_class({
                'sandbox': True,
                'rateLimit': self.exchanges[exchange_name]['rateLimit']
            })
            
            markets = await asyncio.get_event_loop().run_in_executor(
                None,
                exchange.load_markets
            )
            
            return list(markets.keys())
            
        except Exception as e:
            logger.error(f"Failed to get supported symbols from {exchange_name}: {e}")
            return []
    
    async def calculate_position_size(
        self,
        exchange_name: str,
        credentials: ExchangeCredentials,
        symbol: str,
        risk_amount: float,
        entry_price: float,
        stop_loss_price: Optional[float] = None
    ) -> float:
        """Calculate position size based on risk"""
        try:
            # Get account balance
            balance = await self.get_account_balance(exchange_name, credentials)
            
            # Get available balance for the base currency
            symbol_parts = symbol.split('/')
            base_currency = symbol_parts[0]
            
            available_balance = balance.get('free', {}).get(base_currency, 0)
            
            if available_balance <= 0:
                return 0.0
            
            # Calculate position size based on risk
            if stop_loss_price:
                risk_per_unit = abs(entry_price - stop_loss_price)
                position_size = risk_amount / risk_per_unit
            else:
                # Use 2% of available balance as risk
                position_size = (available_balance * 0.02) / entry_price
            
            # Ensure position size doesn't exceed available balance
            max_position_size = available_balance / entry_price
            position_size = min(position_size, max_position_size)
            
            return position_size
            
        except Exception as e:
            logger.error(f"Failed to calculate position size: {e}")
            return 0.0
    
    async def check_risk_limits(
        self,
        exchange_name: str,
        credentials: ExchangeCredentials,
        symbol: str,
        quantity: float,
        price: float,
        risk_limits: Dict[str, float]
    ) -> bool:
        """Check if trade meets risk limits"""
        try:
            # Get account balance
            balance = await self.get_account_balance(exchange_name, credentials)
            
            # Calculate trade value
            trade_value = quantity * price
            
            # Check maximum position size limit
            max_position_size = risk_limits.get('max_position_size', 0.1)
            total_balance = sum(balance.get('total', {}).values())
            
            if trade_value > total_balance * max_position_size:
                logger.warning(f"Trade exceeds maximum position size limit")
                return False
            
            # Check daily loss limit
            max_daily_loss = risk_limits.get('max_daily_loss', 0.05)
            # Would need to calculate daily P&L from trade history
            
            # Check slippage limit
            max_slippage = risk_limits.get('max_slippage', 0.001)
            # Would need to calculate expected slippage
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to check risk limits: {e}")
            return False
