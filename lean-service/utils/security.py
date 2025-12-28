"""
Security utility functions
"""

import logging
import os
import asyncpg
from typing import Optional
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from cryptography.fernet import Fernet
import hashlib
import hmac

logger = logging.getLogger(__name__)

security = HTTPBearer()

class SecurityManager:
    """Security manager for authentication and authorization"""
    
    def __init__(self):
        self.jwt_secret = os.getenv('JWT_SECRET', 'your-secret-key')
        self.encryption_key = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
        self.cipher = Fernet(self.encryption_key)
    
    async def get_user_id(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
        """Extract user ID from JWT token"""
        try:
            token = credentials.credentials
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            user_id = payload.get('sub')
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            return user_id
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    async def has_institutional_access(self, user_id: str) -> bool:
        """Check if user has institutional (Pro plan) access"""
        try:
            conn = await self.get_supabase_connection()
            
            # Check user's subscription
            query = """
                SELECT us.*, sp.price_monthly
                FROM user_subscriptions us
                LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_id = $1
                ORDER BY us.updated_at DESC
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, user_id)
            await conn.close()
            
            if not row:
                return False
            
            # Developer always has access
            if row['is_developer']:
                return True
            
            # Check if subscription is active and Pro plan
            return (
                row['status'] == 'active' and 
                row['price_monthly'] == 39.99
            )
            
        except Exception as e:
            logger.error(f"Failed to check institutional access: {e}")
            return False
    
    async def get_supabase_connection(self) -> asyncpg.Connection:
        """Get Supabase connection"""
        try:
            supabase_url = os.getenv('SUPABASE_URL')
            if not supabase_url:
                raise Exception("SUPABASE_URL not configured")
            
            return await asyncpg.connect(supabase_url)
            
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}")
            raise
    
    def encrypt_credentials(self, credentials: dict) -> dict:
        """Encrypt exchange credentials"""
        try:
            encrypted = {}
            for key, value in credentials.items():
                if value:
                    encrypted_value = self.cipher.encrypt(value.encode()).decode()
                    encrypted[key] = encrypted_value
            
            return encrypted
            
        except Exception as e:
            logger.error(f"Failed to encrypt credentials: {e}")
            raise
    
    def decrypt_credentials(self, encrypted_credentials: dict) -> dict:
        """Decrypt exchange credentials"""
        try:
            decrypted = {}
            for key, value in encrypted_credentials.items():
                if value:
                    decrypted_value = self.cipher.decrypt(value.encode()).decode()
                    decrypted[key] = decrypted_value
            
            return decrypted
            
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {e}")
            raise
    
    async def log_audit_event(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log audit event"""
        try:
            conn = await self.get_supabase_connection()
            
            query = """
                INSERT INTO audit_logs (
                    user_id, action, resource_type, resource_id, 
                    details, ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """
            
            await conn.execute(
                query,
                user_id, action, resource_type, resource_id,
                details, ip_address, user_agent
            )
            
            await conn.close()
            
        except Exception as e:
            logger.error(f"Failed to log audit event: {e}")
    
    def generate_api_key(self, user_id: str) -> str:
        """Generate API key for user"""
        try:
            payload = {
                'user_id': user_id,
                'type': 'api_key',
                'timestamp': int(time.time())
            }
            
            token = jwt.encode(payload, self.jwt_secret, algorithm='HS256')
            return token
            
        except Exception as e:
            logger.error(f"Failed to generate API key: {e}")
            raise
    
    def validate_api_key(self, api_key: str) -> Optional[str]:
        """Validate API key and return user ID"""
        try:
            payload = jwt.decode(api_key, self.jwt_secret, algorithms=['HS256'])
            
            if payload.get('type') != 'api_key':
                return None
            
            return payload.get('user_id')
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception as e:
            logger.error(f"Failed to validate API key: {e}")
            return None
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        import bcrypt
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        import bcrypt
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    def generate_hmac_signature(self, data: str, secret: str) -> str:
        """Generate HMAC signature for webhook verification"""
        return hmac.new(
            secret.encode('utf-8'),
            data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    def verify_hmac_signature(self, data: str, signature: str, secret: str) -> bool:
        """Verify HMAC signature"""
        expected_signature = self.generate_hmac_signature(data, secret)
        return hmac.compare_digest(signature, expected_signature)
