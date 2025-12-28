"""
Copy Trading Engine
Real-time trade synchronization and execution system
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

import ccxt.pro as ccxt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from utils.security import SecurityUtils
from utils.monitoring import copy_trades_executed, copy_trades_failed, sync_errors

logger = logging.getLogger(__name__)

class TradeStatus(Enum):
    PENDING = "pending"
    SENT = "sent"
    FILLED = "filled"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SyncStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"

@dataclass
class TradeSignal:
    """Trade signal from source backtest"""
    symbol: str
    side: str  # 'buy' or 'sell'
    quantity: float
    price: Optional[float] = None
    order_type: str = 'market'  # 'market', 'limit', 'stop'
    timestamp: datetime = None
    source_backtest_id: str = None
    metadata: Dict[str, Any] = None

@dataclass
class ExecutionResult:
    """Result of trade execution"""
    success: bool
    order_id: Optional[str] = None
    filled_quantity: Optional[float] = None
    filled_price: Optional[float] = None
    error_message: Optional[str] = None
    execution_time: Optional[datetime] = None

class CopyTradingEngine:
    """Main copy trading engine for real-time trade synchronization"""
    
    def __init__(self, db_url: str, encryption_key: str):
        self.db_url = db_url
        self.security_utils = SecurityUtils()
        self.security_utils.encryption_key = encryption_key
        
        # Database setup
        self.engine = create_engine(db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Exchange clients cache
        self.exchange_clients: Dict[str, ccxt.Exchange] = {}
        
        # Active sync tasks
        self.active_syncs: Dict[str, asyncio.Task] = {}
        
        # Rate limiting
        self.rate_limits: Dict[str, Dict[str, Any]] = {}
        
        logger.info("Copy Trading Engine initialized")

    async def start_copy_trading(self, config_id: str) -> bool:
        """Start copy trading for a configuration"""
        try:
            with self.SessionLocal() as session:
                # Get copy trading configuration
                config = session.execute(
                    text("""
                        SELECT * FROM copy_trading_configs 
                        WHERE id = :config_id AND is_active = true
                    """),
                    {"config_id": config_id}
                ).fetchone()
                
                if not config:
                    logger.error(f"Copy trading config {config_id} not found or inactive")
                    return False
                
                # Get source backtest results
                backtest = session.execute(
                    text("""
                        SELECT * FROM institutional_backtests 
                        WHERE id = :backtest_id
                    """),
                    {"backtest_id": config.source_backtest_id}
                ).fetchone()
                
                if not backtest or backtest.status != 'completed':
                    logger.error(f"Source backtest {config.source_backtest_id} not completed")
                    return False
                
                # Get target exchanges
                exchange_ids = config.target_exchange_ids
                exchanges = session.execute(
                    text("""
                        SELECT * FROM linked_exchanges 
                        WHERE id = ANY(:exchange_ids) AND is_active = true
                    """),
                    {"exchange_ids": exchange_ids}
                ).fetchall()
                
                if not exchanges:
                    logger.error(f"No active exchanges found for config {config_id}")
                    return False
                
                # Start sync task
                sync_task = asyncio.create_task(
                    self._sync_trades(config_id, config, backtest, exchanges)
                )
                self.active_syncs[config_id] = sync_task
                
                # Update sync status
                session.execute(
                    text("""
                        UPDATE copy_trading_configs 
                        SET sync_status = 'active', last_sync_at = NOW()
                        WHERE id = :config_id
                    """),
                    {"config_id": config_id}
                )
                session.commit()
                
                logger.info(f"Started copy trading sync for config {config_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error starting copy trading: {e}", exc_info=True)
            sync_errors.labels(error_type='startup').inc()
            return False

    async def stop_copy_trading(self, config_id: str) -> bool:
        """Stop copy trading for a configuration"""
        try:
            if config_id in self.active_syncs:
                self.active_syncs[config_id].cancel()
                del self.active_syncs[config_id]
            
            with self.SessionLocal() as session:
                session.execute(
                    text("""
                        UPDATE copy_trading_configs 
                        SET sync_status = 'disabled', last_sync_at = NOW()
                        WHERE id = :config_id
                    """),
                    {"config_id": config_id}
                )
                session.commit()
            
            logger.info(f"Stopped copy trading sync for config {config_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping copy trading: {e}", exc_info=True)
            return False

    async def _sync_trades(self, config_id: str, config: Any, backtest: Any, exchanges: List[Any]):
        """Main sync loop for copy trading"""
        try:
            logger.info(f"Starting trade sync for config {config_id}")
            
            # Parse backtest results to extract trades
            trades = self._extract_trades_from_backtest(backtest.results)
            
            if not trades:
                logger.warning(f"No trades found in backtest {backtest.id}")
                return
            
            # Process each trade
            for trade in trades:
                try:
                    await self._execute_trade_on_exchanges(
                        config_id, config, trade, exchanges
                    )
                    
                    # Rate limiting
                    await asyncio.sleep(0.1)  # 100ms between trades
                    
                except Exception as e:
                    logger.error(f"Error executing trade {trade}: {e}")
                    sync_errors.labels(error_type='execution').inc()
                    continue
            
            logger.info(f"Completed trade sync for config {config_id}")
            
        except asyncio.CancelledError:
            logger.info(f"Trade sync cancelled for config {config_id}")
        except Exception as e:
            logger.error(f"Error in trade sync: {e}", exc_info=True)
            sync_errors.labels(error_type='sync_loop').inc()
            
            # Update sync status to error
            try:
                with self.SessionLocal() as session:
                    session.execute(
                        text("""
                            UPDATE copy_trading_configs 
                            SET sync_status = 'error', last_sync_at = NOW()
                            WHERE id = :config_id
                        """),
                        {"config_id": config_id}
                    )
                    session.commit()
            except Exception as update_error:
                logger.error(f"Error updating sync status: {update_error}")

    def _extract_trades_from_backtest(self, backtest_results: Dict) -> List[TradeSignal]:
        """Extract trade signals from backtest results"""
        trades = []
        
        try:
            if not backtest_results or 'trades' not in backtest_results:
                return trades
            
            for trade_data in backtest_results['trades']:
                trade = TradeSignal(
                    symbol=trade_data.get('symbol', ''),
                    side=trade_data.get('side', ''),
                    quantity=float(trade_data.get('quantity', 0)),
                    price=float(trade_data.get('price', 0)) if trade_data.get('price') else None,
                    order_type=trade_data.get('order_type', 'market'),
                    timestamp=datetime.fromisoformat(trade_data.get('timestamp', datetime.now().isoformat())),
                    source_backtest_id=backtest_results.get('backtest_id'),
                    metadata=trade_data.get('metadata', {})
                )
                trades.append(trade)
                
        except Exception as e:
            logger.error(f"Error extracting trades from backtest: {e}")
        
        return trades

    async def _execute_trade_on_exchanges(
        self, 
        config_id: str, 
        config: Any, 
        trade: TradeSignal, 
        exchanges: List[Any]
    ):
        """Execute a trade on all target exchanges"""
        
        # Apply risk limits
        if not self._check_risk_limits(config, trade):
            logger.warning(f"Trade {trade.symbol} {trade.side} failed risk checks")
            return
        
        # Execute on each exchange
        for exchange in exchanges:
            try:
                result = await self._execute_trade_on_exchange(
                    config_id, trade, exchange, config
                )
                
                # Log the trade execution
                await self._log_trade_execution(config_id, trade, exchange, result)
                
                if result.success:
                    copy_trades_executed.labels(exchange=exchange.exchange_name).inc()
                else:
                    copy_trades_failed.labels(exchange=exchange.exchange_name).inc()
                    
            except Exception as e:
                logger.error(f"Error executing trade on {exchange.exchange_name}: {e}")
                copy_trades_failed.labels(exchange=exchange.exchange_name).inc()

    def _check_risk_limits(self, config: Any, trade: TradeSignal) -> bool:
        """Check if trade passes risk limits"""
        try:
            risk_limits = config.risk_limits or {}
            
            # Check position size limit
            max_position_size = risk_limits.get('max_position_size', 1.0)
            if trade.quantity > max_position_size:
                logger.warning(f"Trade quantity {trade.quantity} exceeds max position size {max_position_size}")
                return False
            
            # Check daily loss limit (would need to calculate current P&L)
            # This is a simplified check
            max_daily_loss = risk_limits.get('max_daily_loss', 0.1)
            # TODO: Implement actual daily loss calculation
            
            # Check slippage limit
            max_slippage = risk_limits.get('max_slippage', 0.01)
            # TODO: Implement slippage calculation
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking risk limits: {e}")
            return False

    async def _execute_trade_on_exchange(
        self, 
        config_id: str, 
        trade: TradeSignal, 
        exchange: Any, 
        config: Any
    ) -> ExecutionResult:
        """Execute a trade on a specific exchange"""
        
        try:
            # Get exchange client
            client = await self._get_exchange_client(exchange)
            if not client:
                return ExecutionResult(
                    success=False,
                    error_message=f"Failed to create client for {exchange.exchange_name}"
                )
            
            # Apply copy settings
            adjusted_trade = self._apply_copy_settings(config, trade)
            
            # Place order
            order = await client.create_order(
                symbol=adjusted_trade.symbol,
                type=adjusted_trade.order_type,
                side=adjusted_trade.side,
                amount=adjusted_trade.quantity,
                price=adjusted_trade.price
            )
            
            return ExecutionResult(
                success=True,
                order_id=order.get('id'),
                filled_quantity=order.get('filled', 0),
                filled_price=order.get('average', adjusted_trade.price),
                execution_time=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error executing trade on {exchange.exchange_name}: {e}")
            return ExecutionResult(
                success=False,
                error_message=str(e),
                execution_time=datetime.now()
            )

    def _apply_copy_settings(self, config: Any, trade: TradeSignal) -> TradeSignal:
        """Apply copy trading settings to adjust trade parameters"""
        try:
            copy_settings = config.copy_settings or {}
            
            # Adjust trade size
            min_trade_size = copy_settings.get('min_trade_size', 0.01)
            max_trade_size = copy_settings.get('max_trade_size', 1.0)
            
            adjusted_quantity = max(min_trade_size, min(trade.quantity, max_trade_size))
            
            # Create adjusted trade
            adjusted_trade = TradeSignal(
                symbol=trade.symbol,
                side=trade.side,
                quantity=adjusted_quantity,
                price=trade.price,
                order_type=trade.order_type,
                timestamp=trade.timestamp,
                source_backtest_id=trade.source_backtest_id,
                metadata=trade.metadata
            )
            
            return adjusted_trade
            
        except Exception as e:
            logger.error(f"Error applying copy settings: {e}")
            return trade

    async def _get_exchange_client(self, exchange: Any) -> Optional[ccxt.Exchange]:
        """Get or create exchange client"""
        try:
            exchange_name = exchange.exchange_name.lower()
            
            if exchange_name in self.exchange_clients:
                return self.exchange_clients[exchange_name]
            
            # Decrypt credentials
            api_key = self.security_utils.decrypt_data(exchange.api_key_encrypted)
            api_secret = self.security_utils.decrypt_data(exchange.api_secret_encrypted)
            
            # Create exchange client
            exchange_class = getattr(ccxt, exchange_name)
            client = exchange_class({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'future' if exchange.exchange_type == 'futures' else 'spot'
                }
            })
            
            # Test connection
            await client.load_markets()
            
            self.exchange_clients[exchange_name] = client
            return client
            
        except Exception as e:
            logger.error(f"Error creating exchange client for {exchange.exchange_name}: {e}")
            return None

    async def _log_trade_execution(
        self, 
        config_id: str, 
        trade: TradeSignal, 
        exchange: Any, 
        result: ExecutionResult
    ):
        """Log trade execution to database"""
        try:
            with self.SessionLocal() as session:
                session.execute(
                    text("""
                        INSERT INTO copy_trades (
                            user_id, source_backtest_id, target_exchange_id,
                            symbol, side, quantity, price, status,
                            exchange_order_id, error_message, created_at
                        ) VALUES (
                            :user_id, :source_backtest_id, :target_exchange_id,
                            :symbol, :side, :quantity, :price, :status,
                            :exchange_order_id, :error_message, :created_at
                        )
                    """),
                    {
                        "user_id": exchange.user_id,
                        "source_backtest_id": trade.source_backtest_id,
                        "target_exchange_id": exchange.id,
                        "symbol": trade.symbol,
                        "side": trade.side,
                        "quantity": trade.quantity,
                        "price": trade.price,
                        "status": TradeStatus.FILLED.value if result.success else TradeStatus.FAILED.value,
                        "exchange_order_id": result.order_id,
                        "error_message": result.error_message,
                        "created_at": result.execution_time or datetime.now()
                    }
                )
                session.commit()
                
        except Exception as e:
            logger.error(f"Error logging trade execution: {e}")

    async def get_sync_status(self, config_id: str) -> Dict[str, Any]:
        """Get current sync status for a configuration"""
        try:
            with self.SessionLocal() as session:
                config = session.execute(
                    text("""
                        SELECT sync_status, last_sync_at, 
                               COUNT(ct.id) as total_trades,
                               COUNT(CASE WHEN ct.status = 'filled' THEN 1 END) as successful_trades,
                               COUNT(CASE WHEN ct.status = 'failed' THEN 1 END) as failed_trades
                        FROM copy_trading_configs ctc
                        LEFT JOIN copy_trades ct ON ctc.id = ct.source_backtest_id
                        WHERE ctc.id = :config_id
                        GROUP BY ctc.id, ctc.sync_status, ctc.last_sync_at
                    """),
                    {"config_id": config_id}
                ).fetchone()
                
                if not config:
                    return {"error": "Configuration not found"}
                
                return {
                    "config_id": config_id,
                    "sync_status": config.sync_status,
                    "last_sync_at": config.last_sync_at.isoformat() if config.last_sync_at else None,
                    "total_trades": config.total_trades or 0,
                    "successful_trades": config.successful_trades or 0,
                    "failed_trades": config.failed_trades or 0,
                    "is_active": config_id in self.active_syncs
                }
                
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return {"error": str(e)}

    async def pause_sync(self, config_id: str) -> bool:
        """Pause copy trading sync"""
        try:
            if config_id in self.active_syncs:
                self.active_syncs[config_id].cancel()
                del self.active_syncs[config_id]
            
            with self.SessionLocal() as session:
                session.execute(
                    text("""
                        UPDATE copy_trading_configs 
                        SET sync_status = 'paused', last_sync_at = NOW()
                        WHERE id = :config_id
                    """),
                    {"config_id": config_id}
                )
                session.commit()
            
            logger.info(f"Paused copy trading sync for config {config_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error pausing sync: {e}")
            return False

    async def resume_sync(self, config_id: str) -> bool:
        """Resume copy trading sync"""
        return await self.start_copy_trading(config_id)

    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Cancel all active syncs
            for task in self.active_syncs.values():
                task.cancel()
            
            # Wait for tasks to complete
            await asyncio.gather(*self.active_syncs.values(), return_exceptions=True)
            
            # Close exchange clients
            for client in self.exchange_clients.values():
                if hasattr(client, 'close'):
                    await client.close()
            
            logger.info("Copy trading engine cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
