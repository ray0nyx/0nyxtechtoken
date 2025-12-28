"""
Copy Trading API Endpoints
FastAPI endpoints for copy trading operations
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from services.copy_trading_engine import CopyTradingEngine
from services.realtime_sync import RealtimeSyncService, SyncConfig
from services.broker_integration import BrokerIntegrationService
from services.trade_reconciliation import TradeReconciliationService
from utils.monitoring import copy_trading_requests

logger = logging.getLogger(__name__)

# Initialize services (in production, these would be dependency injected)
copy_trading_engine = None
realtime_sync_service = None
broker_integration_service = None
reconciliation_service = None

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])

# Pydantic models
class CopyTradingConfigRequest(BaseModel):
    source_backtest_id: str
    target_exchange_ids: List[str]
    risk_limits: Dict[str, Any] = {}
    copy_settings: Dict[str, Any] = {}
    enable_realtime_sync: bool = True
    sync_interval: int = 1

class SyncStatusRequest(BaseModel):
    config_id: str

class ReconciliationRequest(BaseModel):
    config_id: str
    start_time: str
    end_time: str

class BrokerTestRequest(BaseModel):
    exchange_name: str
    api_key: str
    api_secret: str

# Dependency to get services
def get_copy_trading_engine():
    global copy_trading_engine
    if copy_trading_engine is None:
        copy_trading_engine = CopyTradingEngine(
            db_url="postgresql://user:password@localhost/db",
            encryption_key="your-encryption-key"
        )
    return copy_trading_engine

def get_realtime_sync_service():
    global realtime_sync_service
    if realtime_sync_service is None:
        realtime_sync_service = RealtimeSyncService(get_copy_trading_engine())
    return realtime_sync_service

def get_broker_integration_service():
    global broker_integration_service
    if broker_integration_service is None:
        broker_integration_service = BrokerIntegrationService("your-encryption-key")
    return broker_integration_service

def get_reconciliation_service():
    global reconciliation_service
    if reconciliation_service is None:
        reconciliation_service = TradeReconciliationService("postgresql://user:password@localhost/db")
    return reconciliation_service

@router.post("/start")
async def start_copy_trading(
    request: CopyTradingConfigRequest,
    background_tasks: BackgroundTasks,
    engine: CopyTradingEngine = Depends(get_copy_trading_engine),
    sync_service: RealtimeSyncService = Depends(get_realtime_sync_service)
):
    """Start copy trading for a configuration"""
    try:
        copy_trading_requests.labels(action='start').inc()
        
        # Start copy trading engine
        success = await engine.start_copy_trading(request.source_backtest_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to start copy trading")
        
        # Start real-time sync if enabled
        if request.enable_realtime_sync:
            sync_config = SyncConfig(
                config_id=request.source_backtest_id,
                source_backtest_id=request.source_backtest_id,
                target_exchanges=request.target_exchange_ids,
                sync_interval=request.sync_interval
            )
            
            sync_success = await sync_service.start_realtime_sync(sync_config)
            if not sync_success:
                logger.warning("Failed to start real-time sync, but copy trading started")
        
        return {
            "message": "Copy trading started successfully",
            "config_id": request.source_backtest_id,
            "realtime_sync_enabled": request.enable_realtime_sync
        }
        
    except Exception as e:
        logger.error(f"Error starting copy trading: {e}", exc_info=True)
        copy_trading_requests.labels(action='start', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_copy_trading(
    request: SyncStatusRequest,
    engine: CopyTradingEngine = Depends(get_copy_trading_engine),
    sync_service: RealtimeSyncService = Depends(get_realtime_sync_service)
):
    """Stop copy trading for a configuration"""
    try:
        copy_trading_requests.labels(action='stop').inc()
        
        # Stop copy trading engine
        engine_success = await engine.stop_copy_trading(request.config_id)
        
        # Stop real-time sync
        sync_success = await sync_service.stop_realtime_sync(request.config_id)
        
        if not engine_success and not sync_success:
            raise HTTPException(status_code=400, detail="Failed to stop copy trading")
        
        return {
            "message": "Copy trading stopped successfully",
            "config_id": request.config_id
        }
        
    except Exception as e:
        logger.error(f"Error stopping copy trading: {e}", exc_info=True)
        copy_trading_requests.labels(action='stop', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{config_id}")
async def get_copy_trading_status(
    config_id: str,
    engine: CopyTradingEngine = Depends(get_copy_trading_engine),
    sync_service: RealtimeSyncService = Depends(get_realtime_sync_service)
):
    """Get copy trading status for a configuration"""
    try:
        copy_trading_requests.labels(action='status').inc()
        
        # Get engine status
        engine_status = await engine.get_sync_status(config_id)
        
        # Get sync service status
        sync_status = await sync_service.get_sync_status(config_id)
        
        return {
            "config_id": config_id,
            "engine_status": engine_status,
            "sync_status": sync_status,
            "overall_status": "active" if engine_status.get("is_active") else "inactive"
        }
        
    except Exception as e:
        logger.error(f"Error getting copy trading status: {e}", exc_info=True)
        copy_trading_requests.labels(action='status', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
async def pause_copy_trading(
    request: SyncStatusRequest,
    engine: CopyTradingEngine = Depends(get_copy_trading_engine),
    sync_service: RealtimeSyncService = Depends(get_realtime_sync_service)
):
    """Pause copy trading for a configuration"""
    try:
        copy_trading_requests.labels(action='pause').inc()
        
        # Pause copy trading engine
        engine_success = await engine.pause_sync(request.config_id)
        
        # Pause real-time sync
        sync_success = await sync_service.stop_realtime_sync(request.config_id)
        
        if not engine_success and not sync_success:
            raise HTTPException(status_code=400, detail="Failed to pause copy trading")
        
        return {
            "message": "Copy trading paused successfully",
            "config_id": request.config_id
        }
        
    except Exception as e:
        logger.error(f"Error pausing copy trading: {e}", exc_info=True)
        copy_trading_requests.labels(action='pause', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
async def resume_copy_trading(
    request: SyncStatusRequest,
    engine: CopyTradingEngine = Depends(get_copy_trading_engine),
    sync_service: RealtimeSyncService = Depends(get_realtime_sync_service)
):
    """Resume copy trading for a configuration"""
    try:
        copy_trading_requests.labels(action='resume').inc()
        
        # Resume copy trading engine
        engine_success = await engine.resume_sync(request.config_id)
        
        if not engine_success:
            raise HTTPException(status_code=400, detail="Failed to resume copy trading")
        
        return {
            "message": "Copy trading resumed successfully",
            "config_id": request.config_id
        }
        
    except Exception as e:
        logger.error(f"Error resuming copy trading: {e}", exc_info=True)
        copy_trading_requests.labels(action='resume', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reconcile")
async def reconcile_trades(
    request: ReconciliationRequest,
    reconciliation_service: TradeReconciliationService = Depends(get_reconciliation_service)
):
    """Reconcile trades for a configuration"""
    try:
        copy_trading_requests.labels(action='reconcile').inc()
        
        from datetime import datetime
        start_time = datetime.fromisoformat(request.start_time)
        end_time = datetime.fromisoformat(request.end_time)
        
        results = await reconciliation_service.reconcile_trades(
            request.config_id, start_time, end_time
        )
        
        return {
            "message": "Trade reconciliation completed",
            "config_id": request.config_id,
            "total_results": len(results),
            "results": [
                {
                    "status": result.status.value,
                    "discrepancies": result.discrepancies,
                    "correction_needed": result.correction_needed
                }
                for result in results
            ]
        }
        
    except Exception as e:
        logger.error(f"Error reconciling trades: {e}", exc_info=True)
        copy_trading_requests.labels(action='reconcile', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reconciliation-history/{config_id}")
async def get_reconciliation_history(
    config_id: str,
    limit: int = 10,
    reconciliation_service: TradeReconciliationService = Depends(get_reconciliation_service)
):
    """Get reconciliation history for a configuration"""
    try:
        copy_trading_requests.labels(action='reconciliation_history').inc()
        
        history = await reconciliation_service.get_reconciliation_history(config_id, limit)
        
        return {
            "config_id": config_id,
            "history": history
        }
        
    except Exception as e:
        logger.error(f"Error getting reconciliation history: {e}", exc_info=True)
        copy_trading_requests.labels(action='reconciliation_history', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-broker")
async def test_broker_connection(
    request: BrokerTestRequest,
    broker_service: BrokerIntegrationService = Depends(get_broker_integration_service)
):
    """Test connection to a broker"""
    try:
        copy_trading_requests.labels(action='test_broker').inc()
        
        result = await broker_service.test_connection(
            request.exchange_name,
            request.api_key,
            request.api_secret
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error testing broker connection: {e}", exc_info=True)
        copy_trading_requests.labels(action='test_broker', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/supported-exchanges")
async def get_supported_exchanges(
    broker_service: BrokerIntegrationService = Depends(get_broker_integration_service)
):
    """Get list of supported exchanges"""
    try:
        copy_trading_requests.labels(action='supported_exchanges').inc()
        
        exchanges = await broker_service.get_supported_exchanges()
        
        return {
            "supported_exchanges": exchanges
        }
        
    except Exception as e:
        logger.error(f"Error getting supported exchanges: {e}", exc_info=True)
        copy_trading_requests.labels(action='supported_exchanges', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/exchange-info/{exchange_name}")
async def get_exchange_info(
    exchange_name: str,
    broker_service: BrokerIntegrationService = Depends(get_broker_integration_service)
):
    """Get information about a specific exchange"""
    try:
        copy_trading_requests.labels(action='exchange_info').inc()
        
        info = await broker_service.get_exchange_info(exchange_name)
        
        if not info:
            raise HTTPException(status_code=404, detail="Exchange not found")
        
        return {
            "exchange_name": exchange_name,
            "info": info
        }
        
    except Exception as e:
        logger.error(f"Error getting exchange info: {e}", exc_info=True)
        copy_trading_requests.labels(action='exchange_info', status='error').inc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check for copy trading service"""
    return {
        "status": "healthy",
        "service": "copy-trading",
        "timestamp": "2024-01-20T00:00:00Z"
    }
