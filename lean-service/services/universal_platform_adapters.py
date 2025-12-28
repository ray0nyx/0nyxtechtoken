"""
Universal Platform Adapters for Copy Trading
Supports Crypto Exchanges, NinjaTrader, Rithmic, and other platforms
"""

import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum
import ccxt.pro as ccxt
import websockets
import aiohttp
import numpy as np
from scipy.stats import pearsonr

logger = logging.getLogger(__name__)

class PlatformType(Enum):
    CRYPTO = "crypto"
    FUTURES = "futures"
    FOREX = "forex"
    STOCKS = "stocks"

class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"

class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"

@dataclass
class TradeSignal:
    """Universal trade signal format"""
    symbol: str
    side: OrderSide
    quantity: float
    price: Optional[float] = None
    order_type: OrderType = OrderType.MARKET
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    leverage: float = 1.0
    timestamp: datetime = None
    metadata: Dict[str, Any] = None

@dataclass
class ExecutionResult:
    """Universal execution result format"""
    success: bool
    order_id: Optional[str] = None
    filled_quantity: Optional[float] = None
    filled_price: Optional[float] = None
    remaining_quantity: Optional[float] = None
    fees: Optional[float] = None
    execution_time: Optional[datetime] = None
    error_message: Optional[str] = None
    platform: Optional[str] = None

@dataclass
class Position:
    """Position information"""
    symbol: str
    side: OrderSide
    size: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    realized_pnl: float
    leverage: float
    timestamp: datetime

@dataclass
class AccountInfo:
    """Account information"""
    balance: float
    equity: float
    margin_used: float
    margin_available: float
    positions: List[Position]
    timestamp: datetime

