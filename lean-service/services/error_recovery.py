"""
Error Recovery and Trade Reconciliation System
Handles failed trades, retry logic, and reconciliation processes
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ErrorType(Enum):
    """Types of errors that can occur during copy trading"""
    NETWORK_ERROR = "network_error"
    AUTHENTICATION_ERROR = "authentication_error"
    INSUFFICIENT_FUNDS = "insufficient_funds"
    INVALID_ORDER = "invalid_order"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    PLATFORM_ERROR = "platform_error"
    TIMEOUT_ERROR = "timeout_error"
    UNKNOWN_ERROR = "unknown_error"

class RecoveryAction(Enum):
    """Actions to take for error recovery"""
    RETRY = "retry"
    SKIP = "skip"
    MANUAL_INTERVENTION = "manual_intervention"
    CANCEL = "cancel"
    REPLACE = "replace"

@dataclass
class ErrorEvent:
    """Error event for tracking and recovery"""
    error_id: str
    trade_id: str
    platform: str
    error_type: ErrorType
    error_message: str
    timestamp: datetime
    retry_count: int
    max_retries: int
    recovery_action: RecoveryAction
    metadata: Dict[str, Any]

@dataclass
class ReconciliationResult:
    """Result of trade reconciliation"""
    trade_id: str
    platform: str
    status: str
    discrepancies: List[Dict[str, Any]]
    resolved: bool
    resolution_notes: str
    timestamp: datetime

class RetryManager:
    """Manages retry logic for failed trades"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
        self.retry_delays = {
            ErrorType.NETWORK_ERROR: [1, 5, 15, 60, 300],  # 1s, 5s, 15s, 1m, 5m
            ErrorType.RATE_LIMIT_EXCEEDED: [60, 300, 900, 3600],  # 1m, 5m, 15m, 1h
            ErrorType.TIMEOUT_ERROR: [5, 15, 60, 300],  # 5s, 15s, 1m, 5m
            ErrorType.PLATFORM_ERROR: [30, 120, 600, 3600],  # 30s, 2m, 10m, 1h
            ErrorType.AUTHENTICATION_ERROR: [300, 1800, 3600],  # 5m, 30m, 1h
            ErrorType.INSUFFICIENT_FUNDS: [60, 300, 1800],  # 1m, 5m, 30m
            ErrorType.INVALID_ORDER: [0],  # No retry
            ErrorType.UNKNOWN_ERROR: [5, 30, 120, 600]  # 5s, 30s, 2m, 10m
        }
    
    def should_retry(self, error_event: ErrorEvent) -> bool:
        """Determine if an error should be retried"""
        if error_event.retry_count >= error_event.max_retries:
            return False
        
        if error_event.error_type == ErrorType.INVALID_ORDER:
            return False
        
        if error_event.error_type == ErrorType.AUTHENTICATION_ERROR and error_event.retry_count > 2:
            return False
        
        return True
    
    def get_retry_delay(self, error_event: ErrorEvent) -> int:
        """Get delay before next retry attempt"""
        delays = self.retry_delays.get(error_event.error_type, [5, 30, 120, 600])
        retry_index = min(error_event.retry_count, len(delays) - 1)
        return delays[retry_index]
    
    def schedule_retry(self, error_event: ErrorEvent) -> datetime:
        """Schedule next retry attempt"""
        if not self.should_retry(error_event):
            return None
        
        delay_seconds = self.get_retry_delay(error_event)
        retry_time = datetime.now() + timedelta(seconds=delay_seconds)
        
        # Update error event with retry time
        error_event.retry_count += 1
        error_event.metadata['next_retry'] = retry_time.isoformat()
        
        return retry_time

