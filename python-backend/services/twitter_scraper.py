"""
Twitter/X Scraper
Playwright-based Twitter scraping for smart money account monitoring
"""

import asyncio
import logging
import json
import re
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import os

from playwright.async_api import async_playwright, Browser, Page, BrowserContext

logger = logging.getLogger(__name__)


@dataclass
class Tweet:
    """Twitter tweet data"""
    id: str
    author: str
    author_handle: str
    content: str
    timestamp: int
    likes: int
    retweets: int
    replies: int
    url: str
    mentions: List[str]  # Token addresses/symbols mentioned
    sentiment: Optional[str] = None  # 'bullish', 'bearish', 'neutral'


@dataclass
class SmartMoneySignal:
    """Alpha signal from smart money account"""
    account: str
    account_handle: str
    tweet: Tweet
    token_address: Optional[str]
    token_symbol: Optional[str]
    signal_type: str  # 'buy', 'sell', 'hold', 'mention'
    confidence: float  # 0.0 to 1.0
    timestamp: int


class TwitterScraper:
    """
    Playwright-based Twitter/X scraper for smart money monitoring.
    
    Features:
    - Real-time tweet monitoring
    - Token mention detection
    - Sentiment analysis
    - Engagement metrics
    - Anti-detection measures
    """
    
    def __init__(
        self,
        smart_money_accounts: List[str],  # List of Twitter handles to monitor
        callback: Optional[Callable[[SmartMoneySignal], None]] = None
    ):
        self.smart_money_accounts = smart_money_accounts
        self.callback = callback
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._pages: Dict[str, Page] = {}  # handle -> Page
        self._running = False
        self._monitoring_tasks: List[asyncio.Task] = []
        
        # Twitter credentials (optional, for authenticated scraping)
        self.twitter_username = os.getenv("TWITTER_USERNAME")
        self.twitter_password = os.getenv("TWITTER_PASSWORD")
    
    async def start(self):
        """Start the scraper"""
        if self._running:
            return
        
        self._running = True
        
        # Launch browser
        playwright = await async_playwright().start()
        self._browser = await playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
            ]
        )
        
        # Create browser context with realistic settings
        self._context = await self._browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )
        
        # Login if credentials provided
        if self.twitter_username and self.twitter_password:
            await self._login()
        
        # Start monitoring each account
        for account in self.smart_money_accounts:
            task = asyncio.create_task(self._monitor_account(account))
            self._monitoring_tasks.append(task)
        
        logger.info(f"Twitter scraper started, monitoring {len(self.smart_money_accounts)} accounts")
    
    async def stop(self):
        """Stop the scraper"""
        self._running = False
        
        # Cancel monitoring tasks
        for task in self._monitoring_tasks:
            task.cancel()
        
        await asyncio.gather(*self._monitoring_tasks, return_exceptions=True)
        
        # Close pages
        for page in self._pages.values():
            await page.close()
        
        # Close context and browser
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        
        logger.info("Twitter scraper stopped")
    
    async def _login(self):
        """Login to Twitter (if credentials provided)"""
        try:
            page = await self._context.new_page()
            await page.goto("https://twitter.com/i/flow/login", wait_until="networkidle")
            
            # Enter username
            await page.fill('input[autocomplete="username"]', self.twitter_username)
            await page.click('text=Next')
            await asyncio.sleep(1)
            
            # Enter password
            await page.fill('input[type="password"]', self.twitter_password)
            await page.click('text=Log in')
            await page.wait_for_url("**/home", timeout=30000)
            
            logger.info("Twitter login successful")
            await page.close()
        
        except Exception as e:
            logger.error(f"Twitter login failed: {e}")
            # Continue without login (may have rate limits)
    
    async def _monitor_account(self, handle: str):
        """Monitor a specific Twitter account"""
        page = None
        
        try:
            # Create page for this account
            page = await self._context.new_page()
            self._pages[handle] = page
            
            # Navigate to account
            url = f"https://twitter.com/{handle}"
            await page.goto(url, wait_until="networkidle")
            
            # Wait a bit to avoid detection
            await asyncio.sleep(2)
            
            last_tweet_id = None
            
            while self._running:
                try:
                    # Scrape latest tweets
                    tweets = await self._scrape_tweets(page, handle)
                    
                    # Process new tweets
                    for tweet in tweets:
                        if last_tweet_id and tweet.id == last_tweet_id:
                            break  # Already processed
                        
                        # Detect signals
                        signal = self._extract_signal(handle, tweet)
                        
                        if signal:
                            # Call callback
                            if self.callback:
                                try:
                                    self.callback(signal)
                                except Exception as e:
                                    logger.error(f"Signal callback error: {e}")
                            
                            # Update last tweet ID
                            if not last_tweet_id:
                                last_tweet_id = tweet.id
                    
                    # Wait before next check (avoid rate limits)
                    await asyncio.sleep(30)  # Check every 30 seconds
                
                except Exception as e:
                    logger.error(f"Error monitoring {handle}: {e}")
                    await asyncio.sleep(60)  # Wait longer on error
        
        except asyncio.CancelledError:
            logger.info(f"Monitoring cancelled for {handle}")
        except Exception as e:
            logger.error(f"Error in monitor_account for {handle}: {e}")
        finally:
            if page:
                await page.close()
                self._pages.pop(handle, None)
    
    async def _scrape_tweets(self, page: Page, handle: str) -> List[Tweet]:
        """Scrape tweets from a page"""
        tweets = []
        
        try:
            # Wait for tweets to load
            await page.wait_for_selector('article[data-testid="tweet"]', timeout=10000)
            
            # Get tweet elements
            tweet_elements = await page.query_selector_all('article[data-testid="tweet"]')
            
            for element in tweet_elements[:10]:  # Get latest 10 tweets
                try:
                    # Extract tweet data
                    tweet_id = await element.get_attribute('data-tweet-id') or ''
                    content = await element.inner_text()
                    
                    # Extract author
                    author_element = await element.query_selector('[data-testid="User-Name"]')
                    author = await author_element.inner_text() if author_element else handle
                    
                    # Extract engagement metrics (simplified)
                    likes = await self._extract_metric(element, 'like')
                    retweets = await self._extract_metric(element, 'retweet')
                    replies = await self._extract_metric(element, 'reply')
                    
                    # Extract timestamp
                    time_element = await element.query_selector('time')
                    timestamp_str = await time_element.get_attribute('datetime') if time_element else ''
                    timestamp = self._parse_timestamp(timestamp_str)
                    
                    # Build tweet URL
                    url = f"https://twitter.com/{handle}/status/{tweet_id}" if tweet_id else ""
                    
                    # Extract mentions
                    mentions = self._extract_mentions(content)
                    
                    tweet = Tweet(
                        id=tweet_id,
                        author=author,
                        author_handle=handle,
                        content=content,
                        timestamp=timestamp,
                        likes=likes,
                        retweets=retweets,
                        replies=replies,
                        url=url,
                        mentions=mentions,
                    )
                    
                    tweets.append(tweet)
                
                except Exception as e:
                    logger.debug(f"Error extracting tweet: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Error scraping tweets: {e}")
        
        return tweets
    
    async def _extract_metric(self, element, metric_type: str) -> int:
        """Extract engagement metric from tweet element"""
        try:
            # Look for metric button
            selector = f'button[data-testid*="{metric_type}"]'
            metric_element = await element.query_selector(selector)
            if metric_element:
                text = await metric_element.inner_text()
                # Extract number from text (e.g., "1.2K" -> 1200)
                return self._parse_metric_text(text)
        except:
            pass
        return 0
    
    def _parse_metric_text(self, text: str) -> int:
        """Parse metric text to number"""
        if not text:
            return 0
        
        text = text.strip().upper()
        
        # Remove commas
        text = text.replace(',', '')
        
        # Handle K, M suffixes
        if 'K' in text:
            number = float(text.replace('K', ''))
            return int(number * 1000)
        elif 'M' in text:
            number = float(text.replace('M', ''))
            return int(number * 1000000)
        
        try:
            return int(text)
        except:
            return 0
    
    def _parse_timestamp(self, timestamp_str: str) -> int:
        """Parse Twitter timestamp to Unix timestamp"""
        if not timestamp_str:
            return int(datetime.now().timestamp())
        
        try:
            # Twitter uses ISO 8601 format
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return int(dt.timestamp())
        except:
            return int(datetime.now().timestamp())
    
    def _extract_mentions(self, content: str) -> List[str]:
        """Extract token mentions from tweet content"""
        mentions = []
        
        # Look for Solana addresses (base58, 32-44 chars)
        address_pattern = r'[1-9A-HJ-NP-Za-km-z]{32,44}'
        addresses = re.findall(address_pattern, content)
        mentions.extend(addresses)
        
        # Look for common token symbols (e.g., $BONK, $SOL)
        symbol_pattern = r'\$[A-Z]{2,10}'
        symbols = re.findall(symbol_pattern, content)
        mentions.extend(symbols)
        
        return list(set(mentions))  # Remove duplicates
    
    def _extract_signal(
        self,
        handle: str,
        tweet: Tweet
    ) -> Optional[SmartMoneySignal]:
        """Extract trading signal from tweet"""
        content_lower = tweet.content.lower()
        
        # Detect signal type
        signal_type = 'mention'
        confidence = 0.3
        
        if any(word in content_lower for word in ['buy', 'long', 'bullish', 'pump', 'moon']):
            signal_type = 'buy'
            confidence = 0.7
        elif any(word in content_lower for word in ['sell', 'short', 'bearish', 'dump', 'rug']):
            signal_type = 'sell'
            confidence = 0.7
        
        # Extract token address/symbol
        token_address = None
        token_symbol = None
        
        for mention in tweet.mentions:
            if len(mention) >= 32 and not mention.startswith('$'):
                # Likely a token address
                token_address = mention
            elif mention.startswith('$'):
                token_symbol = mention[1:]  # Remove $
        
        # Only create signal if we found a token
        if not (token_address or token_symbol):
            return None
        
        return SmartMoneySignal(
            account=handle,
            account_handle=handle,
            tweet=tweet,
            token_address=token_address,
            token_symbol=token_symbol,
            signal_type=signal_type,
            confidence=confidence,
            timestamp=tweet.timestamp,
        )
    
    def set_callback(self, callback: Callable[[SmartMoneySignal], None]):
        """Set callback for smart money signals"""
        self.callback = callback


# Singleton instance
_twitter_scraper: Optional[TwitterScraper] = None


async def get_twitter_scraper(
    smart_money_accounts: Optional[List[str]] = None,
    callback: Optional[Callable[[SmartMoneySignal], None]] = None
) -> TwitterScraper:
    """Get Twitter scraper instance"""
    global _twitter_scraper
    
    if _twitter_scraper is None:
        # Load smart money accounts from config or env
        if smart_money_accounts is None:
            # Load from config file or use defaults
            import json
            config_path = "python-backend/config/smart_money_accounts.json"
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    smart_money_accounts = config.get("accounts", [])
            except:
                # Default smart money accounts (add your own)
                smart_money_accounts = [
                    "blknoiz06",  # Example - replace with actual smart money accounts
                    "0xMaki",
                    "SBF_FTX",
                ]
        
        _twitter_scraper = TwitterScraper(
            smart_money_accounts=smart_money_accounts,
            callback=callback
        )
        await _twitter_scraper.start()
    elif callback:
        _twitter_scraper.set_callback(callback)
    
    return _twitter_scraper


async def close_twitter_scraper():
    """Close Twitter scraper"""
    global _twitter_scraper
    if _twitter_scraper:
        await _twitter_scraper.stop()
        _twitter_scraper = None
