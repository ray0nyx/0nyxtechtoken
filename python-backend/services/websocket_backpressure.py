"""
WebSocket Backpressure Control

Implements backpressure control for WebSocket connections to prevent:
- Message queue overflow
- Memory exhaustion
- Client disconnections due to slow processing

Features:
- Per-client message queues with size limits
- Automatic message dropping when queue is full
- Priority-based message handling
- Connection health monitoring
"""

import asyncio
import logging
from typing import Dict, Optional, Deque
from collections import deque
from dataclasses import dataclass
from enum import IntEnum
from datetime import datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MessagePriority(IntEnum):
    """Message priority levels (higher = more important)"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class QueuedMessage:
    """Message in the send queue"""
    data: str
    priority: MessagePriority
    timestamp: float
    message_type: str


class BackpressureController:
    """
    Controls backpressure for WebSocket connections.
    
    Strategy:
    - Maintain per-client message queues
    - Drop low-priority messages when queue is full
    - Monitor connection health
    - Throttle sends based on client processing speed
    """
    
    def __init__(
        self,
        max_queue_size: int = 100,
        max_queue_bytes: int = 10 * 1024 * 1024,  # 10MB
        drop_threshold: float = 0.8,  # Start dropping at 80% capacity
    ):
        self.max_queue_size = max_queue_size
        self.max_queue_bytes = max_queue_bytes
        self.drop_threshold = drop_threshold
        
        # Per-client queues
        self.queues: Dict[WebSocket, Deque[QueuedMessage]] = {}
        self.queue_bytes: Dict[WebSocket, int] = {}
        self.send_tasks: Dict[WebSocket, asyncio.Task] = {}
        self.last_send_time: Dict[WebSocket, float] = {}
        self.send_rate: Dict[WebSocket, float] = {}  # messages per second
        
        # Health monitoring
        self.health_scores: Dict[WebSocket, float] = {}  # 0.0-1.0
        self.consecutive_drops: Dict[WebSocket, int] = {}
    
    def register_client(self, websocket: WebSocket):
        """Register a new WebSocket client"""
        self.queues[websocket] = deque(maxlen=self.max_queue_size)
        self.queue_bytes[websocket] = 0
        self.health_scores[websocket] = 1.0
        self.consecutive_drops[websocket] = 0
        self.last_send_time[websocket] = datetime.now().timestamp()
        self.send_rate[websocket] = 0.0
        
        # Start send task
        self.send_tasks[websocket] = asyncio.create_task(
            self._send_loop(websocket)
        )
    
    def unregister_client(self, websocket: WebSocket):
        """Unregister a WebSocket client"""
        if websocket in self.queues:
            del self.queues[websocket]
        if websocket in self.queue_bytes:
            del self.queue_bytes[websocket]
        if websocket in self.health_scores:
            del self.health_scores[websocket]
        if websocket in self.consecutive_drops:
            del self.consecutive_drops[websocket]
        if websocket in self.last_send_time:
            del self.last_send_time[websocket]
        if websocket in self.send_rate:
            del self.send_rate[websocket]
        
        # Cancel send task
        if websocket in self.send_tasks:
            task = self.send_tasks[websocket]
            task.cancel()
            del self.send_tasks[websocket]
    
    async def enqueue(
        self,
        websocket: WebSocket,
        message: str,
        priority: MessagePriority = MessagePriority.NORMAL,
        message_type: str = "unknown"
    ) -> bool:
        """
        Enqueue a message for sending.
        
        Returns True if enqueued, False if dropped.
        """
        if websocket not in self.queues:
            return False
        
        queue = self.queues[websocket]
        message_bytes = len(message.encode('utf-8'))
        current_bytes = self.queue_bytes.get(websocket, 0)
        
        # Check if we need to drop messages
        queue_size = len(queue)
        queue_fullness = queue_size / self.max_queue_size
        
        if queue_fullness >= self.drop_threshold:
            # Drop low-priority messages
            if priority < MessagePriority.HIGH:
                self.consecutive_drops[websocket] = self.consecutive_drops.get(websocket, 0) + 1
                logger.debug(
                    f"Dropping {message_type} message (priority {priority.name}, "
                    f"queue {queue_size}/{self.max_queue_size})"
                )
                return False
            
            # For high-priority, try to make room
            self._make_room_for_priority(websocket, priority)
        
        # Check byte limit
        if current_bytes + message_bytes > self.max_queue_bytes:
            if priority < MessagePriority.CRITICAL:
                self.consecutive_drops[websocket] = self.consecutive_drops.get(websocket, 0) + 1
                return False
            # For critical, drop oldest low-priority
            self._make_room_for_bytes(websocket, message_bytes)
        
        # Add message (insert by priority)
        queued = QueuedMessage(
            data=message,
            priority=priority,
            timestamp=datetime.now().timestamp(),
            message_type=message_type
        )
        
        # Insert in priority order (higher priority first)
        inserted = False
        for i, existing in enumerate(queue):
            if priority > existing.priority:
                queue.insert(i, queued)
                inserted = True
                break
        
        if not inserted:
            queue.append(queued)
        
        self.queue_bytes[websocket] = current_bytes + message_bytes
        
        # Reset drop counter on successful enqueue
        if self.consecutive_drops.get(websocket, 0) > 0:
            self.consecutive_drops[websocket] = 0
        
        return True
    
    def _make_room_for_priority(self, websocket: WebSocket, priority: MessagePriority):
        """Remove low-priority messages to make room"""
        queue = self.queues.get(websocket)
        if not queue:
            return
        
        removed = 0
        for msg in list(queue):
            if msg.priority < priority:
                queue.remove(msg)
                self.queue_bytes[websocket] -= len(msg.data.encode('utf-8'))
                removed += 1
                if len(queue) < self.max_queue_size * 0.5:
                    break
        
        if removed > 0:
            logger.debug(f"Removed {removed} low-priority messages for {websocket}")
    
    def _make_room_for_bytes(self, websocket: WebSocket, needed_bytes: int):
        """Remove oldest messages to make room for bytes"""
        queue = self.queues.get(websocket)
        if not queue:
            return
        
        removed_bytes = 0
        while queue and removed_bytes < needed_bytes:
            msg = queue.popleft()
            msg_bytes = len(msg.data.encode('utf-8'))
            self.queue_bytes[websocket] -= msg_bytes
            removed_bytes += msg_bytes
    
    async def _send_loop(self, websocket: WebSocket):
        """Main send loop for a client"""
        queue = self.queues.get(websocket)
        if not queue:
            return
        
        min_send_interval = 0.01  # 10ms minimum between sends
        last_send = datetime.now().timestamp()
        
        while websocket in self.queues:
            try:
                if not queue:
                    await asyncio.sleep(0.01)
                    continue
                
                # Get next message
                msg = queue.popleft()
                msg_bytes = len(msg.data.encode('utf-8'))
                self.queue_bytes[websocket] -= msg_bytes
                
                # Throttle based on send rate
                current_time = datetime.now().timestamp()
                time_since_last = current_time - last_send
                
                if time_since_last < min_send_interval:
                    await asyncio.sleep(min_send_interval - time_since_last)
                
                # Send message
                try:
                    await websocket.send_text(msg.data)
                    last_send = datetime.now().timestamp()
                    
                    # Update send rate
                    if websocket in self.last_send_time:
                        elapsed = last_send - self.last_send_time[websocket]
                        if elapsed > 0:
                            self.send_rate[websocket] = 1.0 / elapsed
                        self.last_send_time[websocket] = last_send
                    
                    # Update health score (successful send improves health)
                    if websocket in self.health_scores:
                        self.health_scores[websocket] = min(
                            1.0,
                            self.health_scores[websocket] + 0.01
                        )
                
                except Exception as e:
                    logger.error(f"Failed to send message to {websocket}: {e}")
                    # Failed send decreases health
                    if websocket in self.health_scores:
                        self.health_scores[websocket] = max(
                            0.0,
                            self.health_scores[websocket] - 0.1
                        )
                    
                    # If health is too low, disconnect
                    if self.health_scores.get(websocket, 1.0) < 0.1:
                        logger.warning(f"Client {websocket} health too low, disconnecting")
                        break
                
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.001)  # 1ms
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in send loop: {e}")
                await asyncio.sleep(0.1)
    
    def get_queue_stats(self, websocket: WebSocket) -> Optional[Dict]:
        """Get queue statistics for a client"""
        if websocket not in self.queues:
            return None
        
        queue = self.queues[websocket]
        return {
            "queue_size": len(queue),
            "queue_bytes": self.queue_bytes.get(websocket, 0),
            "max_queue_size": self.max_queue_size,
            "max_queue_bytes": self.max_queue_bytes,
            "health_score": self.health_scores.get(websocket, 1.0),
            "send_rate": self.send_rate.get(websocket, 0.0),
            "consecutive_drops": self.consecutive_drops.get(websocket, 0),
        }


# Global instance
_backpressure_controller: Optional[BackpressureController] = None


def get_backpressure_controller() -> BackpressureController:
    """Get or create the backpressure controller singleton"""
    global _backpressure_controller
    
    if _backpressure_controller is None:
        _backpressure_controller = BackpressureController()
    
    return _backpressure_controller

