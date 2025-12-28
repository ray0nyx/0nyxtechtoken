"""
Real-Time Trade Replication Engine
Sub-100ms latency trade replication across multiple platforms
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import heapq

from universal_platform_adapters import (
    UniversalPlatformManager, TradeSignal, ExecutionResult, 
    OrderType, OrderSide, create_platform_adapter
)

logger = logging.getLogger(__name__)

class ReplicationStatus(Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"

class ReplicationPriority(Enum):
    HIGH = 1
    NORMAL = 2
    LOW = 3

@dataclass
class ReplicationTask:
    """Task for replicating a trade"""
    id: str
    master_trade_id: str
    follower_relationship_id: str
    signal: TradeSignal
    target_platforms: List[str]
    priority: ReplicationPriority = ReplicationPriority.NORMAL
    max_retries: int = 3
    timeout_seconds: int = 30
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: ReplicationStatus = ReplicationStatus.PENDING
    retry_count: int = 0
    error_message: Optional[str] = None
    results: Dict[str, ExecutionResult] = field(default_factory=dict)

@dataclass
class ReplicationMetrics:
    """Metrics for replication performance"""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    average_latency_ms: float = 0.0
    success_rate: float = 0.0
    platform_performance: Dict[str, Dict[str, float]] = field(default_factory=dict)

class ReplicationQueue:
    """Priority queue for replication tasks"""
    
    def __init__(self):
        self._queue = []
        self._task_map = {}
        self._lock = asyncio.Lock()
    
    async def put(self, task: ReplicationTask):
        """Add task to queue"""
        async with self._lock:
            priority = task.priority.value
            heapq.heappush(self._queue, (priority, task.created_at, task))
            self._task_map[task.id] = task
    
    async def get(self) -> Optional[ReplicationTask]:
        """Get next task from queue"""
        async with self._lock:
            if not self._queue:
                return None
            
            _, _, task = heapq.heappop(self._queue)
            if task.id in self._task_map:
                del self._task_map[task.id]
            return task
    
    async def remove(self, task_id: str) -> bool:
        """Remove task from queue"""
        async with self._lock:
            if task_id in self._task_map:
                task = self._task_map[task_id]
                # Mark as cancelled
                task.status = ReplicationStatus.CANCELLED
                del self._task_map[task_id]
                return True
            return False
    
    async def size(self) -> int:
        """Get queue size"""
        async with self._lock:
            return len(self._queue)

class LatencyOptimizer:
    """Optimizes replication latency using various strategies"""
    
    def __init__(self):
        self.platform_latencies = defaultdict(list)
        self.platform_success_rates = defaultdict(list)
        self.symbol_latencies = defaultdict(list)
        self.time_of_day_latencies = defaultdict(list)
    
    def record_latency(self, platform: str, symbol: str, latency_ms: float, success: bool):
        """Record latency data for optimization"""
        self.platform_latencies[platform].append(latency_ms)
        self.platform_success_rates[platform].append(1.0 if success else 0.0)
        self.symbol_latencies[symbol].append(latency_ms)
        
        # Record time-of-day latency
        hour = datetime.now().hour
        self.time_of_day_latencies[hour].append(latency_ms)
        
        # Keep only recent data (last 1000 records per category)
        for latency_list in [self.platform_latencies[platform], 
                           self.symbol_latencies[symbol], 
                           self.time_of_day_latencies[hour]]:
            if len(latency_list) > 1000:
                latency_list.pop(0)
    
    def get_optimal_platforms(self, symbol: str, available_platforms: List[str]) -> List[str]:
        """Get platforms ordered by expected latency"""
        platform_scores = {}
        
        for platform in available_platforms:
            # Calculate score based on historical performance
            avg_latency = np.mean(self.platform_latencies[platform]) if self.platform_latencies[platform] else 1000
            success_rate = np.mean(self.platform_success_rates[platform]) if self.platform_success_rates[platform] else 0.5
            
            # Symbol-specific latency
            symbol_latency = np.mean(self.symbol_latencies[symbol]) if self.symbol_latencies[symbol] else avg_latency
            
            # Time-of-day adjustment
            current_hour = datetime.now().hour
            tod_latency = np.mean(self.time_of_day_latencies[current_hour]) if self.time_of_day_latencies[current_hour] else avg_latency
            
            # Combined score (lower is better)
            score = (avg_latency * 0.4 + symbol_latency * 0.3 + tod_latency * 0.3) / success_rate
            platform_scores[platform] = score
        
        # Sort by score and return top platforms
        sorted_platforms = sorted(platform_scores.items(), key=lambda x: x[1])
        return [platform for platform, _ in sorted_platforms]

class CircuitBreaker:
    """Circuit breaker for platform failures"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_counts = defaultdict(int)
        self.last_failure_times = {}
        self.circuit_states = defaultdict(lambda: "CLOSED")  # CLOSED, OPEN, HALF_OPEN
    
    def can_execute(self, platform: str) -> bool:
        """Check if platform can execute trades"""
        state = self.circuit_states[platform]
        
        if state == "CLOSED":
            return True
        elif state == "OPEN":
            # Check if recovery timeout has passed
            if platform in self.last_failure_times:
                time_since_failure = time.time() - self.last_failure_times[platform]
                if time_since_failure > self.recovery_timeout:
                    self.circuit_states[platform] = "HALF_OPEN"
                    return True
            return False
        elif state == "HALF_OPEN":
            return True
        
        return False
    
    def record_success(self, platform: str):
        """Record successful execution"""
        self.failure_counts[platform] = 0
        self.circuit_states[platform] = "CLOSED"
    
    def record_failure(self, platform: str):
        """Record failed execution"""
        self.failure_counts[platform] += 1
        self.last_failure_times[platform] = time.time()
        
        if self.failure_counts[platform] >= self.failure_threshold:
            self.circuit_states[platform] = "OPEN"
            logger.warning(f"Circuit breaker opened for platform {platform}")

