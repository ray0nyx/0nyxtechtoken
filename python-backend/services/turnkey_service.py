"""
Turnkey Service
Backend service for Turnkey wallet operations and signature requests
"""

import os
import logging
import aiohttp
from typing import Optional, Dict, Any
import base64

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# Turnkey API configuration
TURNKEY_API_URL = os.getenv("TURNKEY_API_URL", "https://api.turnkey.com")
TURNKEY_API_KEY = os.getenv("TURNKEY_API_KEY")
TURNKEY_API_SECRET = os.getenv("TURNKEY_API_SECRET")
TURNKEY_ORGANIZATION_ID = os.getenv("TURNKEY_ORGANIZATION_ID")


class TurnkeyService:
    """Turnkey API service for wallet operations"""
    
    def __init__(self):
        self.api_key = TURNKEY_API_KEY
        self.api_secret = TURNKEY_API_SECRET
        self.base_url = TURNKEY_API_URL
        self.organization_id = TURNKEY_ORGANIZATION_ID
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self._session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()
    
    def is_configured(self) -> bool:
        """Check if Turnkey is configured"""
        return bool(
            self.api_key and
            self.api_secret and
            self.organization_id
        )
    
    async def create_sub_organization(
        self,
        user_id: str,
        user_email: str
    ) -> Dict[str, Any]:
        """
        Create a sub-organization for a user with a Solana wallet
        
        Args:
            user_id: User ID
            user_email: User email address
            
        Returns:
            Sub-organization data including wallet ID and address
        """
        if not self._session:
            raise RuntimeError("Service not initialized. Use async context manager.")
        
        if not self.is_configured():
            raise RuntimeError("Turnkey not configured. Set TURNKEY_API_KEY, TURNKEY_API_SECRET, TURNKEY_ORGANIZATION_ID")
        
        # Correct Turnkey API endpoint
        url = f"{self.base_url}/public/v1/submit/create_sub_organization"
        
        # Get current timestamp in milliseconds
        import time
        timestamp_ms = str(int(time.time() * 1000))
        
        # Turnkey uses API key authentication
        headers = {
            "Content-Type": "application/json",
            "X-Turnkey-Api-Key": self.api_key,
        }
        
        # Activity-based request format with timestamp
        payload = {
            "type": "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4",
            "timestampMs": timestamp_ms,
            "organizationId": self.organization_id,
            "parameters": {
                "subOrganizationName": f"Axiom-User-{user_id}",
                "rootUsers": [
                    {
                        "userName": user_email,
                        "userEmail": user_email,
                        "apiKeys": [],
                        "authenticators": [],
                    }
                ],
                "rootQuorumThreshold": 1,
                "wallet": {
                    "walletName": f"Wallet-{user_id}",
                    "accounts": [
                        {
                            "curve": "CURVE_ED25519",
                            "pathFormat": "PATH_FORMAT_BIP32",
                            "path": "m/44'/501'/0'/0'",
                            "addressFormat": "ADDRESS_FORMAT_SOLANA",
                        }
                    ],
                },
            }
        }
        
        try:
            logger.info(f"🔑 Turnkey API Request:")
            logger.info(f"  URL: {url}")
            logger.info(f"  Org ID: {self.organization_id}")
            logger.info(f"  Timestamp: {timestamp_ms}")
            
            async with self._session.post(url, headers=headers, json=payload) as response:
                response_text = await response.text()
                
                logger.info(f"🔑 Turnkey API Response:")
                logger.info(f"  Status: {response.status}")
                logger.info(f"  Response: {response_text[:1000]}")
                
                if not response.ok:
                    logger.error(f"❌ Turnkey API error: {response.status} - {response_text}")
                    raise Exception(f"Failed to create sub-organization: {response.status} - {response_text}")
                
                data = await response.json()
                
                # Extract wallet info from Turnkey response
                result = data.get("activity", {}).get("result", {})
                sub_org_id = result.get("subOrganizationId", "")
                wallet_addresses = result.get("walletAddresses", [])
                wallet_id = result.get("walletId", "")
                
                return {
                    "subOrganizationId": sub_org_id,
                    "subOrganizationName": f"Axiom-User-{user_id}",
                    "walletId": wallet_id,
                    "walletAddress": wallet_addresses[0] if wallet_addresses else "",
                }
        except Exception as e:
            logger.error(f"Error creating Turnkey sub-organization: {e}")
            raise
    
    async def sign_transaction(
        self,
        wallet_id: str,
        organization_id: str,
        transaction_base64: str
    ) -> Dict[str, Any]:
        """
        Sign a Solana transaction using Turnkey
        
        Args:
            wallet_id: Turnkey wallet ID
            organization_id: Turnkey organization ID
            transaction_base64: Base64-encoded transaction
            
        Returns:
            Signed transaction data
        """
        if not self._session:
            raise RuntimeError("Service not initialized. Use async context manager.")
        
        if not self.is_configured():
            raise RuntimeError("Turnkey not configured")
        
        # Use Turnkey's sign transaction endpoint
        # Note: This is a simplified version. Actual implementation would use
        # Turnkey's activity-based signing flow
        url = f"{self.base_url}/api/v1/activities/sign-transaction"
        headers = {
            "Content-Type": "application/json",
            "X-Turnkey-Api-Key": self.api_key,
            "X-Turnkey-Api-Secret": self.api_secret,
        }
        
        payload = {
            "organizationId": organization_id,
            "walletId": wallet_id,
            "transaction": transaction_base64,
            "curve": "CURVE_ED25519",
        }
        
        try:
            async with self._session.post(url, headers=headers, json=payload) as response:
                if not response.ok:
                    error_text = await response.text()
                    logger.error(f"Turnkey sign error: {response.status} - {error_text}")
                    raise Exception(f"Failed to sign transaction: {response.status}")
                
                data = await response.json()
                
                # Extract signed transaction from activity result
                # The actual structure depends on Turnkey's API response
                signed_tx = data.get("activity", {}).get("result", {}).get("signedTransaction", "")
                
                return {
                    "signature": data.get("activity", {}).get("result", {}).get("signature", ""),
                    "signedTransaction": signed_tx,
                }
        except Exception as e:
            logger.error(f"Error signing transaction with Turnkey: {e}")
            raise
    
    async def get_wallet(
        self,
        wallet_id: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """Get wallet information"""
        if not self._session:
            raise RuntimeError("Service not initialized")
        
        url = f"{self.base_url}/api/v1/wallets/{wallet_id}"
        headers = {
            "X-Turnkey-Api-Key": self.api_key,
            "X-Turnkey-Api-Secret": self.api_secret,
        }
        params = {"organizationId": organization_id}
        
        try:
            async with self._session.get(url, headers=headers, params=params) as response:
                if not response.ok:
                    raise Exception(f"Failed to get wallet: {response.status}")
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting wallet: {e}")
            raise


# Singleton instance
_turnkey_service: Optional[TurnkeyService] = None


async def get_turnkey_service() -> TurnkeyService:
    """Get Turnkey service instance"""
    global _turnkey_service
    if _turnkey_service is None:
        _turnkey_service = TurnkeyService()
    return _turnkey_service