class ErrorRecoveryService:
    """Main error recovery service"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
        self.retry_manager = RetryManager(db_engine)
    
    def log_error(self, trade_id: str, platform: str, error_type: ErrorType, 
                  error_message: str, metadata: Dict[str, Any] = None) -> str:
        """Log an error event"""
        try:
            error_id = f"err_{int(time.time() * 1000)}"
            
            error_event = ErrorEvent(
                error_id=error_id,
                trade_id=trade_id,
                platform=platform,
                error_type=error_type,
                error_message=error_message,
                timestamp=datetime.now(),
                retry_count=0,
                max_retries=5,
                recovery_action=RecoveryAction.RETRY,
                metadata=metadata or {}
            )
            
            with self.Session() as session:
                query = text("""
                    INSERT INTO error_events (
                        error_id, trade_id, platform, error_type, error_message,
                        timestamp, retry_count, max_retries, recovery_action, metadata
                    ) VALUES (
                        :error_id, :trade_id, :platform, :error_type, :error_message,
                        :timestamp, :retry_count, :max_retries, :recovery_action, :metadata
                    )
                """)
                
                session.execute(query, {
                    'error_id': error_id,
                    'trade_id': trade_id,
                    'platform': platform,
                    'error_type': error_type.value,
                    'error_message': error_message,
                    'timestamp': error_event.timestamp,
                    'retry_count': error_event.retry_count,
                    'max_retries': error_event.max_retries,
                    'recovery_action': error_event.recovery_action.value,
                    'metadata': json.dumps(error_event.metadata)
                })
                session.commit()
                
                logger.info(f"Error logged: {error_type.value} for trade {trade_id}")
                return error_id
        except Exception as e:
            logger.error(f"Failed to log error: {e}")
            raise
    
    def get_pending_retries(self) -> List[ErrorEvent]:
        """Get all pending retry attempts"""
        try:
            with self.Session() as session:
                query = text("""
                    SELECT error_id, trade_id, platform, error_type, error_message,
                           timestamp, retry_count, max_retries, recovery_action, metadata
                    FROM error_events
                    WHERE recovery_action = 'retry'
                    AND retry_count < max_retries
                    AND (next_retry IS NULL OR next_retry <= :current_time)
                    ORDER BY timestamp ASC
                """)
                
                result = session.execute(query, {'current_time': datetime.now()})
                
                error_events = []
                for row in result:
                    error_event = ErrorEvent(
                        error_id=row.error_id,
                        trade_id=row.trade_id,
                        platform=row.platform,
                        error_type=ErrorType(row.error_type),
                        error_message=row.error_message,
                        timestamp=row.timestamp,
                        retry_count=row.retry_count,
                        max_retries=row.max_retries,
                        recovery_action=RecoveryAction(row.recovery_action),
                        metadata=json.loads(row.metadata) if row.metadata else {}
                    )
                    error_events.append(error_event)
                
                return error_events
        except Exception as e:
            logger.error(f"Failed to get pending retries: {e}")
            return []
    
    def process_retry(self, error_event: ErrorEvent, retry_function) -> bool:
        """Process a retry attempt"""
        try:
            logger.info(f"Processing retry {error_event.retry_count + 1} for trade {error_event.trade_id}")
            
            # Execute retry function
            success = retry_function(error_event.trade_id, error_event.platform)
            
            if success:
                # Mark error as resolved
                self._mark_error_resolved(error_event.error_id)
                logger.info(f"Retry successful for trade {error_event.trade_id}")
                return True
            else:
                # Schedule next retry or mark as failed
                if self.retry_manager.should_retry(error_event):
                    retry_time = self.retry_manager.schedule_retry(error_event)
                    self._update_error_retry_time(error_event.error_id, retry_time)
                    logger.info(f"Retry failed, scheduled next attempt for trade {error_event.trade_id}")
                else:
                    self._mark_error_failed(error_event.error_id)
                    logger.warning(f"Max retries exceeded for trade {error_event.trade_id}")
                
                return False
        except Exception as e:
            logger.error(f"Error during retry processing: {e}")
            self._mark_error_failed(error_event.error_id)
            return False
    
    def _mark_error_resolved(self, error_id: str):
        """Mark error as resolved"""
        try:
            with self.Session() as session:
                query = text("""
                    UPDATE error_events
                    SET recovery_action = 'resolved', resolved_at = :resolved_at
                    WHERE error_id = :error_id
                """)
                
                session.execute(query, {
                    'error_id': error_id,
                    'resolved_at': datetime.now()
                })
                session.commit()
        except Exception as e:
            logger.error(f"Failed to mark error as resolved: {e}")
    
    def _mark_error_failed(self, error_id: str):
        """Mark error as failed after max retries"""
        try:
            with self.Session() as session:
                query = text("""
                    UPDATE error_events
                    SET recovery_action = 'failed', failed_at = :failed_at
                    WHERE error_id = :error_id
                """)
                
                session.execute(query, {
                    'error_id': error_id,
                    'failed_at': datetime.now()
                })
                session.commit()
        except Exception as e:
            logger.error(f"Failed to mark error as failed: {e}")
    
    def _update_error_retry_time(self, error_id: str, retry_time: datetime):
        """Update next retry time for error"""
        try:
            with self.Session() as session:
                query = text("""
                    UPDATE error_events
                    SET next_retry = :retry_time, retry_count = retry_count + 1
                    WHERE error_id = :error_id
                """)
                
                session.execute(query, {
                    'error_id': error_id,
                    'retry_time': retry_time
                })
                session.commit()
        except Exception as e:
            logger.error(f"Failed to update retry time: {e}")

class TradeReconciliationService:
    """Handles trade reconciliation between platforms"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.Session = sessionmaker(bind=db_engine)
    
    def reconcile_trades(self, master_trade_id: str) -> ReconciliationResult:
        """Reconcile trades between master and follower platforms"""
        try:
            with self.Session() as session:
                # Get master trade details
                master_query = text("""
                    SELECT symbol, side, quantity, price, timestamp, platform
                    FROM master_trades
                    WHERE id = :master_trade_id
                """)
                
                master_trade = session.execute(master_query, {'master_trade_id': master_trade_id}).fetchone()
                if not master_trade:
                    raise ValueError(f"Master trade {master_trade_id} not found")
                
                # Get all follower trades for this master trade
                follower_query = text("""
                    SELECT ft.id, ft.platform, ft.quantity, ft.price, ft.executed_at,
                           ft.status, ft.pnl, ft.fees, ft.slippage
                    FROM follower_trades ft
                    WHERE ft.master_trade_id = :master_trade_id
                """)
                
                follower_trades = session.execute(follower_query, {'master_trade_id': master_trade_id}).fetchall()
                
                discrepancies = []
                total_quantity = 0
                total_pnl = 0
                
                for follower_trade in follower_trades:
                    # Check quantity match
                    if follower_trade.quantity != master_trade.quantity:
                        discrepancies.append({
                            'type': 'quantity_mismatch',
                            'platform': follower_trade.platform,
                            'expected': master_trade.quantity,
                            'actual': follower_trade.quantity,
                            'difference': follower_trade.quantity - master_trade.quantity
                        })
                    
                    # Check price deviation
                    if follower_trade.price and master_trade.price:
                        price_deviation = abs(follower_trade.price - master_trade.price) / master_trade.price
                        if price_deviation > 0.01:  # 1% deviation
                            discrepancies.append({
                                'type': 'price_deviation',
                                'platform': follower_trade.platform,
                                'expected': master_trade.price,
                                'actual': follower_trade.price,
                                'deviation_percent': price_deviation * 100
                            })
                    
                    # Check execution time
                    time_diff = (follower_trade.executed_at - master_trade.timestamp).total_seconds()
                    if time_diff > 300:  # 5 minutes
                        discrepancies.append({
                            'type': 'execution_delay',
                            'platform': follower_trade.platform,
                            'delay_seconds': time_diff,
                            'threshold_seconds': 300
                        })
                    
                    total_quantity += follower_trade.quantity
                    total_pnl += follower_trade.pnl or 0
                
                # Check if all trades were executed
                if len(follower_trades) == 0:
                    discrepancies.append({
                        'type': 'no_execution',
                        'description': 'No follower trades executed for this master trade'
                    })
                
                # Check total quantity match
                if total_quantity != master_trade.quantity * len(follower_trades):
                    discrepancies.append({
                        'type': 'total_quantity_mismatch',
                        'expected': master_trade.quantity * len(follower_trades),
                        'actual': total_quantity,
                        'difference': total_quantity - (master_trade.quantity * len(follower_trades))
                    })
                
                reconciliation_result = ReconciliationResult(
                    trade_id=master_trade_id,
                    platform=master_trade.platform,
                    status='completed' if not discrepancies else 'discrepancies_found',
                    discrepancies=discrepancies,
                    resolved=len(discrepancies) == 0,
                    resolution_notes='',
                    timestamp=datetime.now()
                )
                
                # Store reconciliation result
                self._store_reconciliation_result(reconciliation_result)
                
                return reconciliation_result
        except Exception as e:
            logger.error(f"Failed to reconcile trades: {e}")
            raise
    
    def _store_reconciliation_result(self, result: ReconciliationResult):
        """Store reconciliation result in database"""
        try:
            with self.Session() as session:
                query = text("""
                    INSERT INTO reconciliation_results (
                        trade_id, platform, status, discrepancies, resolved,
                        resolution_notes, timestamp
                    ) VALUES (
                        :trade_id, :platform, :status, :discrepancies, :resolved,
                        :resolution_notes, :timestamp
                    )
                """)
                
                session.execute(query, {
                    'trade_id': result.trade_id,
                    'platform': result.platform,
                    'status': result.status,
                    'discrepancies': json.dumps(result.discrepancies),
                    'resolved': result.resolved,
                    'resolution_notes': result.resolution_notes,
                    'timestamp': result.timestamp
                })
                session.commit()
        except Exception as e:
            logger.error(f"Failed to store reconciliation result: {e}")
    
    def get_reconciliation_history(self, trade_id: str = None, platform: str = None) -> List[Dict]:
        """Get reconciliation history"""
        try:
            with self.Session() as session:
                query = text("""
                    SELECT trade_id, platform, status, discrepancies, resolved,
                           resolution_notes, timestamp
                    FROM reconciliation_results
                    WHERE 1=1
                    AND (:trade_id IS NULL OR trade_id = :trade_id)
                    AND (:platform IS NULL OR platform = :platform)
                    ORDER BY timestamp DESC
                """)
                
                result = session.execute(query, {
                    'trade_id': trade_id,
                    'platform': platform
                })
                
                return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Failed to get reconciliation history: {e}")
            return []

