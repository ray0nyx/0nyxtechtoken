"""
Headless Browser Service
Browser automation for email verification and other tasks
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger(__name__)


class HeadlessBrowserService:
    """
    Headless browser service for automation tasks.
    
    Used for:
    - Email OTP retrieval
    - Email verification
    - Web scraping (when needed)
    """
    
    def __init__(self):
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._playwright = None
    
    async def start(self):
        """Start headless browser"""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
            ]
        )
        
        self._context = await self._browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        )
        
        logger.info("HeadlessBrowserService started")
    
    async def stop(self):
        """Stop headless browser"""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("HeadlessBrowserService stopped")
    
    async def create_page(self) -> Page:
        """Create a new browser page"""
        if not self._context:
            await self.start()
        return await self._context.new_page()
    
    async def login_to_email(
        self,
        email: str,
        password: str,
        provider: str = 'gmail'
    ) -> bool:
        """
        Login to email provider.
        
        Note: This requires user credentials and should only be used
        with explicit user consent.
        """
        try:
            page = await self.create_page()
            
            if provider == 'gmail':
                await page.goto("https://accounts.google.com/signin")
                await page.fill('input[type="email"]', email)
                await page.click('text=Next')
                await asyncio.sleep(1)
                await page.fill('input[type="password"]', password)
                await page.click('text=Next')
                await page.wait_for_url("**/myaccount", timeout=30000)
                await page.close()
                return True
            elif provider == 'outlook':
                await page.goto("https://outlook.live.com")
                # Similar login flow
                await page.close()
                return True
            else:
                logger.warning(f"Unsupported email provider: {provider}")
                return False
        
        except Exception as e:
            logger.error(f"Error logging into email: {e}")
            return False
    
    async def extract_otp_from_email(
        self,
        email: str,
        provider: str = 'gmail'
    ) -> Optional[str]:
        """Extract OTP code from email"""
        try:
            page = await self.create_page()
            
            if provider == 'gmail':
                await page.goto("https://mail.google.com")
                # Wait for emails to load
                await page.wait_for_selector('[role="main"]', timeout=10000)
                
                # Find latest email with OTP
                # This is simplified - actual implementation would search for OTP emails
                otp_element = await page.query_selector('text=/\\d{6}/')  # 6-digit code
                if otp_element:
                    otp_text = await otp_element.inner_text()
                    # Extract 6-digit code
                    import re
                    otp_match = re.search(r'\d{6}', otp_text)
                    if otp_match:
                        await page.close()
                        return otp_match.group(0)
                
                await page.close()
                return None
            
            return None
        
        except Exception as e:
            logger.error(f"Error extracting OTP: {e}")
            return None


# Singleton instance
_headless_browser: Optional[HeadlessBrowserService] = None


async def get_headless_browser() -> HeadlessBrowserService:
    """Get headless browser service instance"""
    global _headless_browser
    
    if _headless_browser is None:
        _headless_browser = HeadlessBrowserService()
        await _headless_browser.start()
    
    return _headless_browser
