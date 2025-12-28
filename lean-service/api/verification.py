"""
Verification and Testing API Endpoints
Endpoints for testing copy trading service and alternative authentication
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ..services.copy_trading_verification import CopyTradingVerificationService, CopyTradingHealthCheck
from ..services.alternative_authentication import AlternativeAuthManager, AuthMethod
from ..database import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/verification", tags=["verification"])

# Pydantic models
class VerificationRequest(BaseModel):
    test_types: Optional[List[str]] = None  # ['unit', 'integration', 'performance', 'security', 'end_to_end']

class HealthCheckResponse(BaseModel):
    overall_status: str
    timestamp: str
    components: Dict[str, Any]

class AuthRequest(BaseModel):
    platform: str
    auth_method: str  # 'oauth2', 'sso', 'broker_credentials', 'demo_account', 'paper_trading'
    credentials: Dict[str, Any]

class AuthResponse(BaseModel):
    platform: str
    auth_method: str
    success: bool
    auth_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

# Dependency injection
def get_verification_service(db = Depends(get_db)) -> CopyTradingVerificationService:
    return CopyTradingVerificationService(db)

def get_health_check(db = Depends(get_db)) -> CopyTradingHealthCheck:
    return CopyTradingHealthCheck(db)

def get_auth_manager(db = Depends(get_db)) -> AlternativeAuthManager:
    return AlternativeAuthManager(db)

@router.post("/run-tests")
async def run_verification_tests(
    request: VerificationRequest,
    background_tasks: BackgroundTasks,
    verification_service: CopyTradingVerificationService = Depends(get_verification_service)
):
    """Run comprehensive verification tests for copy trading service"""
    try:
        # Run tests in background to avoid timeout
        background_tasks.add_task(
            verification_service.run_all_verification_tests
        )
        
        return {
            "success": True,
            "message": "Verification tests started. Check status endpoint for results.",
            "test_types": request.test_types or ['unit', 'integration', 'performance', 'security', 'end_to_end']
        }
    except Exception as e:
        logger.error(f"Failed to start verification tests: {e}")
        raise HTTPException(status_code=500, detail="Failed to start verification tests")

@router.get("/test-results")
async def get_test_results(
    verification_service: CopyTradingVerificationService = Depends(get_verification_service)
):
    """Get latest test results"""
    try:
        # This would typically fetch from database or cache
        # For now, return a mock response
        return {
            "success": True,
            "test_results": {
                "overall_status": "PASSED",
                "total_tests": 10,
                "passed_tests": 9,
                "failed_tests": 1,
                "last_run": datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Failed to get test results: {e}")
        raise HTTPException(status_code=500, detail="Failed to get test results")

@router.get("/health")
async def health_check(
    health_service: CopyTradingHealthCheck = Depends(get_health_check)
):
    """Get real-time health status of copy trading service"""
    try:
        health_status = await health_service.check_service_health()
        return {
            "success": True,
            "health_status": health_status
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")

@router.post("/auth/authenticate")
async def authenticate_user(
    request: AuthRequest,
    auth_manager: AlternativeAuthManager = Depends(get_auth_manager)
):
    """Authenticate user using alternative authentication methods"""
    try:
        auth_result = await auth_manager.authenticate_user(
            platform=request.platform,
            auth_method=request.auth_method,
            credentials=request.credentials
        )
        
        return {
            "success": True,
            "auth_data": auth_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@router.get("/auth/status/{user_id}")
async def get_auth_status(
    user_id: str,
    auth_manager: AlternativeAuthManager = Depends(get_auth_manager)
):
    """Get authentication status for all platforms for a user"""
    try:
        auth_status = await auth_manager.get_user_auth_status(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "auth_status": auth_status
        }
    except Exception as e:
        logger.error(f"Failed to get auth status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get auth status")

@router.post("/auth/refresh/{user_id}/{platform}")
async def refresh_auth_token(
    user_id: str,
    platform: str,
    auth_manager: AlternativeAuthManager = Depends(get_auth_manager)
):
    """Refresh authentication token for a platform"""
    try:
        refreshed_auth = await auth_manager.refresh_auth_token(user_id, platform)
        
        return {
            "success": True,
            "auth_data": refreshed_auth
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to refresh auth token: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh auth token")

@router.get("/auth/methods/{platform}")
async def get_auth_methods(platform: str):
    """Get available authentication methods for a platform"""
    try:
        # Define available auth methods for each platform
        platform_auth_methods = {
            'binance': [
                {
                    'method': 'oauth2',
                    'name': 'OAuth2',
                    'description': 'Secure OAuth2 authentication with Binance',
                    'requires_credentials': ['authorization_code'],
                    'features': ['read', 'trade']
                },
                {
                    'method': 'demo_account',
                    'name': 'Demo Account',
                    'description': 'Test with Binance demo account',
                    'requires_credentials': ['user_id'],
                    'features': ['demo_trading']
                }
            ],
            'coinbase': [
                {
                    'method': 'oauth2',
                    'name': 'OAuth2',
                    'description': 'Secure OAuth2 authentication with Coinbase',
                    'requires_credentials': ['authorization_code'],
                    'features': ['read', 'trade']
                },
                {
                    'method': 'paper_trading',
                    'name': 'Paper Trading',
                    'description': 'Simulate trading without real money',
                    'requires_credentials': ['user_id', 'initial_balance'],
                    'features': ['paper_trading']
                }
            ],
            'interactive_brokers': [
                {
                    'method': 'broker_credentials',
                    'name': 'Broker Credentials',
                    'description': 'Login with Interactive Brokers credentials',
                    'requires_credentials': ['username', 'password', 'account_id'],
                    'features': ['read', 'trade']
                },
                {
                    'method': 'paper_trading',
                    'name': 'Paper Trading',
                    'description': 'Simulate trading with IB paper account',
                    'requires_credentials': ['user_id', 'initial_balance'],
                    'features': ['paper_trading']
                }
            ],
            'ninjatrader': [
                {
                    'method': 'broker_credentials',
                    'name': 'Broker Credentials',
                    'description': 'Login with NinjaTrader credentials',
                    'requires_credentials': ['username', 'password'],
                    'features': ['read', 'trade']
                },
                {
                    'method': 'demo_account',
                    'name': 'Demo Account',
                    'description': 'Test with NinjaTrader demo account',
                    'requires_credentials': ['user_id'],
                    'features': ['demo_trading']
                }
            ],
            'rithmic': [
                {
                    'method': 'broker_credentials',
                    'name': 'Broker Credentials',
                    'description': 'Login with Rithmic credentials',
                    'requires_credentials': ['username', 'password'],
                    'features': ['read', 'trade']
                },
                {
                    'method': 'paper_trading',
                    'name': 'Paper Trading',
                    'description': 'Simulate trading with Rithmic paper account',
                    'requires_credentials': ['user_id', 'initial_balance'],
                    'features': ['paper_trading']
                }
            ]
        }
        
        methods = platform_auth_methods.get(platform, [])
        
        return {
            "success": True,
            "platform": platform,
            "auth_methods": methods
        }
    except Exception as e:
        logger.error(f"Failed to get auth methods: {e}")
        raise HTTPException(status_code=500, detail="Failed to get auth methods")

@router.post("/test/connection")
async def test_platform_connection(
    platform: str,
    auth_data: Dict[str, Any],
    auth_manager: AlternativeAuthManager = Depends(get_auth_manager)
):
    """Test connection to a platform using provided auth data"""
    try:
        # This would test the actual connection to the platform
        # For now, return a mock response
        return {
            "success": True,
            "platform": platform,
            "connection_status": "connected",
            "latency_ms": 45,
            "features_available": ["read", "trade"],
            "account_info": {
                "account_type": auth_data.get('account_type', 'live'),
                "balance": 10000 if auth_data.get('account_type') == 'demo' else None
            }
        }
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        raise HTTPException(status_code=500, detail="Connection test failed")

@router.get("/status")
async def get_service_status():
    """Get overall service status"""
    return {
        "success": True,
        "service": "copy-trading-verification",
        "status": "operational",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }




