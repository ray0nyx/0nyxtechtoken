"""
Real-time Pump.fun token streaming using PumpPortal WebSocket
"""
import asyncio
import json
import logging
import ssl
from datetime import datetime
from typing import Callable, Optional
import aiohttp
from collections import deque

logger = logging.getLogger(__name__)

# In-memory store for recent tokens (last 100)
recent_tokens = deque(maxlen=100)
token_subscribers = set()


class PumpPortalStreamer:
    """
    Connects to PumpPortal WebSocket for real-time Pump.fun token creation events.
    """
    WS_URL = "wss://pumpportal.fun/api/data"
    
    def __init__(self):
        self.ws = None
        self.is_connected = False
        self.reconnect_delay = 1
        self.max_reconnect_delay = 60
        self._running = False
    
    async def connect(self):
        """Connect to PumpPortal WebSocket"""
        self._running = True
        
        # Create SSL context that doesn't verify certificates
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        while self._running:
            try:
                print(f"📡 Attempting to connect to PumpPortal: {self.WS_URL}")
                logger.info(f"Connecting to PumpPortal WebSocket: {self.WS_URL}")
                
                connector = aiohttp.TCPConnector(ssl=ssl_context)
                
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.ws_connect(
                        self.WS_URL,
                        heartbeat=20,
                        timeout=aiohttp.ClientTimeout(total=None, sock_connect=10)
                    ) as ws:
                        self.ws = ws
                        self.is_connected = True
                        self.reconnect_delay = 1
                        print("✅ Connected to PumpPortal WebSocket!")
                        logger.info("Connected to PumpPortal WebSocket")
                        
                        # Subscribe to new token events
                        subscribe_msg = {
                            "method": "subscribeNewToken"
                        }
                        await ws.send_str(json.dumps(subscribe_msg))
                        print("📤 Subscribed to new token events")
                        logger.info("Subscribed to new token events")
                        
                        # Listen for messages
                        async for msg in ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                await self._handle_message(msg.data)
                            elif msg.type == aiohttp.WSMsgType.ERROR:
                                logger.error(f"WebSocket error: {ws.exception()}")
                                break
                            elif msg.type == aiohttp.WSMsgType.CLOSED:
                                logger.info("WebSocket closed")
                                break
                        
            except aiohttp.ClientError as e:
                logger.warning(f"PumpPortal WebSocket client error: {e}")
            except Exception as e:
                logger.error(f"PumpPortal WebSocket error: {e}")
            
            self.is_connected = False
            if self._running:
                logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
    
    async def _handle_message(self, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            
            # Check if it's a new token event
            if isinstance(data, dict):
                # PumpPortal sends token data directly
                token = self._parse_token(data)
                if token:
                    # Enrich with metadata (name, symbol, image) in background
                    try:
                        from services.token_metadata import enrich_token_metadata
                        token = await enrich_token_metadata(token)
                    except Exception as e:
                        logger.warning(f"Metadata enrichment failed: {e}")
                    
                    # Add to recent tokens
                    recent_tokens.appendleft(token)
                    logger.info(f"🆕 NEW TOKEN: {token.get('symbol') or token.get('name', 'UNKNOWN')} - {token.get('mint', '')[:12]}... | Subscribers: {len(token_subscribers)}")
                    
                    # Notify all subscribers
                    for callback in list(token_subscribers):
                        try:
                            if asyncio.iscoroutinefunction(callback):
                                await callback(token)
                            else:
                                callback(token)
                        except Exception as e:
                            logger.error(f"Subscriber callback error: {e}")
                            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse WebSocket message: {e}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    def _parse_token(self, data: dict) -> Optional[dict]:
        """Parse token data from PumpPortal format"""
        if not data:
            return None
            
        # PumpPortal token format - try multiple field names
        mint = data.get("mint") or data.get("token") or data.get("address")
        if not mint:
            return None
        
        # Extract image from multiple possible fields
        image_uri = (
            data.get("image") or 
            data.get("image_uri") or 
            data.get("imageUri") or
            data.get("logo") or
            data.get("logoUri") or
            ""
        )
        
        # Extract name/symbol with fallbacks
        name = data.get("name") or ""
        symbol = data.get("symbol") or ""
        
        # Log what we received from PumpPortal for debugging
        if name or image_uri:
            logger.debug(f"PumpPortal received: {symbol or 'UNKNOWN'} - name={name[:20] if name else 'None'}, image={image_uri[:30] if image_uri else 'None'}")
        else:
            logger.debug(f"PumpPortal received minimal data for {mint[:8]}...")
            
        return {
            "mint": mint,
            "name": name,
            "symbol": symbol,
            "image_uri": image_uri,
            "uri": data.get("uri") or data.get("metadataUri") or data.get("metadata_uri"),
            "twitter": data.get("twitter"),
            "telegram": data.get("telegram"),
            "website": data.get("website"),
            "bonding_curve": data.get("bondingCurve") or data.get("bonding_curve"),
            "creator": data.get("traderPublicKey") or data.get("creator"),
            "created_timestamp": int(datetime.now().timestamp() * 1000),
            "complete": False,
            "raydium_pool": None,
            "usd_market_cap": data.get("marketCapSol", 0) * 200 if data.get("marketCapSol") else 0,  # Rough SOL to USD
            "virtual_sol_reserves": data.get("vSolInBondingCurve"),
            "virtual_token_reserves": data.get("vTokensInBondingCurve"),
            "source": "pumpportal_realtime"
        }
    
    async def stop(self):
        """Stop the WebSocket connection"""
        self._running = False
        if self.ws:
            await self.ws.close()


# Global streamer instance
_streamer: Optional[PumpPortalStreamer] = None


async def start_pump_portal_stream():
    """Start the global PumpPortal WebSocket stream"""
    global _streamer
    if _streamer is None:
        print("🚀 Starting PumpPortal WebSocket stream...")
        _streamer = PumpPortalStreamer()
        asyncio.create_task(_streamer.connect())
        logger.info("Started PumpPortal real-time stream")
        print("✅ PumpPortal stream task created")


def get_recent_tokens(limit: int = 50) -> list:
    """Get recently created tokens from the in-memory store"""
    return list(recent_tokens)[:limit]


def subscribe_to_tokens(callback: Callable):
    """Subscribe to new token events"""
    token_subscribers.add(callback)
    

def unsubscribe_from_tokens(callback: Callable):
    """Unsubscribe from new token events"""
    token_subscribers.discard(callback)


def is_stream_connected() -> bool:
    """Check if the WebSocket stream is connected"""
    return _streamer is not None and _streamer.is_connected
