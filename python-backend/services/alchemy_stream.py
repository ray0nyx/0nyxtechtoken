"""
Real-time Pump.fun token detection using Alchemy WebSocket (Solana logsSubscribe).
Monitors the Pump.fun program for new token creation events.
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Callable, Optional, Set
from collections import deque
import aiohttp

logger = logging.getLogger(__name__)

# Pump.fun Program ID
PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"

# In-memory store for recent tokens
recent_tokens = deque(maxlen=100)
token_subscribers: Set[Callable] = set()


class AlchemySolanaStream:
    """
    Connects to Alchemy Solana WebSocket for real-time Pump.fun token detection.
    Uses logsSubscribe to monitor the Pump.fun program.
    """
    
    def __init__(self, rpc_url: str = None, api_key: str = None):
        self.rpc_url = rpc_url or os.getenv("ALCHEMY_RPC_URL", "")
        self.api_key = api_key or os.getenv("ALCHEMY_API_KEY", "")
        
        # Convert HTTP URL to WebSocket URL
        # Convert HTTP URL to WebSocket URL
        if self.rpc_url:
            self.ws_url = self.rpc_url.replace("https://", "wss://").replace("http://", "ws://")
        elif self.api_key:
            self.ws_url = f"wss://solana-mainnet.g.alchemy.com/v2/{self.api_key}"
        else:
            self.ws_url = ""
            logger.warning("No Alchemy RPC URL or API Key provided.")
        
        self.ws = None
        self.is_connected = False
        self.reconnect_delay = 1
        self.max_reconnect_delay = 60
        self._running = False
        self.subscription_id = None
        self._seen_signatures: Set[str] = set()
        
    async def connect(self):
        """Connect to Alchemy WebSocket and subscribe to Pump.fun logs"""
        import ssl
        
        self._running = True
        
        # Create SSL context that doesn't verify certificates (for development)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        while self._running:
            try:
                logger.info(f"Connecting to Alchemy Solana WebSocket...")
                
                connector = aiohttp.TCPConnector(ssl=ssl_context)
                
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.ws_connect(
                        self.ws_url,
                        heartbeat=30,
                        timeout=aiohttp.ClientTimeout(total=None, sock_connect=10)
                    ) as ws:
                        self.ws = ws
                        self.is_connected = True
                        self.reconnect_delay = 1
                        logger.info("Connected to Alchemy Solana WebSocket")
                        
                        # Subscribe to Pump.fun program logs
                        await self._subscribe_to_pump_fun_logs()
                        
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
                                
            except asyncio.CancelledError:
                logger.info("Alchemy stream cancelled")
                break
            except Exception as e:
                logger.error(f"Alchemy WebSocket error: {e}")
            
            self.is_connected = False
            if self._running:
                logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
    
    async def _subscribe_to_pump_fun_logs(self):
        """Subscribe to Pump.fun program logs"""
        subscribe_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "logsSubscribe",
            "params": [
                {"mentions": [PUMP_FUN_PROGRAM_ID]},
                {"commitment": "confirmed"}
            ]
        }
        
        await self.ws.send_str(json.dumps(subscribe_msg))
        logger.info(f"Subscribed to Pump.fun program logs: {PUMP_FUN_PROGRAM_ID}")
    
    async def _handle_message(self, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            
            # Check for subscription confirmation
            if "result" in data and isinstance(data["result"], int):
                self.subscription_id = data["result"]
                logger.info(f"Subscription confirmed with ID: {self.subscription_id}")
                return
            
            # Check for log notification
            if data.get("method") == "logsNotification":
                logger.info("Received logsNotification from Alchemy")
                await self._process_log_notification(data.get("params", {}))
                
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse WebSocket message: {e}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    async def _process_log_notification(self, params: dict):
        """Process a log notification from Pump.fun program"""
        result = params.get("result", {})
        value = result.get("value", {})
        
        signature = value.get("signature", "")
        logs = value.get("logs", [])
        
        # Skip if we've already processed this signature
        if signature in self._seen_signatures:
            return
        self._seen_signatures.add(signature)
        
        # Keep seen signatures bounded
        if len(self._seen_signatures) > 1000:
            self._seen_signatures = set(list(self._seen_signatures)[-500:])
        
        # Check for token creation patterns in logs
        is_token_creation = any(
            "Program log: Instruction: Create" in log or
            "Program log: Instruction: Initialize" in log or
            "CreateToken" in log or
            "create" in log.lower() and "token" in log.lower()
            for log in logs
        )
        
        if is_token_creation:
            # Extract token info from logs
            token = await self._extract_token_from_logs(signature, logs)
            if token:
                # Add to recent tokens
                recent_tokens.appendleft(token)
                logger.info(f"New Pump.fun token detected: {token.get('mint', '')[:16]}...")
                
                # Notify subscribers
                for callback in list(token_subscribers):
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(token)
                        else:
                            callback(token)
                    except Exception as e:
                        logger.error(f"Subscriber callback error: {e}")
    
    async def _extract_token_from_logs(self, signature: str, logs: list) -> Optional[dict]:
        """Extract token information from transaction logs"""
        # Try to find mint address in logs
        mint_address = None
        
        for log in logs:
            # Look for mint address patterns
            if "mint:" in log.lower():
                parts = log.split()
                for i, part in enumerate(parts):
                    if "mint" in part.lower() and i + 1 < len(parts):
                        mint_address = parts[i + 1].strip(",:;")
                        break
            
            # Look for pubkey patterns (44 character base58)
            import re
            matches = re.findall(r'[1-9A-HJ-NP-Za-km-z]{43,44}', log)
            for match in matches:
                if match.endswith("pump"):  # Pump.fun tokens end with 'pump'
                    mint_address = match
                    break
            
            if mint_address:
                break
        
        if not mint_address:
            # If no mint found in logs, fetch transaction details
            mint_address = await self._fetch_mint_from_transaction(signature)
        
        if mint_address:
            return {
                "mint": mint_address,
                "name": "",  # Will be fetched separately
                "symbol": mint_address[-8:-4].upper() if len(mint_address) > 8 else "???",
                "image_uri": None,
                "twitter": None,
                "telegram": None,
                "website": None,
                "bonding_curve": None,
                "creator": None,
                "created_timestamp": int(datetime.now().timestamp() * 1000),
                "complete": False,
                "raydium_pool": None,
                "usd_market_cap": 0,
                "source": "alchemy_realtime",
                "signature": signature
            }
        
        return None
    
    async def _fetch_mint_from_transaction(self, signature: str) -> Optional[str]:
        """Fetch mint address from transaction details via RPC"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getTransaction",
                    "params": [
                        signature,
                        {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                    ]
                }
                
                http_url = self.ws_url.replace("wss://", "https://").replace("ws://", "http://")
                
                async with session.post(http_url, json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        result = data.get("result", {})
                        
                        # Look for mint in account keys or instructions
                        if result:
                            meta = result.get("meta", {})
                            tx = result.get("transaction", {})
                            
                            # Check post token balances
                            for balance in meta.get("postTokenBalances", []):
                                mint = balance.get("mint", "")
                                if mint.endswith("pump"):
                                    return mint
                            
                            # Check account keys
                            message = tx.get("message", {})
                            for key in message.get("accountKeys", []):
                                if isinstance(key, dict):
                                    pubkey = key.get("pubkey", "")
                                else:
                                    pubkey = str(key)
                                if pubkey.endswith("pump"):
                                    return pubkey
                                    
        except Exception as e:
            logger.warning(f"Failed to fetch transaction details: {e}")
        
        return None
    
    async def stop(self):
        """Stop the WebSocket connection"""
        self._running = False
        if self.ws:
            await self.ws.close()


# Global streamer instance
_alchemy_stream: Optional[AlchemySolanaStream] = None


async def start_alchemy_stream():
    """Start the global Alchemy Solana stream"""
    global _alchemy_stream
    
    # Check for credentials
    rpc_url = os.getenv("ALCHEMY_RPC_URL", "")
    api_key = os.getenv("ALCHEMY_API_KEY", "")
    
    if not rpc_url and not api_key:
        logger.warning("No Alchemy credentials found. Skipping real-time stream.")
        return
    
    if _alchemy_stream is None:
        _alchemy_stream = AlchemySolanaStream(rpc_url, api_key)
        asyncio.create_task(_alchemy_stream.connect())
        logger.info("Started Alchemy real-time Pump.fun stream")


def get_recent_tokens(limit: int = 50) -> list:
    """Get recently detected tokens from the in-memory store"""
    return list(recent_tokens)[:limit]


def subscribe_to_tokens(callback: Callable):
    """Subscribe to new token events"""
    token_subscribers.add(callback)
    

def unsubscribe_from_tokens(callback: Callable):
    """Unsubscribe from new token events"""
    token_subscribers.discard(callback)


def is_stream_connected() -> bool:
    """Check if the Alchemy stream is connected"""
    return _alchemy_stream is not None and _alchemy_stream.is_connected
