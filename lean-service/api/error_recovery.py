"""
Error Recovery and Reconciliation API Endpoints
Handles error recovery, retry logic, and trade reconciliation
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from ..services.error_recovery import ErrorRecoveryManager, ErrorType, RecoveryAction
from ..services.security_compliance import SecurityComplianceManager
from ..database import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/error-recovery", tags=["error-recovery"])

# Pydantic models
class ErrorEventRequest(BaseModel):
    trade_id: str
    platform: str
    error_type: str
    error_message: str
    metadata: Optional[Dict[str, Any]] = None

class RetryRequest(BaseModel):
    error_id: str
    retry_function: str  # Function name to call for retry

class ReconciliationRequest(BaseModel):
    master_trade_id: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ReconciliationResult(BaseModel):
    trade_id: str
    platform: str
    status: str
    discrepancies: List[Dict[str, Any]]
    resolved: bool
    resolution_notes: str
    timestamp: datetime

class ErrorSummary(BaseModel):
    error_counts: Dict[str, int]
    recovery_status: Dict[str, int]
    reconciliation_status: Dict[str, int]
    period: Dict[str, str]

# Dependency injection
def get_error_recovery_manager(db = Depends(get_db)) -> ErrorRecoveryManager:
    return ErrorRecoveryManager(db)

def get_security_compliance_manager(db = Depends(get_db)) -> SecurityComplianceManager:
    return SecurityComplianceManager(db, "your_master_key_here")  # In production, use environment variable

@router.post("/log-error")
async def log_error(
    error_request: ErrorEventRequest,
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Log an error event for tracking and recovery"""
    try:
        error_type = ErrorType(error_request.error_type)
        error_id = error_manager.error_recovery.log_error(
            trade_id=error_request.trade_id,
            platform=error_request.platform,
            error_type=error_type,
            error_message=error_request.error_message,
            metadata=error_request.metadata
        )
        
        return {
            "success": True,
            "error_id": error_id,
            "message": "Error logged successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid error type: {e}")
    except Exception as e:
        logger.error(f"Failed to log error: {e}")
        raise HTTPException(status_code=500, detail="Failed to log error")

@router.get("/pending-retries")
async def get_pending_retries(
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Get all pending retry attempts"""
    try:
        pending_retries = error_manager.error_recovery.get_pending_retries()
        
        return {
            "success": True,
            "pending_retries": [
                {
                    "error_id": retry.error_id,
                    "trade_id": retry.trade_id,
                    "platform": retry.platform,
                    "error_type": retry.error_type.value,
                    "error_message": retry.error_message,
                    "retry_count": retry.retry_count,
                    "max_retries": retry.max_retries,
                    "timestamp": retry.timestamp.isoformat(),
                    "metadata": retry.metadata
                }
                for retry in pending_retries
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get pending retries: {e}")
        raise HTTPException(status_code=500, detail="Failed to get pending retries")

@router.post("/process-retry")
async def process_retry(
    retry_request: RetryRequest,
    background_tasks: BackgroundTasks,
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Process a retry attempt for a specific error"""
    try:
        # Get error event
        pending_retries = error_manager.error_recovery.get_pending_retries()
        error_event = next((e for e in pending_retries if e.error_id == retry_request.error_id), None)
        
        if not error_event:
            raise HTTPException(status_code=404, detail="Error event not found or not pending retry")
        
        # Define retry function based on request
        def retry_function(trade_id: str, platform: str) -> bool:
            # This would call the appropriate retry function based on retry_request.retry_function
            # For now, return True as a placeholder
            logger.info(f"Retrying trade {trade_id} on platform {platform}")
            return True
        
        # Process retry in background
        background_tasks.add_task(
            error_manager.process_error_recovery,
            retry_function
        )
        
        return {
            "success": True,
            "message": "Retry processing started",
            "error_id": retry_request.error_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process retry: {e}")
        raise HTTPException(status_code=500, detail="Failed to process retry")

@router.post("/reconcile-trade")
async def reconcile_trade(
    reconciliation_request: ReconciliationRequest,
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Reconcile a specific trade"""
    try:
        result = error_manager.trade_reconciliation.reconcile_trades(
            reconciliation_request.master_trade_id
        )
        
        return {
            "success": True,
            "reconciliation_result": {
                "trade_id": result.trade_id,
                "platform": result.platform,
                "status": result.status,
                "discrepancies": result.discrepancies,
                "resolved": result.resolved,
                "resolution_notes": result.resolution_notes,
                "timestamp": result.timestamp.isoformat()
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reconcile trade: {e}")
        raise HTTPException(status_code=500, detail="Failed to reconcile trade")

@router.post("/reconcile-all-trades")
async def reconcile_all_trades(
    start_date: datetime,
    end_date: datetime,
    background_tasks: BackgroundTasks,
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Reconcile all trades within date range"""
    try:
        # Process reconciliation in background
        background_tasks.add_task(
            error_manager.reconcile_all_trades,
            start_date,
            end_date
        )
        
        return {
            "success": True,
            "message": "Reconciliation process started",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to start reconciliation: {e}")
        raise HTTPException(status_code=500, detail="Failed to start reconciliation")

@router.get("/reconciliation-history")
async def get_reconciliation_history(
    trade_id: Optional[str] = None,
    platform: Optional[str] = None,
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Get reconciliation history"""
    try:
        history = error_manager.trade_reconciliation.get_reconciliation_history(
            trade_id=trade_id,
            platform=platform
        )
        
        return {
            "success": True,
            "reconciliation_history": history
        }
    except Exception as e:
        logger.error(f"Failed to get reconciliation history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get reconciliation history")

@router.get("/error-summary")
async def get_error_summary(
    error_manager: ErrorRecoveryManager = Depends(get_error_recovery_manager)
):
    """Get error and recovery summary"""
    try:
        summary = error_manager.get_error_summary()
        
        return {
            "success": True,
            "error_summary": summary
        }
    except Exception as e:
        logger.error(f"Failed to get error summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get error summary")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "error-recovery"
    }

# Background task for continuous error recovery processing
async def continuous_error_recovery(error_manager: ErrorRecoveryManager):
    """Continuous error recovery processing"""
    while True:
        try:
            await error_manager.process_error_recovery(lambda trade_id, platform: True)
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error in continuous error recovery: {e}")
            await asyncio.sleep(60)

# Start background task when module is imported
import asyncio
from ..app import app

@app.on_event("startup")
async def start_error_recovery_background_task():
    """Start background error recovery task"""
    error_manager = ErrorRecoveryManager(get_db())
    asyncio.create_task(continuous_error_recovery(error_manager))