class BasePlatformAdapter(ABC):
    """Base class for all platform adapters"""
    
    def __init__(self, credentials: Dict[str, Any], platform_name: str):
        self.credentials = credentials
        self.platform_name = platform_name
        self.is_connected = False
        self.rate_limits = {}
        self.last_request_time = {}
        
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the platform"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """Disconnect from the platform"""
        pass
    
    @abstractmethod
    async def execute_trade(self, signal: TradeSignal) -> ExecutionResult:
        """Execute a trade on the platform"""
        pass
    
    @abstractmethod
    async def get_account_info(self) -> AccountInfo:
        """Get account information"""
        pass
    
    @abstractmethod
    async def get_positions(self) -> List[Position]:
        """Get current positions"""
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order"""
        pass
    
    @abstractmethod
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status"""
        pass
    
    def _check_rate_limit(self, endpoint: str) -> bool:
        """Check if we can make a request without hitting rate limits"""
        now = time.time()
        if endpoint in self.last_request_time:
            time_since_last = now - self.last_request_time[endpoint]
            if endpoint in self.rate_limits:
                min_interval = self.rate_limits[endpoint]
                if time_since_last < min_interval:
                    return False
        
        self.last_request_time[endpoint] = now
        return True
    
    async def _wait_for_rate_limit(self, endpoint: str):
        """Wait for rate limit to reset"""
        if endpoint in self.last_request_time and endpoint in self.rate_limits:
            time_since_last = time.time() - self.last_request_time[endpoint]
            min_interval = self.rate_limits[endpoint]
            if time_since_last < min_interval:
                await asyncio.sleep(min_interval - time_since_last)

class CryptoExchangeAdapter(BasePlatformAdapter):
    """Adapter for crypto exchanges using CCXT"""
    
    def __init__(self, credentials: Dict[str, Any], exchange_name: str):
        super().__init__(credentials, exchange_name)
        self.exchange = None
        self.markets = {}
        
    async def connect(self) -> bool:
        """Connect to crypto exchange"""
        try:
            # Get exchange class
            exchange_class = getattr(ccxt, self.platform_name.lower())
            
            # Create exchange instance
            self.exchange = exchange_class({
                'apiKey': self.credentials.get('api_key'),
                'secret': self.credentials.get('api_secret'),
                'password': self.credentials.get('passphrase'),  # For some exchanges
                'sandbox': self.credentials.get('sandbox', False),
                'enableRateLimit': True,
                'options': {
                    'defaultType': self.credentials.get('default_type', 'spot'),
                    'adjustForTimeDifference': True,
                }
            })
            
            # Load markets
            await self.exchange.load_markets()
            self.markets = self.exchange.markets
            
            # Set rate limits
            self.rate_limits = {
                'trading': 1.0 / self.exchange.rateLimit if hasattr(self.exchange, 'rateLimit') else 0.1,
                'account': 1.0 / self.exchange.rateLimit if hasattr(self.exchange, 'rateLimit') else 0.1,
            }
            
            # Test connection
            await self.exchange.fetch_balance()
            
            self.is_connected = True
            logger.info(f"Connected to {self.platform_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {self.platform_name}: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from exchange"""
        try:
            if self.exchange and hasattr(self.exchange, 'close'):
                await self.exchange.close()
            self.is_connected = False
            logger.info(f"Disconnected from {self.platform_name}")
            return True
        except Exception as e:
            logger.error(f"Error disconnecting from {self.platform_name}: {e}")
            return False
    
    async def execute_trade(self, signal: TradeSignal) -> ExecutionResult:
        """Execute trade on crypto exchange"""
        try:
            if not self.is_connected:
                return ExecutionResult(
                    success=False,
                    error_message="Not connected to exchange"
                )
            
            # Check rate limit
            await self._wait_for_rate_limit('trading')
            
            # Prepare order parameters
            order_params = {
                'symbol': signal.symbol,
                'type': signal.order_type.value,
                'side': signal.side.value,
                'amount': signal.quantity,
            }
            
            if signal.price and signal.order_type in [OrderType.LIMIT, OrderType.STOP_LIMIT]:
                order_params['price'] = signal.price
            
            if signal.leverage > 1.0:
                order_params['leverage'] = signal.leverage
            
            # Add stop loss and take profit if supported
            if signal.stop_loss or signal.take_profit:
                order_params['params'] = {}
                if signal.stop_loss:
                    order_params['params']['stopPrice'] = signal.stop_loss
                if signal.take_profit:
                    order_params['params']['takeProfitPrice'] = signal.take_profit
            
            # Execute order
            start_time = time.time()
            order = await self.exchange.create_order(**order_params)
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                success=True,
                order_id=str(order.get('id')),
                filled_quantity=order.get('filled', 0),
                filled_price=order.get('average', signal.price),
                remaining_quantity=order.get('remaining', 0),
                fees=order.get('fee', {}).get('cost', 0),
                execution_time=datetime.now(),
                platform=self.platform_name
            )
            
        except Exception as e:
            logger.error(f"Error executing trade on {self.platform_name}: {e}")
            return ExecutionResult(
                success=False,
                error_message=str(e),
                execution_time=datetime.now(),
                platform=self.platform_name
            )
    
    async def get_account_info(self) -> AccountInfo:
        """Get account information"""
        try:
            await self._wait_for_rate_limit('account')
            balance = await self.exchange.fetch_balance()
            
            # Calculate positions from balance
            positions = []
            for symbol, info in balance.items():
                if isinstance(info, dict) and info.get('total', 0) != 0:
                    # This is a simplified position calculation
                    # In reality, you'd need to fetch actual positions
                    position = Position(
                        symbol=symbol,
                        side=OrderSide.BUY if info['total'] > 0 else OrderSide.SELL,
                        size=abs(info['total']),
                        entry_price=0,  # Would need to calculate from trade history
                        current_price=0,  # Would need to fetch current price
                        unrealized_pnl=0,
                        realized_pnl=0,
                        leverage=1.0,
                        timestamp=datetime.now()
                    )
                    positions.append(position)
            
            return AccountInfo(
                balance=balance.get('USDT', {}).get('free', 0),
                equity=balance.get('USDT', {}).get('total', 0),
                margin_used=0,  # Would need to calculate
                margin_available=balance.get('USDT', {}).get('free', 0),
                positions=positions,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error getting account info from {self.platform_name}: {e}")
            raise
    
    async def get_positions(self) -> List[Position]:
        """Get current positions"""
        try:
            await self._wait_for_rate_limit('account')
            balance = await self.exchange.fetch_balance()
            
            positions = []
            for symbol, info in balance.items():
                if isinstance(info, dict) and info.get('total', 0) != 0:
                    position = Position(
                        symbol=symbol,
                        side=OrderSide.BUY if info['total'] > 0 else OrderSide.SELL,
                        size=abs(info['total']),
                        entry_price=0,
                        current_price=0,
                        unrealized_pnl=0,
                        realized_pnl=0,
                        leverage=1.0,
                        timestamp=datetime.now()
                    )
                    positions.append(position)
            
            return positions
            
        except Exception as e:
            logger.error(f"Error getting positions from {self.platform_name}: {e}")
            return []
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order"""
        try:
            await self._wait_for_rate_limit('trading')
            await self.exchange.cancel_order(order_id)
            return True
        except Exception as e:
            logger.error(f"Error canceling order {order_id} on {self.platform_name}: {e}")
            return False
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status"""
        try:
            await self._wait_for_rate_limit('trading')
            order = await self.exchange.fetch_order(order_id)
            return order
        except Exception as e:
            logger.error(f"Error getting order status {order_id} on {self.platform_name}: {e}")
            return {}

class NinjaTraderAdapter(BasePlatformAdapter):
    """Adapter for NinjaTrader platform"""
    
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials, "NinjaTrader")
        self.websocket = None
        self.api_url = credentials.get('api_url', 'ws://localhost:8080')
        self.session = None
        
    async def connect(self) -> bool:
        """Connect to NinjaTrader via WebSocket or API"""
        try:
            # Try WebSocket connection first
            try:
                self.websocket = await websockets.connect(self.api_url)
                self.is_connected = True
                logger.info("Connected to NinjaTrader via WebSocket")
                return True
            except Exception as ws_error:
                logger.warning(f"WebSocket connection failed: {ws_error}")
            
            # Fallback to HTTP API
            self.session = aiohttp.ClientSession()
            self.is_connected = True
            logger.info("Connected to NinjaTrader via HTTP API")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to NinjaTrader: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from NinjaTrader"""
        try:
            if self.websocket:
                await self.websocket.close()
            if self.session:
                await self.session.close()
            self.is_connected = False
            logger.info("Disconnected from NinjaTrader")
            return True
        except Exception as e:
            logger.error(f"Error disconnecting from NinjaTrader: {e}")
            return False
    
    async def execute_trade(self, signal: TradeSignal) -> ExecutionResult:
        """Execute trade on NinjaTrader"""
        try:
            if not self.is_connected:
                return ExecutionResult(
                    success=False,
                    error_message="Not connected to NinjaTrader"
                )
            
            # Prepare order for NinjaTrader
            order_data = {
                "action": "place_order",
                "symbol": signal.symbol,
                "side": signal.side.value,
                "quantity": signal.quantity,
                "order_type": signal.order_type.value,
                "price": signal.price,
                "stop_loss": signal.stop_loss,
                "take_profit": signal.take_profit,
                "leverage": signal.leverage
            }
            
            if self.websocket:
                # Send via WebSocket
                await self.websocket.send(json.dumps(order_data))
                response = await self.websocket.recv()
                result = json.loads(response)
            else:
                # Send via HTTP API
                async with self.session.post(f"{self.api_url}/api/orders", json=order_data) as response:
                    result = await response.json()
            
            if result.get('success'):
                return ExecutionResult(
                    success=True,
                    order_id=result.get('order_id'),
                    filled_quantity=result.get('filled_quantity', signal.quantity),
                    filled_price=result.get('filled_price', signal.price),
                    execution_time=datetime.now(),
                    platform=self.platform_name
                )
            else:
                return ExecutionResult(
                    success=False,
                    error_message=result.get('error', 'Unknown error'),
                    execution_time=datetime.now(),
                    platform=self.platform_name
                )
                
        except Exception as e:
            logger.error(f"Error executing trade on NinjaTrader: {e}")
            return ExecutionResult(
                success=False,
                error_message=str(e),
                execution_time=datetime.now(),
                platform=self.platform_name
            )
    
    async def get_account_info(self) -> AccountInfo:
        """Get account information from NinjaTrader"""
        try:
            if self.websocket:
                await self.websocket.send(json.dumps({"action": "get_account_info"}))
                response = await self.websocket.recv()
                data = json.loads(response)
            else:
                async with self.session.get(f"{self.api_url}/api/account") as response:
                    data = await response.json()
            
            return AccountInfo(
                balance=data.get('balance', 0),
                equity=data.get('equity', 0),
                margin_used=data.get('margin_used', 0),
                margin_available=data.get('margin_available', 0),
                positions=[],  # Would parse from data
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error getting account info from NinjaTrader: {e}")
            raise
    
    async def get_positions(self) -> List[Position]:
        """Get current positions from NinjaTrader"""
        try:
            if self.websocket:
                await self.websocket.send(json.dumps({"action": "get_positions"}))
                response = await self.websocket.recv()
                data = json.loads(response)
            else:
                async with self.session.get(f"{self.api_url}/api/positions") as response:
                    data = await response.json()
            
            positions = []
            for pos_data in data.get('positions', []):
                position = Position(
                    symbol=pos_data['symbol'],
                    side=OrderSide.BUY if pos_data['side'] == 'buy' else OrderSide.SELL,
                    size=pos_data['size'],
                    entry_price=pos_data['entry_price'],
                    current_price=pos_data['current_price'],
                    unrealized_pnl=pos_data['unrealized_pnl'],
                    realized_pnl=pos_data['realized_pnl'],
                    leverage=pos_data.get('leverage', 1.0),
                    timestamp=datetime.now()
                )
                positions.append(position)
            
            return positions
            
        except Exception as e:
            logger.error(f"Error getting positions from NinjaTrader: {e}")
            return []
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order on NinjaTrader"""
        try:
            order_data = {"action": "cancel_order", "order_id": order_id}
            
            if self.websocket:
                await self.websocket.send(json.dumps(order_data))
                response = await self.websocket.recv()
                result = json.loads(response)
            else:
                async with self.session.post(f"{self.api_url}/api/orders/cancel", json=order_data) as response:
                    result = await response.json()
            
            return result.get('success', False)
            
        except Exception as e:
            logger.error(f"Error canceling order {order_id} on NinjaTrader: {e}")
            return False
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status from NinjaTrader"""
        try:
            order_data = {"action": "get_order_status", "order_id": order_id}
            
            if self.websocket:
                await self.websocket.send(json.dumps(order_data))
                response = await self.websocket.recv()
                return json.loads(response)
            else:
                async with self.session.get(f"{self.api_url}/api/orders/{order_id}") as response:
                    return await response.json()
                    
        except Exception as e:
            logger.error(f"Error getting order status {order_id} from NinjaTrader: {e}")
            return {}

class RithmicAdapter(BasePlatformAdapter):
    """Adapter for Rithmic platform"""
    
    def __init__(self, credentials: Dict[str, Any]):
        super().__init__(credentials, "Rithmic")
        self.websocket = None
        self.api_url = credentials.get('api_url', 'wss://api.rithmic.com')
        self.session = None
        
    async def connect(self) -> bool:
        """Connect to Rithmic platform"""
        try:
            # Rithmic typically uses WebSocket for real-time data
            self.websocket = await websockets.connect(
                self.api_url,
                extra_headers={
                    'Authorization': f"Bearer {self.credentials.get('api_key')}"
                }
            )
            
            # Authenticate
            auth_message = {
                "action": "authenticate",
                "username": self.credentials.get('username'),
                "password": self.credentials.get('password')
            }
            await self.websocket.send(json.dumps(auth_message))
            response = await self.websocket.recv()
            auth_result = json.loads(response)
            
            if auth_result.get('success'):
                self.is_connected = True
                logger.info("Connected to Rithmic")
                return True
            else:
                logger.error(f"Rithmic authentication failed: {auth_result.get('error')}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to connect to Rithmic: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from Rithmic"""
        try:
            if self.websocket:
                await self.websocket.close()
            self.is_connected = False
            logger.info("Disconnected from Rithmic")
            return True
        except Exception as e:
            logger.error(f"Error disconnecting from Rithmic: {e}")
            return False
    
    async def execute_trade(self, signal: TradeSignal) -> ExecutionResult:
        """Execute trade on Rithmic"""
        try:
            if not self.is_connected:
                return ExecutionResult(
                    success=False,
                    error_message="Not connected to Rithmic"
                )
            
            # Prepare order for Rithmic
            order_data = {
                "action": "place_order",
                "symbol": signal.symbol,
                "side": signal.side.value,
                "quantity": signal.quantity,
                "order_type": signal.order_type.value,
                "price": signal.price,
                "stop_loss": signal.stop_loss,
                "take_profit": signal.take_profit,
                "leverage": signal.leverage
            }
            
            await self.websocket.send(json.dumps(order_data))
            response = await self.websocket.recv()
            result = json.loads(response)
            
            if result.get('success'):
                return ExecutionResult(
                    success=True,
                    order_id=result.get('order_id'),
                    filled_quantity=result.get('filled_quantity', signal.quantity),
                    filled_price=result.get('filled_price', signal.price),
                    execution_time=datetime.now(),
                    platform=self.platform_name
                )
            else:
                return ExecutionResult(
                    success=False,
                    error_message=result.get('error', 'Unknown error'),
                    execution_time=datetime.now(),
                    platform=self.platform_name
                )
                
        except Exception as e:
            logger.error(f"Error executing trade on Rithmic: {e}")
            return ExecutionResult(
                success=False,
                error_message=str(e),
                execution_time=datetime.now(),
                platform=self.platform_name
            )
    
    async def get_account_info(self) -> AccountInfo:
        """Get account information from Rithmic"""
        try:
            await self.websocket.send(json.dumps({"action": "get_account_info"}))
            response = await self.websocket.recv()
            data = json.loads(response)
            
            return AccountInfo(
                balance=data.get('balance', 0),
                equity=data.get('equity', 0),
                margin_used=data.get('margin_used', 0),
                margin_available=data.get('margin_available', 0),
                positions=[],  # Would parse from data
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error getting account info from Rithmic: {e}")
            raise
    
    async def get_positions(self) -> List[Position]:
        """Get current positions from Rithmic"""
        try:
            await self.websocket.send(json.dumps({"action": "get_positions"}))
            response = await self.websocket.recv()
            data = json.loads(response)
            
            positions = []
            for pos_data in data.get('positions', []):
                position = Position(
                    symbol=pos_data['symbol'],
                    side=OrderSide.BUY if pos_data['side'] == 'buy' else OrderSide.SELL,
                    size=pos_data['size'],
                    entry_price=pos_data['entry_price'],
                    current_price=pos_data['current_price'],
                    unrealized_pnl=pos_data['unrealized_pnl'],
                    realized_pnl=pos_data['realized_pnl'],
                    leverage=pos_data.get('leverage', 1.0),
                    timestamp=datetime.now()
                )
                positions.append(position)
            
            return positions
            
        except Exception as e:
            logger.error(f"Error getting positions from Rithmic: {e}")
            return []
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order on Rithmic"""
        try:
            order_data = {"action": "cancel_order", "order_id": order_id}
            await self.websocket.send(json.dumps(order_data))
            response = await self.websocket.recv()
            result = json.loads(response)
            return result.get('success', False)
            
        except Exception as e:
            logger.error(f"Error canceling order {order_id} on Rithmic: {e}")
            return False
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status from Rithmic"""
        try:
            order_data = {"action": "get_order_status", "order_id": order_id}
            await self.websocket.send(json.dumps(order_data))
            response = await self.websocket.recv()
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Error getting order status {order_id} from Rithmic: {e}")
            return {}

class UniversalPlatformManager:
    """Manager for all platform adapters"""
    
    def __init__(self):
        self.adapters: Dict[str, BasePlatformAdapter] = {}
        self.connection_pool = {}
        
    async def add_platform(self, platform_type: str, platform_name: str, credentials: Dict[str, Any]) -> bool:
        """Add a platform adapter"""
        try:
            if platform_type == PlatformType.CRYPTO.value:
                adapter = CryptoExchangeAdapter(credentials, platform_name)
            elif platform_type == PlatformType.FUTURES.value and platform_name.lower() == 'ninjatrader':
                adapter = NinjaTraderAdapter(credentials)
            elif platform_type == PlatformType.FUTURES.value and platform_name.lower() == 'rithmic':
                adapter = RithmicAdapter(credentials)
            else:
                logger.error(f"Unsupported platform: {platform_type}/{platform_name}")
                return False
            
            # Connect to platform
            if await adapter.connect():
                self.adapters[f"{platform_type}_{platform_name}"] = adapter
                logger.info(f"Added platform: {platform_type}/{platform_name}")
                return True
            else:
                logger.error(f"Failed to connect to platform: {platform_type}/{platform_name}")
                return False
                
        except Exception as e:
            logger.error(f"Error adding platform {platform_type}/{platform_name}: {e}")
            return False
    
    async def remove_platform(self, platform_key: str) -> bool:
        """Remove a platform adapter"""
        try:
            if platform_key in self.adapters:
                await self.adapters[platform_key].disconnect()
                del self.adapters[platform_key]
                logger.info(f"Removed platform: {platform_key}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error removing platform {platform_key}: {e}")
            return False
    
    async def execute_trade_on_all_platforms(self, signal: TradeSignal, platform_keys: List[str] = None) -> Dict[str, ExecutionResult]:
        """Execute trade on multiple platforms"""
        results = {}
        
        if platform_keys is None:
            platform_keys = list(self.adapters.keys())
        
        # Execute trades in parallel
        tasks = []
        for platform_key in platform_keys:
            if platform_key in self.adapters:
                task = asyncio.create_task(
                    self.adapters[platform_key].execute_trade(signal)
                )
                tasks.append((platform_key, task))
        
        # Wait for all executions to complete
        for platform_key, task in tasks:
            try:
                result = await task
                results[platform_key] = result
            except Exception as e:
                logger.error(f"Error executing trade on {platform_key}: {e}")
                results[platform_key] = ExecutionResult(
                    success=False,
                    error_message=str(e),
                    platform=platform_key
                )
        
        return results
    
    async def get_all_account_info(self) -> Dict[str, AccountInfo]:
        """Get account info from all platforms"""
        results = {}
        
        tasks = []
        for platform_key, adapter in self.adapters.items():
            task = asyncio.create_task(adapter.get_account_info())
            tasks.append((platform_key, task))
        
        for platform_key, task in tasks:
            try:
                account_info = await task
                results[platform_key] = account_info
            except Exception as e:
                logger.error(f"Error getting account info from {platform_key}: {e}")
        
        return results
    
    async def get_all_positions(self) -> Dict[str, List[Position]]:
        """Get positions from all platforms"""
        results = {}
        
        tasks = []
        for platform_key, adapter in self.adapters.items():
            task = asyncio.create_task(adapter.get_positions())
            tasks.append((platform_key, task))
        
        for platform_key, task in tasks:
            try:
                positions = await task
                results[platform_key] = positions
            except Exception as e:
                logger.error(f"Error getting positions from {platform_key}: {e}")
        
        return results
    
    async def cleanup(self):
        """Cleanup all adapters"""
        for platform_key, adapter in self.adapters.items():
            try:
                await adapter.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting from {platform_key}: {e}")
        
        self.adapters.clear()

# Factory function to create platform adapters
def create_platform_adapter(platform_type: str, platform_name: str, credentials: Dict[str, Any]) -> BasePlatformAdapter:
    """Factory function to create platform adapters"""
    if platform_type == PlatformType.CRYPTO.value:
        return CryptoExchangeAdapter(credentials, platform_name)
    elif platform_type == PlatformType.FUTURES.value and platform_name.lower() == 'ninjatrader':
        return NinjaTraderAdapter(credentials)
    elif platform_type == PlatformType.FUTURES.value and platform_name.lower() == 'rithmic':
        return RithmicAdapter(credentials)
    else:
        raise ValueError(f"Unsupported platform: {platform_type}/{platform_name}")

# Utility functions for position sizing and risk management
def calculate_kelly_position_size(
    win_rate: float,
    avg_win: float,
    avg_loss: float,
    current_capital: float,
    max_position_size: float = None
) -> float:
    """Calculate position size using Kelly Criterion"""
    if avg_loss <= 0 or win_rate <= 0 or win_rate >= 1:
        return 0.01  # Default 1%
    
    # Kelly fraction: f = (bp - q) / b
    # where b = avg_win/avg_loss, p = win_rate, q = 1 - win_rate
    b = avg_win / avg_loss
    p = win_rate
    q = 1 - win_rate
    
    kelly_fraction = (b * p - q) / b
    kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
    
    position_size = current_capital * kelly_fraction
    
    if max_position_size:
        position_size = min(position_size, max_position_size)
    
    return position_size

def calculate_correlation_risk(positions: List[Position], new_position: Position) -> float:
    """Calculate correlation risk for a new position"""
    if not positions:
        return 0.0
    
    # This is a simplified correlation calculation
    # In reality, you'd need historical price data
    similar_positions = [p for p in positions if p.symbol == new_position.symbol]
    
    if not similar_positions:
        return 0.0
    
    # Calculate correlation based on position sizes and directions
    existing_sizes = [p.size for p in similar_positions]
    existing_sides = [1 if p.side == OrderSide.BUY else -1 for p in similar_positions]
    
    new_size = new_position.size
    new_side = 1 if new_position.side == OrderSide.BUY else -1
    
    # Simple correlation calculation
    if len(existing_sizes) > 1:
        correlation = np.corrcoef(existing_sizes + [new_size], existing_sides + [new_side])[0, 1]
        return abs(correlation) if not np.isnan(correlation) else 0.0
    
    return 0.0




