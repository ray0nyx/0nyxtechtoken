"""
Trading WebSocket Server

Real-time WebSocket endpoint for streaming:
- Market cap OHLCV candles
- Swap/trade events
- Token metadata updates
- Quote updates

This is the main fan-out point from Redis pub/sub to connected frontend clients.
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.redis_service import (
    RedisService,
    SwapEvent,
    CandleUpdate,
    get_redis_service,
)
from services.marketcap_aggregator import (
    get_multi_aggregator,
    timeframe_string_to_ms,
)
from services.swap_stream import get_swap_stream_service
from services.websocket_backpressure import (
    get_backpressure_controller,
    MessagePriority,
)

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """WebSocket message types"""
    # Client -> Server
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    GET_CANDLES = "get_candles"
    GET_TOKEN_INFO = "get_token_info"
    PING = "ping"
    
    # Server -> Client
    CANDLE = "candle"
    TRADE = "trade"
    TOKEN_INFO = "token_info"
    QUOTE = "quote"
    STATUS = "status"
    ERROR = "error"
    PONG = "pong"
    CANDLES = "candles"  # Response to GET_CANDLES


@dataclass
class WSMessage:
    """WebSocket message structure"""
    type: str
    data: dict
    timestamp: int = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = int(datetime.utcnow().timestamp() * 1000)
    
    def to_json(self) -> str:
        return json.dumps({
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp,
        })


@dataclass
class ClientSubscription:
    """Tracks what a client is subscribed to"""
    token_address: str
    timeframes: Set[str]  # e.g., {"1m", "5m", "15m"}


class TradingWebSocketManager:
    """
    Manages WebSocket connections for trading data.
    
    Features:
    - Multi-client connection management
    - Per-token/timeframe subscriptions
    - Efficient fan-out from Redis pub/sub
    - Automatic cleanup on disconnect
    - Backpressure control (message queue per connection)
    - Message replay on reconnection
    - Graceful degradation
    """
    
    def __init__(self):
        # websocket -> subscriptions
        self.connections: Dict[WebSocket, Dict[str, ClientSubscription]] = {}
        # token_address -> set of websockets
        self.token_subscribers: Dict[str, Set[WebSocket]] = {}
        # (token, timeframe) -> set of websockets
        self.candle_subscribers: Dict[tuple, Set[WebSocket]] = {}
        
        # Backpressure control: message queues per connection
        self.message_queues: Dict[WebSocket, asyncio.Queue] = {}
        self.queue_sizes: Dict[WebSocket, int] = {}  # Track queue size
        self.max_queue_size = 100  # Max messages in queue before backpressure
        
        # Message replay: store last N messages per token/timeframe
        self.message_history: Dict[tuple, List[WSMessage]] = {}  # (token, timeframe) -> [messages]
        self.max_history = 50  # Keep last 50 messages for replay
        
        self._redis: Optional[RedisService] = None
        self._running = False
        self._listener_tasks: List[asyncio.Task] = []
        self._sender_tasks: Dict[WebSocket, asyncio.Task] = {}  # Per-connection sender tasks
        self._backpressure = get_backpressure_controller()
    
    async def initialize(self):
        """Initialize the WebSocket manager"""
        self._redis = await get_redis_service()
        self._running = True
        logger.info("TradingWebSocketManager initialized")
    
    async def shutdown(self):
        """Shutdown the WebSocket manager"""
        self._running = False
        
        for task in self._listener_tasks:
            task.cancel()
        
        # Close all connections
        for ws in list(self.connections.keys()):
            await self.disconnect(ws)
        
        logger.info("TradingWebSocketManager shutdown")
    
    async def connect(self, websocket: WebSocket):
        """Handle new WebSocket connection"""
        await websocket.accept()
        self.connections[websocket] = {}
        
        # Register with backpressure controller
        self._backpressure.register_client(websocket)
        
        # Send welcome message
        await self._send(websocket, WSMessage(
            type=MessageType.STATUS.value,
            data={"status": "connected", "message": "Connected to trading WebSocket"}
        ), priority=MessagePriority.HIGH)
        
        logger.info(f"Client connected. Total connections: {len(self.connections)}")
    
    async def disconnect(self, websocket: WebSocket):
        """Handle WebSocket disconnection"""
        if websocket not in self.connections:
            return
        
        # Unregister from backpressure controller
        self._backpressure.unregister_client(websocket)
        
        # Remove from all subscription sets
        for token in list(self.token_subscribers.keys()):
            self.token_subscribers[token].discard(websocket)
            if not self.token_subscribers[token]:
                del self.token_subscribers[token]
        
        for key in list(self.candle_subscribers.keys()):
            self.candle_subscribers[key].discard(websocket)
            if not self.candle_subscribers[key]:
                del self.candle_subscribers[key]
        
        del self.connections[websocket]
        
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception:
            pass
        
        logger.info(f"Client disconnected. Total connections: {len(self.connections)}")
    
    async def handle_message(self, websocket: WebSocket, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            msg_type = data.get("type", "")
            payload = data.get("data", {})
            
            if msg_type == MessageType.SUBSCRIBE.value:
                await self._handle_subscribe(websocket, payload)
            
            elif msg_type == MessageType.UNSUBSCRIBE.value:
                await self._handle_unsubscribe(websocket, payload)
            
            elif msg_type == MessageType.GET_CANDLES.value:
                await self._handle_get_candles(websocket, payload)
            
            elif msg_type == MessageType.GET_TOKEN_INFO.value:
                await self._handle_get_token_info(websocket, payload)
            
            elif msg_type == MessageType.PING.value:
                await self._send(websocket, WSMessage(
                    type=MessageType.PONG.value,
                    data={}
                ))
            
            else:
                await self._send_error(websocket, f"Unknown message type: {msg_type}")
        
        except json.JSONDecodeError:
            await self._send_error(websocket, "Invalid JSON")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self._send_error(websocket, str(e))
    
    async def _handle_subscribe(self, websocket: WebSocket, payload: dict):
        """Handle subscription request"""
        token_address = payload.get("token")
        timeframes = payload.get("timeframes", ["1m"])
        
        if not token_address:
            await self._send_error(websocket, "Missing token address")
            return
        
        # Ensure timeframes is a list
        if isinstance(timeframes, str):
            timeframes = [timeframes]
        
        # Add to token subscribers
        if token_address not in self.token_subscribers:
            self.token_subscribers[token_address] = set()
        self.token_subscribers[token_address].add(websocket)
        
        # Add to candle subscribers for each timeframe
        for tf in timeframes:
            key = (token_address, tf)
            if key not in self.candle_subscribers:
                self.candle_subscribers[key] = set()
            self.candle_subscribers[key].add(websocket)
        
        # Track subscription for this client
        self.connections[websocket][token_address] = ClientSubscription(
            token_address=token_address,
            timeframes=set(timeframes)
        )
        
        # Subscribe to Redis channels
        await self._subscribe_to_redis(token_address, timeframes)
        
        # Also subscribe via swap stream service
        try:
            swap_service = await get_swap_stream_service()
            await swap_service.subscribe_token(token_address)
        except Exception as e:
            logger.warning(f"Could not subscribe via swap stream: {e}")
        
        await self._send(websocket, WSMessage(
            type=MessageType.STATUS.value,
            data={
                "status": "subscribed",
                "token": token_address,
                "timeframes": timeframes,
            }
        ))
        
        # Replay recent messages for this token/timeframe
        await self._replay_recent_messages(websocket, token_address, timeframes)
        
        logger.info(f"Client subscribed to {token_address} with timeframes {timeframes}")
    
    async def _replay_recent_messages(self, websocket: WebSocket, token_address: str, timeframes: List[str]):
        """Replay recent messages on subscription (for reconnection)"""
        for tf in timeframes:
            key = (token_address, tf)
            if key in self.message_history:
                messages = self.message_history[key][-10:]  # Last 10 messages
                for msg in messages:
                    try:
                        await self._send(websocket, msg)
                    except Exception:
                        # Client disconnected, stop replaying
                        return
    
    async def _handle_unsubscribe(self, websocket: WebSocket, payload: dict):
        """Handle unsubscription request"""
        token_address = payload.get("token")
        
        if not token_address:
            await self._send_error(websocket, "Missing token address")
            return
        
        # Remove from subscribers
        if token_address in self.token_subscribers:
            self.token_subscribers[token_address].discard(websocket)
        
        # Remove from candle subscribers
        for key in list(self.candle_subscribers.keys()):
            if key[0] == token_address:
                self.candle_subscribers[key].discard(websocket)
        
        # Remove from client tracking
        if token_address in self.connections.get(websocket, {}):
            del self.connections[websocket][token_address]
        
        await self._send(websocket, WSMessage(
            type=MessageType.STATUS.value,
            data={
                "status": "unsubscribed",
                "token": token_address,
            }
        ))
        
        logger.info(f"Client unsubscribed from {token_address}")
    
    async def _handle_get_candles(self, websocket: WebSocket, payload: dict):
        """Handle request for historical candles"""
        token_address = payload.get("token")
        timeframe = payload.get("timeframe", "1m")
        limit = min(payload.get("limit", 100), 500)
        
        if not token_address:
            await self._send_error(websocket, "Missing token address")
            return
        
        try:
            # Get candles from aggregator
            aggregator = await get_multi_aggregator()
            tf_ms = timeframe_string_to_ms(timeframe)
            candles = aggregator.get_candles(token_address, tf_ms)
            
            # Limit and format
            candles = candles[-limit:] if len(candles) > limit else candles
            
            await self._send(websocket, WSMessage(
                type=MessageType.CANDLES.value,
                data={
                    "token": token_address,
                    "timeframe": timeframe,
                    "candles": candles,
                }
            ))
        
        except Exception as e:
            logger.error(f"Error getting candles: {e}")
            await self._send_error(websocket, f"Failed to get candles: {e}")
    
    async def _handle_get_token_info(self, websocket: WebSocket, payload: dict):
        """Handle request for token info"""
        token_address = payload.get("token")
        
        if not token_address:
            await self._send_error(websocket, "Missing token address")
            return
        
        try:
            # Try to get from Redis cache
            if self._redis:
                info = await self._redis.get_cached_token_info(token_address)
                if info:
                    await self._send(websocket, WSMessage(
                        type=MessageType.TOKEN_INFO.value,
                        data=info
                    ))
                    return
            
            # Fallback: try to get from swap stream service
            swap_service = await get_swap_stream_service()
            info = swap_service.token_cache.get(token_address)
            
            if info:
                await self._send(websocket, WSMessage(
                    type=MessageType.TOKEN_INFO.value,
                    data={
                        "address": info.address,
                        "symbol": info.symbol,
                        "name": info.name,
                        "decimals": info.decimals,
                        "supply": info.supply,
                        "price_usd": info.price_usd,
                        "market_cap": info.market_cap,
                    }
                ))
            else:
                await self._send_error(websocket, "Token info not found")
        
        except Exception as e:
            logger.error(f"Error getting token info: {e}")
            await self._send_error(websocket, f"Failed to get token info: {e}")
    
    async def _subscribe_to_redis(self, token_address: str, timeframes: List[str]):
        """Subscribe to Redis channels for a token"""
        if not self._redis:
            return
        
        # Subscribe to swap events
        await self._redis.subscribe_swaps(
            token_address,
            lambda swap: asyncio.create_task(self._broadcast_swap(swap))
        )
        
        # Subscribe to candle events for each timeframe
        for tf in timeframes:
            await self._redis.subscribe_candles(
                token_address,
                tf,
                lambda candle, t=tf: asyncio.create_task(
                    self._broadcast_candle(token_address, t, candle)
                )
            )
    
    async def _broadcast_swap(self, swap: SwapEvent):
        """Broadcast a swap event to relevant subscribers"""
        subscribers = self.token_subscribers.get(swap.token_address, set())
        
        message = WSMessage(
            type=MessageType.TRADE.value,
            data={
                "token": swap.token_address,
                "signature": swap.signature,
                "side": swap.side,
                "amount_token": swap.amount_token,
                "amount_sol": swap.amount_sol,
                "price_usd": swap.price_usd,
                "market_cap_usd": swap.market_cap_usd,
                "trader": swap.trader,
                "source": swap.source,
                "timestamp": swap.timestamp,
            }
        )
        
        # Trade events are high priority
        await self._broadcast_to_set(subscribers, message, priority=MessagePriority.HIGH)
    
    async def _broadcast_candle(self, token_address: str, timeframe: str, candle: CandleUpdate):
        """Broadcast a candle update to relevant subscribers"""
        subscribers = self.candle_subscribers.get((token_address, timeframe), set())
        
        message = WSMessage(
            type=MessageType.CANDLE.value,
            data={
                "token": token_address,
                "timeframe": timeframe,
                "candle": {
                    "time": candle.time,
                    "open": candle.open,
                    "high": candle.high,
                    "low": candle.low,
                    "close": candle.close,
                    "volume": candle.volume,
                    "trades": candle.trades,
                    "is_closed": candle.is_closed,
                }
            }
        )
        
        # Candle updates are normal priority (can be dropped if needed)
        priority = MessagePriority.CRITICAL if candle.is_closed else MessagePriority.NORMAL
        await self._broadcast_to_set(subscribers, message, priority=priority)
    
    async def _broadcast_to_set(
        self, 
        subscribers: Set[WebSocket], 
        message: WSMessage,
        priority: MessagePriority = MessagePriority.NORMAL
    ):
        """Broadcast a message to a set of WebSockets"""
        disconnected = set()
        
        for ws in subscribers:
            try:
                await self._send(ws, message, priority=priority)
            except Exception:
                disconnected.add(ws)
        
        # Clean up disconnected clients
        for ws in disconnected:
            await self.disconnect(ws)
    
    async def _send(
        self, 
        websocket: WebSocket, 
        message: WSMessage,
        priority: MessagePriority = MessagePriority.NORMAL
    ):
        """Send a message to a WebSocket (with backpressure control)"""
        if websocket.client_state != WebSocketState.CONNECTED:
            return
        
        # Determine message type for priority
        message_type = message.type
        
        # Enqueue with backpressure control
        message_json = message.to_json()
        enqueued = await self._backpressure.enqueue(
            websocket,
            message_json,
            priority=priority,
            message_type=message_type
        )
        
        if not enqueued:
            logger.debug(f"Message dropped due to backpressure: {message_type}")
    
    async def _send_error(self, websocket: WebSocket, error: str):
        """Send an error message"""
        await self._send(websocket, WSMessage(
            type=MessageType.ERROR.value,
            data={"error": error}
        ))


# Singleton instance
_ws_manager: Optional[TradingWebSocketManager] = None


async def get_trading_ws_manager() -> TradingWebSocketManager:
    """Get or create the WebSocket manager singleton"""
    global _ws_manager
    
    if _ws_manager is None:
        _ws_manager = TradingWebSocketManager()
        await _ws_manager.initialize()
    
    return _ws_manager


async def close_trading_ws_manager():
    """Close the WebSocket manager"""
    global _ws_manager
    
    if _ws_manager:
        await _ws_manager.shutdown()
        _ws_manager = None


# FastAPI WebSocket route handler
async def trading_websocket_handler(websocket: WebSocket):
    """
    FastAPI WebSocket route handler.
    
    Usage in FastAPI:
    ```python
    from services.trading_websocket import trading_websocket_handler
    
    @app.websocket("/ws/trading")
    async def websocket_trading(websocket: WebSocket):
        await trading_websocket_handler(websocket)
    ```
    """
    manager = await get_trading_ws_manager()
    await manager.connect(websocket)
    
    try:
        while True:
            message = await websocket.receive_text()
            await manager.handle_message(websocket, message)
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket)