class RealTimeReplicationEngine:
    """Main replication engine with sub-100ms latency"""
    
    def __init__(self, platform_manager: UniversalPlatformManager, db_session=None):
        self.platform_manager = platform_manager
        self.db_session = db_session
        self.replication_queue = ReplicationQueue()
        self.latency_optimizer = LatencyOptimizer()
        self.circuit_breaker = CircuitBreaker()
        
        # Worker configuration
        self.max_workers = 10
        self.workers = []
        self.is_running = False
        
        # Metrics
        self.metrics = ReplicationMetrics()
        self.latency_history = deque(maxlen=1000)
        
        # Callbacks
        self.on_task_completed: Optional[Callable] = None
        self.on_task_failed: Optional[Callable] = None
        
        logger.info("Real-time replication engine initialized")
    
    async def start(self):
        """Start the replication engine"""
        if self.is_running:
            logger.warning("Replication engine already running")
            return
        
        self.is_running = True
        
        # Start worker tasks
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        
        logger.info(f"Started replication engine with {self.max_workers} workers")
    
    async def stop(self):
        """Stop the replication engine"""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to complete
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        
        logger.info("Replication engine stopped")
    
    async def replicate_trade(
        self,
        master_trade_id: str,
        follower_relationship_id: str,
        signal: TradeSignal,
        target_platforms: List[str],
        priority: ReplicationPriority = ReplicationPriority.NORMAL
    ) -> str:
        """Queue a trade for replication"""
        task_id = str(uuid.uuid4())
        
        task = ReplicationTask(
            id=task_id,
            master_trade_id=master_trade_id,
            follower_relationship_id=follower_relationship_id,
            signal=signal,
            target_platforms=target_platforms,
            priority=priority
        )
        
        await self.replication_queue.put(task)
        logger.info(f"Queued replication task {task_id} for {len(target_platforms)} platforms")
        
        return task_id
    
    async def _worker(self, worker_name: str):
        """Worker task for processing replication queue"""
        logger.info(f"Started worker {worker_name}")
        
        while self.is_running:
            try:
                # Get next task from queue
                task = await self.replication_queue.get()
                if task is None:
                    await asyncio.sleep(0.001)  # Small delay if queue is empty
                    continue
                
                # Process the task
                await self._process_task(task)
                
            except asyncio.CancelledError:
                logger.info(f"Worker {worker_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Error in worker {worker_name}: {e}", exc_info=True)
                await asyncio.sleep(0.1)  # Brief pause on error
        
        logger.info(f"Worker {worker_name} stopped")
    
    async def _process_task(self, task: ReplicationTask):
        """Process a single replication task"""
        task.status = ReplicationStatus.EXECUTING
        task.started_at = datetime.now()
        
        try:
            # Filter platforms based on circuit breaker
            available_platforms = [
                platform for platform in task.target_platforms
                if self.circuit_breaker.can_execute(platform)
            ]
            
            if not available_platforms:
                raise Exception("No available platforms (circuit breaker)")
            
            # Optimize platform order for latency
            optimized_platforms = self.latency_optimizer.get_optimal_platforms(
                task.signal.symbol, available_platforms
            )
            
            # Execute trades in parallel with timeout
            start_time = time.time()
            
            execution_tasks = []
            for platform in optimized_platforms:
                exec_task = asyncio.create_task(
                    self._execute_on_platform(task, platform)
                )
                execution_tasks.append((platform, exec_task))
            
            # Wait for all executions with timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(*[task for _, task in execution_tasks], return_exceptions=True),
                    timeout=task.timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.warning(f"Task {task.id} timed out after {task.timeout_seconds}s")
                # Cancel remaining tasks
                for _, exec_task in execution_tasks:
                    if not exec_task.done():
                        exec_task.cancel()
            
            # Collect results
            for platform, exec_task in execution_tasks:
                try:
                    if not exec_task.cancelled():
                        result = await exec_task
                        task.results[platform] = result
                        
                        # Update circuit breaker
                        if result.success:
                            self.circuit_breaker.record_success(platform)
                        else:
                            self.circuit_breaker.record_failure(platform)
                    else:
                        task.results[platform] = ExecutionResult(
                            success=False,
                            error_message="Task cancelled due to timeout",
                            platform=platform
                        )
                        self.circuit_breaker.record_failure(platform)
                        
                except Exception as e:
                    task.results[platform] = ExecutionResult(
                        success=False,
                        error_message=str(e),
                        platform=platform
                    )
                    self.circuit_breaker.record_failure(platform)
            
            # Calculate latency
            execution_time = time.time() - start_time
            latency_ms = execution_time * 1000
            self.latency_history.append(latency_ms)
            
            # Update metrics
            self._update_metrics(task, latency_ms)
            
            # Determine overall task status
            successful_executions = sum(1 for result in task.results.values() if result.success)
            total_executions = len(task.results)
            
            if successful_executions == 0:
                task.status = ReplicationStatus.FAILED
                task.error_message = "All platform executions failed"
            elif successful_executions == total_executions:
                task.status = ReplicationStatus.COMPLETED
            else:
                task.status = ReplicationStatus.PARTIAL
            
            task.completed_at = datetime.now()
            
            # Record latency for optimization
            for platform, result in task.results.items():
                self.latency_optimizer.record_latency(
                    platform, task.signal.symbol, latency_ms, result.success
                )
            
            # Save to database
            await self._save_replication_session(task)
            
            # Call callbacks
            if task.status == ReplicationStatus.COMPLETED and self.on_task_completed:
                await self.on_task_completed(task)
            elif task.status in [ReplicationStatus.FAILED, ReplicationStatus.PARTIAL] and self.on_task_failed:
                await self.on_task_failed(task)
            
            logger.info(f"Completed task {task.id} with status {task.status.value}")
            
        except Exception as e:
            task.status = ReplicationStatus.FAILED
            task.error_message = str(e)
            task.completed_at = datetime.now()
            
            logger.error(f"Error processing task {task.id}: {e}", exc_info=True)
            
            if self.on_task_failed:
                await self.on_task_failed(task)
    
    async def _execute_on_platform(self, task: ReplicationTask, platform: str) -> ExecutionResult:
        """Execute trade on a specific platform"""
        try:
            # Get platform adapter
            adapter = self.platform_manager.adapters.get(platform)
            if not adapter:
                return ExecutionResult(
                    success=False,
                    error_message=f"Platform {platform} not available",
                    platform=platform
                )
            
            # Execute trade
            result = await adapter.execute_trade(task.signal)
            result.platform = platform
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing on platform {platform}: {e}")
            return ExecutionResult(
                success=False,
                error_message=str(e),
                platform=platform
            )
    
    def _update_metrics(self, task: ReplicationTask, latency_ms: float):
        """Update replication metrics"""
        self.metrics.total_tasks += 1
        
        if task.status == ReplicationStatus.COMPLETED:
            self.metrics.completed_tasks += 1
        elif task.status == ReplicationStatus.FAILED:
            self.metrics.failed_tasks += 1
        
        # Update average latency
        if self.latency_history:
            self.metrics.average_latency_ms = np.mean(list(self.latency_history))
        
        # Update success rate
        if self.metrics.total_tasks > 0:
            self.metrics.success_rate = self.metrics.completed_tasks / self.metrics.total_tasks
        
        # Update platform-specific metrics
        for platform, result in task.results.items():
            if platform not in self.metrics.platform_performance:
                self.metrics.platform_performance[platform] = {
                    'total_trades': 0,
                    'successful_trades': 0,
                    'average_latency': 0.0,
                    'success_rate': 0.0
                }
            
            platform_metrics = self.metrics.platform_performance[platform]
            platform_metrics['total_trades'] += 1
            if result.success:
                platform_metrics['successful_trades'] += 1
            
            platform_metrics['success_rate'] = platform_metrics['successful_trades'] / platform_metrics['total_trades']
    
    async def _save_replication_session(self, task: ReplicationTask):
        """Save replication session to database"""
        if not self.db_session:
            return
        
        try:
            # Save copy trading session
            session_data = {
                'id': str(uuid.uuid4()),
                'master_trade_id': task.master_trade_id,
                'follower_relationship_id': task.follower_relationship_id,
                'replication_delay_ms': int((task.started_at - task.created_at).total_seconds() * 1000) if task.started_at else 0,
                'status': task.status.value,
                'error_message': task.error_message,
                'executed_at': task.completed_at or datetime.now()
            }
            
            # This would be a database insert in a real implementation
            logger.debug(f"Saved replication session: {session_data}")
            
        except Exception as e:
            logger.error(f"Error saving replication session: {e}")
    
    async def get_metrics(self) -> ReplicationMetrics:
        """Get current replication metrics"""
        return self.metrics
    
    async def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        queue_size = await self.replication_queue.size()
        
        return {
            'queue_size': queue_size,
            'is_running': self.is_running,
            'active_workers': len([w for w in self.workers if not w.done()]),
            'metrics': self.metrics
        }
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a queued task"""
        return await self.replication_queue.remove(task_id)
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        # In a real implementation, this would query the database
        # For now, we'll return a placeholder
        return {
            'task_id': task_id,
            'status': 'unknown',
            'message': 'Task status not available in memory-only mode'
        }

class ReplicationEngineManager:
    """Manager for multiple replication engines"""
    
    def __init__(self):
        self.engines: Dict[str, RealTimeReplicationEngine] = {}
        self.platform_manager = UniversalPlatformManager()
    
    async def create_engine(self, engine_id: str, db_session=None) -> RealTimeReplicationEngine:
        """Create a new replication engine"""
        engine = RealTimeReplicationEngine(self.platform_manager, db_session)
        self.engines[engine_id] = engine
        await engine.start()
        return engine
    
    async def get_engine(self, engine_id: str) -> Optional[RealTimeReplicationEngine]:
        """Get a replication engine by ID"""
        return self.engines.get(engine_id)
    
    async def remove_engine(self, engine_id: str) -> bool:
        """Remove a replication engine"""
        if engine_id in self.engines:
            engine = self.engines[engine_id]
            await engine.stop()
            del self.engines[engine_id]
            return True
        return False
    
    async def cleanup(self):
        """Cleanup all engines"""
        for engine in self.engines.values():
            await engine.stop()
        self.engines.clear()
        await self.platform_manager.cleanup()

# Global engine manager instance
engine_manager = ReplicationEngineManager()




