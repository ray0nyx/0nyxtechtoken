"""
Email OTP Service
Automated OTP generation and verification with headless browser support
"""

import asyncio
import logging
import random
import string
import os
from typing import Optional, Dict
from datetime import datetime, timedelta
from dataclasses import dataclass

import aiohttp
from playwright.async_api import async_playwright, Browser, Page

logger = logging.getLogger(__name__)


@dataclass
class OTPRequest:
    """OTP request data"""
    email: str
    user_id: str
    purpose: str  # 'signup', 'login', 'transaction'
    expires_at: datetime


@dataclass
class OTPVerification:
    """OTP verification result"""
    valid: bool
    email: str
    verified_at: Optional[datetime] = None
    error: Optional[str] = None


class EmailOTPService:
    """
    Automated OTP email service with headless browser support.
    
    Features:
    - OTP generation
    - Email verification via headless browser
    - Auto-retrieval from email providers
    - Seamless Web2-like UX
    """
    
    def __init__(self):
        self._browser: Optional[Browser] = None
        self._otp_store: Dict[str, OTPRequest] = {}  # email -> OTPRequest
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Start the OTP service"""
        playwright = await async_playwright().start()
        self._browser = await playwright.chromium.launch(headless=True)
        self._session = aiohttp.ClientSession()
        logger.info("EmailOTPService started")
    
    async def stop(self):
        """Stop the OTP service"""
        if self._browser:
            await self._browser.close()
        if self._session:
            await self._session.close()
        logger.info("EmailOTPService stopped")
    
    def generate_otp(self, length: int = 6) -> str:
        """Generate a random OTP"""
        return ''.join(random.choices(string.digits, k=length))
    
    async def send_otp(
        self,
        email: str,
        user_id: str,
        purpose: str = 'signup'
    ) -> str:
        """
        Generate and send OTP to email.
        
        Returns:
            OTP code (for testing/development)
        """
        otp = self.generate_otp()
        
        # Store OTP request
        request = OTPRequest(
            email=email,
            user_id=user_id,
            purpose=purpose,
            expires_at=datetime.now() + timedelta(minutes=10)
        )
        self._otp_store[email] = request
        
        # Send OTP via email service
        # In production, use email service (SendGrid, AWS SES, etc.)
        # For now, we'll use headless browser to check email
        
        logger.info(f"OTP generated for {email}: {otp}")
        
        # Store OTP in a way that can be retrieved
        # In production, this would be sent via email service
        # For development, we can use a temporary storage
        
        return otp
    
    async def verify_otp(
        self,
        email: str,
        otp_code: str
    ) -> OTPVerification:
        """
        Verify OTP code.
        
        In production, this would check against stored OTP.
        For auto-OTP, we can use headless browser to retrieve from email.
        """
        # Check if OTP request exists
        request = self._otp_store.get(email)
        
        if not request:
            return OTPVerification(
                valid=False,
                email=email,
                error="No OTP request found for this email"
            )
        
        # Check expiration
        if datetime.now() > request.expires_at:
            self._otp_store.pop(email, None)
            return OTPVerification(
                valid=False,
                email=email,
                error="OTP has expired"
            )
        
        # For auto-OTP, retrieve from email using headless browser
        retrieved_otp = await self._retrieve_otp_from_email(email)
        
        # Verify OTP
        if retrieved_otp and retrieved_otp == otp_code:
            self._otp_store.pop(email, None)
            return OTPVerification(
                valid=True,
                email=email,
                verified_at=datetime.now()
            )
        
        return OTPVerification(
            valid=False,
            email=email,
            error="Invalid OTP code"
        )
    
    async def _retrieve_otp_from_email(self, email: str) -> Optional[str]:
        """
        Retrieve OTP from email using headless browser.
        
        This would:
        1. Login to email provider (Gmail, Outlook, etc.)
        2. Find the OTP email
        3. Extract the OTP code
        4. Return it
        """
        if not self._browser:
            return None
        
        try:
            # Determine email provider
            provider = self._get_email_provider(email)
            
            if provider == 'gmail':
                return await self._retrieve_from_gmail(email)
            elif provider == 'outlook':
                return await self._retrieve_from_outlook(email)
            else:
                logger.warning(f"Auto-OTP not supported for {provider}")
                return None
        
        except Exception as e:
            logger.error(f"Error retrieving OTP from email: {e}")
            return None
    
    def _get_email_provider(self, email: str) -> str:
        """Determine email provider from email address"""
        domain = email.split('@')[1].lower() if '@' in email else ''
        
        if 'gmail' in domain:
            return 'gmail'
        elif 'outlook' in domain or 'hotmail' in domain or 'live' in domain:
            return 'outlook'
        elif 'yahoo' in domain:
            return 'yahoo'
        else:
            return 'unknown'
    
    async def _retrieve_from_gmail(self, email: str) -> Optional[str]:
        """Retrieve OTP from Gmail using headless browser"""
        # This is a placeholder - actual implementation would:
        # 1. Navigate to Gmail
        # 2. Login (if credentials provided)
        # 3. Find latest OTP email
        # 4. Extract OTP code
        # 5. Return it
        
        # For security, this would require user consent and credentials
        logger.warning("Gmail OTP retrieval not fully implemented")
        return None
    
    async def _retrieve_from_outlook(self, email: str) -> Optional[str]:
        """Retrieve OTP from Outlook using headless browser"""
        # Similar to Gmail implementation
        logger.warning("Outlook OTP retrieval not fully implemented")
        return None


# Singleton instance
_email_otp_service: Optional[EmailOTPService] = None


async def get_email_otp_service() -> EmailOTPService:
    """Get email OTP service instance"""
    global _email_otp_service
    
    if _email_otp_service is None:
        _email_otp_service = EmailOTPService()
        await _email_otp_service.start()
    
    return _email_otp_service
