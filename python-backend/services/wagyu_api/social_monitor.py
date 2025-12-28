"""
Social Media Monitoring Service
Monitors Twitter, Telegram, Reddit for token mentions and sentiment
"""

import os
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
import aiohttp
from decimal import Decimal

logger = logging.getLogger(__name__)

# API Keys
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")


class SocialMonitor:
    """Monitor social media for token mentions and signals"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.running = False
        self.subscriptions: Dict[str, List[Callable]] = {}
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def monitor_twitter(
        self,
        keywords: List[str],
        callback: Callable,
        min_engagement: int = 10
    ):
        """
        Monitor Twitter for token mentions
        Uses Twitter API v2
        """
        if not TWITTER_BEARER_TOKEN:
            logger.warning("Twitter Bearer Token not configured")
            return
        
        if not self.session:
            return
        
        # Build search query
        query = " OR ".join(keywords)
        
        try:
            url = "https://api.twitter.com/2/tweets/search/recent"
            headers = {
                "Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"
            }
            params = {
                "query": query,
                "max_results": 100,
                "tweet.fields": "created_at,public_metrics,author_id",
                "expansions": "author_id"
            }
            
            async with self.session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    tweets = data.get('data', [])
                    
                    for tweet in tweets:
                        metrics = tweet.get('public_metrics', {})
                        engagement = (
                            metrics.get('like_count', 0) +
                            metrics.get('retweet_count', 0) +
                            metrics.get('reply_count', 0)
                        )
                        
                        if engagement >= min_engagement:
                            # Analyze sentiment (simplified)
                            sentiment = self._analyze_sentiment(tweet.get('text', ''))
                            
                            signal = {
                                'platform': 'twitter',
                                'signal_type': 'mention',
                                'content': tweet.get('text'),
                                'sentiment_score': sentiment,
                                'engagement_count': engagement,
                                'author_id': tweet.get('author_id'),
                                'tweet_id': tweet.get('id'),
                                'url': f"https://twitter.com/i/status/{tweet.get('id')}",
                                'timestamp': datetime.fromisoformat(tweet.get('created_at').replace('Z', '+00:00')),
                            }
                            
                            await callback(signal)
        except Exception as e:
            logger.error(f"Error monitoring Twitter: {e}")
    
    async def monitor_telegram(
        self,
        channel_ids: List[str],
        keywords: List[str],
        callback: Callable
    ):
        """Monitor Telegram channels"""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("Telegram Bot Token not configured")
            return
        
        # Telegram Bot API implementation
        # Would use python-telegram-bot library in production
        logger.info("Telegram monitoring not fully implemented")
    
    async def monitor_reddit(
        self,
        subreddits: List[str],
        keywords: List[str],
        callback: Callable
    ):
        """Monitor Reddit for token mentions"""
        if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
            logger.warning("Reddit API credentials not configured")
            return
        
        if not self.session:
            return
        
        try:
            # Get OAuth token
            auth_url = "https://www.reddit.com/api/v1/access_token"
            auth_data = {
                'grant_type': 'client_credentials'
            }
            auth_header = {
                'Authorization': f"Basic {base64.b64encode(f'{REDDIT_CLIENT_ID}:{REDDIT_CLIENT_SECRET}'.encode()).decode()}"
            }
            
            async with self.session.post(auth_url, data=auth_data, headers=auth_header) as auth_response:
                if auth_response.status == 200:
                    token_data = await auth_response.json()
                    access_token = token_data.get('access_token')
                    
                    # Search Reddit
                    for subreddit in subreddits:
                        url = f"https://oauth.reddit.com/r/{subreddit}/search"
                        headers = {
                            "Authorization": f"Bearer {access_token}",
                            "User-Agent": "WagyuTech/1.0"
                        }
                        params = {
                            "q": " OR ".join(keywords),
                            "limit": 25,
                            "sort": "new"
                        }
                        
                        async with self.session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                            if response.status == 200:
                                data = await response.json()
                                posts = data.get('data', {}).get('children', [])
                                
                                for post_data in posts:
                                    post = post_data.get('data', {})
                                    sentiment = self._analyze_sentiment(post.get('selftext', '') + ' ' + post.get('title', ''))
                                    
                                    signal = {
                                        'platform': 'reddit',
                                        'signal_type': 'post',
                                        'content': post.get('selftext') or post.get('title'),
                                        'sentiment_score': sentiment,
                                        'engagement_count': post.get('score', 0) + post.get('num_comments', 0),
                                        'author': post.get('author'),
                                        'url': f"https://reddit.com{post.get('permalink')}",
                                        'timestamp': datetime.fromtimestamp(post.get('created_utc', 0)),
                                    }
                                    
                                    await callback(signal)
        except Exception as e:
            logger.error(f"Error monitoring Reddit: {e}")
    
    def _analyze_sentiment(self, text: str) -> Decimal:
        """
        Simple sentiment analysis
        Returns score from -1 (negative) to 1 (positive)
        In production, use a proper NLP library like TextBlob or VADER
        """
        text_lower = text.lower()
        
        # Simple keyword-based sentiment
        positive_words = ['moon', 'pump', 'bullish', 'buy', 'gem', 'gains', 'profit', 'win']
        negative_words = ['dump', 'bearish', 'sell', 'scam', 'rug', 'loss', 'fail']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count + negative_count == 0:
            return Decimal('0')
        
        # Normalize to -1 to 1
        sentiment = (positive_count - negative_count) / max(positive_count + negative_count, 1)
        return Decimal(str(sentiment))
    
    async def get_social_signals(
        self,
        token_symbol: str,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """Get recent social signals for a token"""
        # In production, query social_signals_cache table
        return []
    
    async def start_monitoring(self):
        """Start social media monitoring"""
        self.running = True
        logger.info("Starting social media monitoring")
    
    async def stop_monitoring(self):
        """Stop social media monitoring"""
        self.running = False
        logger.info("Stopped social media monitoring")


# Import base64 for Reddit auth
import base64

# Fix missing import in onchain_monitor
