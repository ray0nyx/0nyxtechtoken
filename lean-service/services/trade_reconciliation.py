"""
Trade Reconciliation Service
Handles trade reconciliation, error detection, and correction
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from utils.monitoring import reconciliation_checks, reconciliation_errors, reconciliation_corrections

logger = logging.getLogger(__name__)

class ReconciliationStatus(Enum):
    MATCHED = "matched"
    MISMATCH = "mismatch"
    MISSING = "missing"
    DUPLICATE = "duplicate"
    ERROR = "error"

@dataclass
class TradeRecord:
    """Trade record for reconciliation"""
    trade_id: str
    symbol: str
    side: str
    quantity: float
    price: float
    timestamp: datetime
    exchange: str
    order_id: Optional[str] = None
    status: str = "filled"
    fees: float = 0.0
    metadata: Dict[str, Any] = None

@dataclass
class ReconciliationResult:
    """Result of trade reconciliation"""
    status: ReconciliationStatus
    source_trade: Optional[TradeRecord] = None
    target_trade: Optional[TradeRecord] = None
    discrepancies: List[str] = None
    correction_needed: bool = False
    error_message: Optional[str] = None

class TradeReconciliationService:
    """Service for reconciling trades between source and target exchanges"""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        
        # Database setup
        self.engine = create_engine(db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Reconciliation settings
        self.tolerance_settings = {
            'price_tolerance': 0.001,  # 0.1% price tolerance
            'quantity_tolerance': 0.001,  # 0.1% quantity tolerance
            'time_tolerance': 300,  # 5 minutes time tolerance
            'fee_tolerance': 0.01  # $0.01 fee tolerance
        }
        
        logger.info("Trade Reconciliation Service initialized")

    async def reconcile_trades(
        self, 
        config_id: str, 
        start_time: datetime, 
        end_time: datetime
    ) -> List[ReconciliationResult]:
        """Reconcile trades for a copy trading configuration"""
        try:
            logger.info(f"Starting trade reconciliation for config {config_id}")
            
            # Get copy trading configuration
            config = await self._get_copy_trading_config(config_id)
            if not config:
                logger.error(f"Copy trading config {config_id} not found")
                return []
            
            # Get source trades (from backtest results)
            source_trades = await self._get_source_trades(config['source_backtest_id'], start_time, end_time)
            
            # Get target trades (from exchanges)
            target_trades = await self._get_target_trades(config['target_exchange_ids'], start_time, end_time)
            
            # Perform reconciliation
            results = await self._perform_reconciliation(source_trades, target_trades)
            
            # Log reconciliation results
            await self._log_reconciliation_results(config_id, results)
            
            reconciliation_checks.labels(config_id=config_id).inc()
            logger.info(f"Completed trade reconciliation for config {config_id}: {len(results)} results")
            
            return results
            
        except Exception as e:
            logger.error(f"Error in trade reconciliation: {e}", exc_info=True)
            reconciliation_errors.labels(config_id=config_id, error_type='reconciliation').inc()
            return []

    async def _get_copy_trading_config(self, config_id: str) -> Optional[Dict[str, Any]]:
        """Get copy trading configuration"""
        try:
            with self.SessionLocal() as session:
                config = session.execute(
                    text("""
                        SELECT * FROM copy_trading_configs 
                        WHERE id = :config_id
                    """),
                    {"config_id": config_id}
                ).fetchone()
                
                if config:
                    return dict(config._mapping)
                return None
                
        except Exception as e:
            logger.error(f"Error getting copy trading config: {e}")
            return None

    async def _get_source_trades(self, backtest_id: str, start_time: datetime, end_time: datetime) -> List[TradeRecord]:
        """Get source trades from backtest results"""
        try:
            with self.SessionLocal() as session:
                backtest = session.execute(
                    text("""
                        SELECT results FROM institutional_backtests 
                        WHERE id = :backtest_id
                    """),
                    {"backtest_id": backtest_id}
                ).fetchone()
                
                if not backtest or not backtest.results:
                    return []
                
                trades = []
                backtest_results = backtest.results
                
                # Extract trades from backtest results
                if 'trades' in backtest_results:
                    for trade_data in backtest_results['trades']:
                        # Filter by time range
                        trade_time = datetime.fromisoformat(trade_data.get('timestamp', ''))
                        if start_time <= trade_time <= end_time:
                            trade = TradeRecord(
                                trade_id=trade_data.get('id', ''),
                                symbol=trade_data.get('symbol', ''),
                                side=trade_data.get('side', ''),
                                quantity=float(trade_data.get('quantity', 0)),
                                price=float(trade_data.get('price', 0)),
                                timestamp=trade_time,
                                exchange='backtest',
                                order_id=trade_data.get('order_id'),
                                status=trade_data.get('status', 'filled'),
                                fees=float(trade_data.get('fees', 0)),
                                metadata=trade_data.get('metadata', {})
                            )
                            trades.append(trade)
                
                return trades
                
        except Exception as e:
            logger.error(f"Error getting source trades: {e}")
            return []

    async def _get_target_trades(self, exchange_ids: List[str], start_time: datetime, end_time: datetime) -> List[TradeRecord]:
        """Get target trades from exchanges"""
        try:
            with self.SessionLocal() as session:
                trades = session.execute(
                    text("""
                        SELECT * FROM copy_trades 
                        WHERE target_exchange_id = ANY(:exchange_ids)
                        AND created_at BETWEEN :start_time AND :end_time
                        ORDER BY created_at
                    """),
                    {
                        "exchange_ids": exchange_ids,
                        "start_time": start_time,
                        "end_time": end_time
                    }
                ).fetchall()
                
                trade_records = []
                for trade in trades:
                    # Get exchange name
                    exchange = session.execute(
                        text("""
                            SELECT exchange_name FROM linked_exchanges 
                            WHERE id = :exchange_id
                        """),
                        {"exchange_id": trade.target_exchange_id}
                    ).fetchone()
                    
                    trade_record = TradeRecord(
                        trade_id=str(trade.id),
                        symbol=trade.symbol,
                        side=trade.side,
                        quantity=float(trade.quantity or 0),
                        price=float(trade.price or 0),
                        timestamp=trade.created_at,
                        exchange=exchange.exchange_name if exchange else 'unknown',
                        order_id=trade.exchange_order_id,
                        status=trade.status,
                        fees=0.0,  # Would need to fetch from exchange
                        metadata={'copy_trade_id': str(trade.id)}
                    )
                    trade_records.append(trade_record)
                
                return trade_records
                
        except Exception as e:
            logger.error(f"Error getting target trades: {e}")
            return []

    async def _perform_reconciliation(
        self, 
        source_trades: List[TradeRecord], 
        target_trades: List[TradeRecord]
    ) -> List[ReconciliationResult]:
        """Perform the actual reconciliation"""
        try:
            results = []
            
            # Create lookup maps for efficient matching
            source_map = {trade.trade_id: trade for trade in source_trades}
            target_map = {trade.trade_id: trade for trade in target_trades}
            
            # Check for matched trades
            for source_trade in source_trades:
                target_trade = target_map.get(source_trade.trade_id)
                
                if target_trade:
                    # Trades exist in both - check for discrepancies
                    result = await self._compare_trades(source_trade, target_trade)
                    results.append(result)
                else:
                    # Source trade not found in target
                    result = ReconciliationResult(
                        status=ReconciliationStatus.MISSING,
                        source_trade=source_trade,
                        discrepancies=['Trade not found in target exchanges'],
                        correction_needed=True
                    )
                    results.append(result)
            
            # Check for target trades not in source (duplicates or errors)
            for target_trade in target_trades:
                if target_trade.trade_id not in source_map:
                    result = ReconciliationResult(
                        status=ReconciliationStatus.DUPLICATE,
                        target_trade=target_trade,
                        discrepancies=['Trade found in target but not in source'],
                        correction_needed=True
                    )
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error performing reconciliation: {e}")
            return []

    async def _compare_trades(self, source_trade: TradeRecord, target_trade: TradeRecord) -> ReconciliationResult:
        """Compare two trades for discrepancies"""
        try:
            discrepancies = []
            
            # Compare symbol
            if source_trade.symbol != target_trade.symbol:
                discrepancies.append(f"Symbol mismatch: {source_trade.symbol} vs {target_trade.symbol}")
            
            # Compare side
            if source_trade.side != target_trade.side:
                discrepancies.append(f"Side mismatch: {source_trade.side} vs {target_trade.side}")
            
            # Compare quantity (with tolerance)
            quantity_diff = abs(source_trade.quantity - target_trade.quantity)
            quantity_tolerance = source_trade.quantity * self.tolerance_settings['quantity_tolerance']
            if quantity_diff > quantity_tolerance:
                discrepancies.append(f"Quantity mismatch: {source_trade.quantity} vs {target_trade.quantity}")
            
            # Compare price (with tolerance)
            if source_trade.price and target_trade.price:
                price_diff = abs(source_trade.price - target_trade.price)
                price_tolerance = source_trade.price * self.tolerance_settings['price_tolerance']
                if price_diff > price_tolerance:
                    discrepancies.append(f"Price mismatch: {source_trade.price} vs {target_trade.price}")
            
            # Compare timestamp (with tolerance)
            time_diff = abs((source_trade.timestamp - target_trade.timestamp).total_seconds())
            if time_diff > self.tolerance_settings['time_tolerance']:
                discrepancies.append(f"Time mismatch: {source_trade.timestamp} vs {target_trade.timestamp}")
            
            # Determine status
            if not discrepancies:
                status = ReconciliationStatus.MATCHED
                correction_needed = False
            else:
                status = ReconciliationStatus.MISMATCH
                correction_needed = True
            
            return ReconciliationResult(
                status=status,
                source_trade=source_trade,
                target_trade=target_trade,
                discrepancies=discrepancies,
                correction_needed=correction_needed
            )
            
        except Exception as e:
            logger.error(f"Error comparing trades: {e}")
            return ReconciliationResult(
                status=ReconciliationStatus.ERROR,
                source_trade=source_trade,
                target_trade=target_trade,
                error_message=str(e)
            )

    async def _log_reconciliation_results(self, config_id: str, results: List[ReconciliationResult]):
        """Log reconciliation results to database"""
        try:
            with self.SessionLocal() as session:
                # Create reconciliation record
                reconciliation_id = session.execute(
                    text("""
                        INSERT INTO trade_reconciliations (
                            config_id, total_trades, matched_trades, 
                            mismatched_trades, missing_trades, duplicate_trades,
                            error_trades, created_at
                        ) VALUES (
                            :config_id, :total_trades, :matched_trades,
                            :mismatched_trades, :missing_trades, :duplicate_trades,
                            :error_trades, :created_at
                        ) RETURNING id
                    """),
                    {
                        "config_id": config_id,
                        "total_trades": len(results),
                        "matched_trades": len([r for r in results if r.status == ReconciliationStatus.MATCHED]),
                        "mismatched_trades": len([r for r in results if r.status == ReconciliationStatus.MISMATCH]),
                        "missing_trades": len([r for r in results if r.status == ReconciliationStatus.MISSING]),
                        "duplicate_trades": len([r for r in results if r.status == ReconciliationStatus.DUPLICATE]),
                        "error_trades": len([r for r in results if r.status == ReconciliationStatus.ERROR]),
                        "created_at": datetime.now()
                    }
                ).fetchone()
                
                # Log individual discrepancies
                for result in results:
                    if result.discrepancies:
                        for discrepancy in result.discrepancies:
                            session.execute(
                                text("""
                                    INSERT INTO reconciliation_discrepancies (
                                        reconciliation_id, trade_id, discrepancy_type,
                                        description, correction_needed, created_at
                                    ) VALUES (
                                        :reconciliation_id, :trade_id, :discrepancy_type,
                                        :description, :correction_needed, :created_at
                                    )
                                """),
                                {
                                    "reconciliation_id": reconciliation_id.id,
                                    "trade_id": result.source_trade.trade_id if result.source_trade else result.target_trade.trade_id,
                                    "discrepancy_type": result.status.value,
                                    "description": discrepancy,
                                    "correction_needed": result.correction_needed,
                                    "created_at": datetime.now()
                                }
                            )
                
                session.commit()
                
        except Exception as e:
            logger.error(f"Error logging reconciliation results: {e}")

    async def get_reconciliation_history(self, config_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get reconciliation history for a configuration"""
        try:
            with self.SessionLocal() as session:
                reconciliations = session.execute(
                    text("""
                        SELECT * FROM trade_reconciliations 
                        WHERE config_id = :config_id 
                        ORDER BY created_at DESC 
                        LIMIT :limit
                    """),
                    {"config_id": config_id, "limit": limit}
                ).fetchall()
                
                results = []
                for rec in reconciliations:
                    results.append({
                        'id': str(rec.id),
                        'config_id': rec.config_id,
                        'total_trades': rec.total_trades,
                        'matched_trades': rec.matched_trades,
                        'mismatched_trades': rec.mismatched_trades,
                        'missing_trades': rec.missing_trades,
                        'duplicate_trades': rec.duplicate_trades,
                        'error_trades': rec.error_trades,
                        'created_at': rec.created_at.isoformat()
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Error getting reconciliation history: {e}")
            return []

    async def get_reconciliation_details(self, reconciliation_id: str) -> Dict[str, Any]:
        """Get detailed reconciliation results"""
        try:
            with self.SessionLocal() as session:
                # Get reconciliation summary
                reconciliation = session.execute(
                    text("""
                        SELECT * FROM trade_reconciliations 
                        WHERE id = :reconciliation_id
                    """),
                    {"reconciliation_id": reconciliation_id}
                ).fetchone()
                
                if not reconciliation:
                    return {"error": "Reconciliation not found"}
                
                # Get discrepancies
                discrepancies = session.execute(
                    text("""
                        SELECT * FROM reconciliation_discrepancies 
                        WHERE reconciliation_id = :reconciliation_id
                        ORDER BY created_at
                    """),
                    {"reconciliation_id": reconciliation_id}
                ).fetchall()
                
                return {
                    'reconciliation': dict(reconciliation._mapping),
                    'discrepancies': [dict(d._mapping) for d in discrepancies]
                }
                
        except Exception as e:
            logger.error(f"Error getting reconciliation details: {e}")
            return {"error": str(e)}

    async def schedule_automatic_reconciliation(self, config_id: str, interval_hours: int = 24):
        """Schedule automatic reconciliation"""
        try:
            # This would typically use a task scheduler like Celery or APScheduler
            # For now, we'll just log the scheduling
            logger.info(f"Scheduled automatic reconciliation for config {config_id} every {interval_hours} hours")
            
            # In a real implementation, this would:
            # 1. Create a scheduled task
            # 2. Store the schedule in the database
            # 3. Set up monitoring and alerts
            
            return True
            
        except Exception as e:
            logger.error(f"Error scheduling automatic reconciliation: {e}")
            return False

    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Close database connections
            self.engine.dispose()
            
            logger.info("Trade reconciliation service cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
