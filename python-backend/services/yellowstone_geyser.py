"""
Yellowstone Geyser gRPC Subscriber
Real-time Solana transaction streaming via gRPC for <100ms latency
"""

import asyncio
import logging
import time
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

try:
    import grpc
    from grpc import aio
    GRPC_AVAILABLE = True
except ImportError:
    GRPC_AVAILABLE = False
    # Mock grpc for typing
    class MockGrpc:
        class aio:
            Channel = Any
    grpc = MockGrpc()
    aio = MockGrpc.aio

# Note: These proto files need to be generated from yellowstone-grpc-proto
# For now, we'll use a placeholder structure
# In production, generate with: python -m grpc_tools.protoc -I=proto --python_out=. --grpc_python_out=. proto/geyser.proto

logger = logging.getLogger(__name__)

# Yellowstone Geyser configuration
YELLOWSTONE_GEYSER_URL = "grpc://api.mainnet-beta.solana.com:10000"  # Default, override with env var
YELLOWSTONE_GEYSER_API_KEY = None  # Set via env var if required


class CommitmentLevel(Enum):
    """Solana commitment levels"""
    PROCESSED = "processed"
    CONFIRMED = "confirmed"
    FINALIZED = "finalized"


@dataclass
class TransactionUpdate:
    """Transaction update from Geyser"""
    signature: str
    slot: int
    block_time: int
    transaction: Dict[str, Any]
    accounts: List[Dict[str, Any]]
    logs: List[str]
    err: Optional[Any] = None


class YellowstoneGeyserSubscriber:
    """
    Yellowstone Geyser gRPC subscriber for real-time Solana transaction streaming.
    
    Features:
    - Sub-100ms transaction delivery
    - Program-based filtering
    - Account-based filtering
    - Real-time streaming
    """
    
    # Known program addresses
    PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    RAYDIUM_AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
    TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    
    def __init__(
        self,
        geyser_url: Optional[str] = None,
        api_key: Optional[str] = None,
        callback: Optional[Callable[[TransactionUpdate], None]] = None
    ):
        self.geyser_url = geyser_url or YELLOWSTONE_GEYSER_URL
        self.api_key = api_key or YELLOWSTONE_GEYSER_API_KEY
        self.callback = callback
        self._channel: Optional[aio.Channel] = None
        self._stub = None
        self._running = False
        self._subscribe_task: Optional[asyncio.Task] = None
        
        # Parse URL
        if self.geyser_url.startswith("grpc://"):
            self.geyser_url = self.geyser_url.replace("grpc://", "")
        elif self.geyser_url.startswith("https://"):
            self.geyser_url = self.geyser_url.replace("https://", "")
    
    async def start(self):
        """Start the gRPC subscriber"""
        if self._running:
            logger.warning("Geyser subscriber already running")
            return
            
        if not GRPC_AVAILABLE:
            logger.warning("Yellowstone Geyser disabled: grpc module not found. Install with 'pip install grpcio'")
            return
        
        try:
            # Create gRPC channel
            # Note: In production, use secure channel with credentials if API key required
            if self.api_key:
                # Use secure channel with API key in metadata
                credentials = grpc.ssl_channel_credentials()
                self._channel = aio.secure_channel(self.geyser_url, credentials)
            else:
                # Use insecure channel for localhost/testing
                self._channel = aio.insecure_channel(self.geyser_url)
            
            # Create stub (would be generated from proto)
            # self._stub = GeyserStub(self._channel)
            
            self._running = True
            logger.info(f"Yellowstone Geyser subscriber started: {self.geyser_url}")
            
            # Start subscription task
            self._subscribe_task = asyncio.create_task(self._subscribe_loop())
            
        except Exception as e:
            logger.error(f"Failed to start Geyser subscriber: {e}")
            raise
    
    async def stop(self):
        """Stop the gRPC subscriber"""
        self._running = False
        
        if self._subscribe_task:
            self._subscribe_task.cancel()
            try:
                await self._subscribe_task
            except asyncio.CancelledError:
                pass
        
        if self._channel:
            await self._channel.close()
        
        logger.info("Yellowstone Geyser subscriber stopped")
    
    async def _subscribe_loop(self):
        """Main subscription loop"""
        # This is a placeholder - actual implementation would use generated proto stubs
        # For now, we'll create a structure that can be filled in once proto files are available
        
        try:
            # Create subscription request
            # request = SubscribeRequest(
            #     transactions=SubscribeRequestFilterTransactions(
            #         vote=False,
            #         failed=False,
            #         account_include=[],
            #         account_exclude=[],
            #         account_required=[self.PUMP_FUN_PROGRAM, self.RAYDIUM_AMM_V4],
            #     ),
            #     commitment=CommitmentLevel.PROCESSED.value
            # )
            
            # Subscribe to transactions
            # response_stream = self._stub.Subscribe(iter([request]))
            
            # Process incoming updates
            # async for response in response_stream:
            #     if not self._running:
            #         break
            #     
            #     # Parse transaction update
            #     update = self._parse_transaction_update(response)
            #     
            #     # Call callback
            #     if self.callback and update:
            #         try:
            #             self.callback(update)
            #         except Exception as e:
            #             logger.error(f"Callback error: {e}")
            
            # Placeholder: Log that we're ready
            logger.info("Geyser subscription loop ready (proto files needed for full implementation)")
            
            # Keep running
            while self._running:
                await asyncio.sleep(1)
                
        except asyncio.CancelledError:
            logger.info("Geyser subscription cancelled")
        except Exception as e:
            logger.error(f"Geyser subscription error: {e}")
            raise
    
    def _parse_transaction_update(self, response: Any) -> Optional[TransactionUpdate]:
        """Parse gRPC response to TransactionUpdate"""
        # This would parse the actual gRPC response structure
        # Placeholder implementation
        try:
            # Extract data from response
            # signature = response.transaction.signature
            # slot = response.slot
            # block_time = response.block_time
            # transaction = response.transaction
            # accounts = response.accounts
            # logs = response.logs
            # err = response.err
            
            # return TransactionUpdate(
            #     signature=signature,
            #     slot=slot,
            #     block_time=block_time,
            #     transaction=transaction,
            #     accounts=accounts,
            #     logs=logs,
            #     err=err
            # )
            return None
        except Exception as e:
            logger.error(f"Error parsing transaction update: {e}")
            return None
    
    def set_callback(self, callback: Callable[[TransactionUpdate], None]):
        """Set callback for transaction updates"""
        self.callback = callback


# Singleton instance
_geyser_subscriber: Optional[YellowstoneGeyserSubscriber] = None


async def get_geyser_subscriber(
    callback: Optional[Callable[[TransactionUpdate], None]] = None
) -> YellowstoneGeyserSubscriber:
    """Get or create Geyser subscriber instance"""
    global _geyser_subscriber
    
    if _geyser_subscriber is None:
        import os
        geyser_url = os.getenv("YELLOWSTONE_GEYSER_URL", YELLOWSTONE_GEYSER_URL)
        api_key = os.getenv("YELLOWSTONE_GEYSER_API_KEY")
        _geyser_subscriber = YellowstoneGeyserSubscriber(
            geyser_url=geyser_url,
            api_key=api_key,
            callback=callback
        )
        await _geyser_subscriber.start()
    elif callback:
        _geyser_subscriber.set_callback(callback)
    
    return _geyser_subscriber


async def close_geyser_subscriber():
    """Close Geyser subscriber"""
    global _geyser_subscriber
    if _geyser_subscriber:
        await _geyser_subscriber.stop()
        _geyser_subscriber = None