class ErrorRecoveryManager:
    """Main error recovery and reconciliation manager"""
    
    def __init__(self, db_engine):
        self.db_engine = db_engine
        self.error_recovery = ErrorRecoveryService(db_engine)
        self.trade_reconciliation = TradeReconciliationService(db_engine)
    
    async def process_error_recovery(self, retry_function):
        """Process all pending error recoveries"""
        try:
            pending_retries = self.error_recovery.get_pending_retries()
            logger.info(f"Processing {len(pending_retries)} pending retries")
            
            for error_event in pending_retries:
                success = self.error_recovery.process_retry(error_event, retry_function)
                if success:
                    logger.info(f"Successfully recovered trade {error_event.trade_id}")
                else:
                    logger.warning(f"Failed to recover trade {error_event.trade_id}")
                
                # Add delay between retries to avoid overwhelming platforms
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Error in error recovery processing: {e}")
    
    def reconcile_all_trades(self, start_date: datetime, end_date: datetime) -> List[ReconciliationResult]:
        """Reconcile all trades within date range"""
        try:
            with self.Session() as session:
                query = text("""
                    SELECT DISTINCT master_trade_id
                    FROM follower_trades
                    WHERE executed_at BETWEEN :start_date AND :end_date
                """)
                
                result = session.execute(query, {
                    'start_date': start_date,
                    'end_date': end_date
                })
                
                master_trade_ids = [row.master_trade_id for row in result]
                reconciliation_results = []
                
                for master_trade_id in master_trade_ids:
                    try:
                        result = self.trade_reconciliation.reconcile_trades(master_trade_id)
                        reconciliation_results.append(result)
                    except Exception as e:
                        logger.error(f"Failed to reconcile trade {master_trade_id}: {e}")
                
                return reconciliation_results
        except Exception as e:
            logger.error(f"Failed to reconcile all trades: {e}")
            return []
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get summary of errors and recovery status"""
        try:
            with self.Session() as session:
                # Get error counts by type
                error_counts_query = text("""
                    SELECT error_type, COUNT(*) as count
                    FROM error_events
                    WHERE timestamp >= :start_date
                    GROUP BY error_type
                """)
                
                start_date = datetime.now() - timedelta(days=7)
                error_counts = session.execute(error_counts_query, {'start_date': start_date}).fetchall()
                
                # Get recovery status
                recovery_status_query = text("""
                    SELECT recovery_action, COUNT(*) as count
                    FROM error_events
                    WHERE timestamp >= :start_date
                    GROUP BY recovery_action
                """)
                
                recovery_status = session.execute(recovery_status_query, {'start_date': start_date}).fetchall()
                
                # Get reconciliation status
                reconciliation_status_query = text("""
                    SELECT status, COUNT(*) as count
                    FROM reconciliation_results
                    WHERE timestamp >= :start_date
                    GROUP BY status
                """)
                
                reconciliation_status = session.execute(reconciliation_status_query, {'start_date': start_date}).fetchall()
                
                return {
                    'error_counts': {row.error_type: row.count for row in error_counts},
                    'recovery_status': {row.recovery_action: row.count for row in recovery_status},
                    'reconciliation_status': {row.status: row.count for row in reconciliation_status},
                    'period': {
                        'start': start_date.isoformat(),
                        'end': datetime.now().isoformat()
                    }
                }
        except Exception as e:
            logger.error(f"Failed to get error summary: {e}")
            return {}




