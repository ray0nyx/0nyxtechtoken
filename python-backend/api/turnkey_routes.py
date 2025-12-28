"""
Turnkey API Routes
FastAPI endpoints for Turnkey wallet operations
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging

from services.turnkey_service import get_turnkey_service, TurnkeyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/turnkey", tags=["turnkey"])


@router.get("/health")
async def health_check():
    """Check if Turnkey service is available"""
    try:
        async with get_turnkey_service() as service:
            return {
                "available": service.is_configured(),
                "status": "ok" if service.is_configured() else "not_configured"
            }
    except Exception as e:
        logger.error(f"Turnkey health check failed: {e}")
        return {
            "available": False,
            "status": "error",
            "error": str(e)
        }


@router.post("/create-sub-organization")
async def create_sub_organization(request: Dict[str, Any]):
    """Create a Turnkey sub-organization for a user"""
    try:
        user_id = request.get("userId")
        user_email = request.get("userEmail")
        
        if not user_id or not user_email:
            raise HTTPException(status_code=400, detail="userId and userEmail required")
        
        async with get_turnkey_service() as service:
            result = await service.create_sub_organization(user_id, user_email)
            return result
    except Exception as e:
        logger.error(f"Error creating sub-organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sign")
async def sign_transaction(request: Dict[str, Any]):
    """Sign a Solana transaction using Turnkey"""
    try:
        wallet_id = request.get("walletId")
        organization_id = request.get("organizationId")
        transaction_base64 = request.get("transaction")
        
        if not wallet_id or not organization_id or not transaction_base64:
            raise HTTPException(
                status_code=400,
                detail="walletId, organizationId, and transaction required"
            )
        
        async with get_turnkey_service() as service:
            result = await service.sign_transaction(
                wallet_id,
                organization_id,
                transaction_base64
            )
            return result
    except Exception as e:
        logger.error(f"Error signing transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wallet/{wallet_id}")
async def get_wallet(wallet_id: str, organization_id: str):
    """Get wallet information"""
    try:
        if not organization_id:
            raise HTTPException(status_code=400, detail="organizationId required")
        
        async with get_turnkey_service() as service:
            result = await service.get_wallet(wallet_id, organization_id)
            return result
    except Exception as e:
        logger.error(f"Error getting wallet: {e}")
        raise HTTPException(status_code=500, detail=str(e))
