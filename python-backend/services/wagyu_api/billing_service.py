"""
Billing Service for WagyuTech API
Tracks usage, calculates fees, integrates with Stripe
"""

import os
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from decimal import Decimal
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")


class BillingService:
    """Billing and subscription management"""
    
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_URL and SUPABASE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    async def get_user_subscription(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's active subscription"""
        if not self.supabase:
            return None
        
        try:
            result = self.supabase.table('api_subscriptions').select('*').eq('user_id', user_id).eq('status', 'active').single().execute()
            if result.data:
                return result.data
        except Exception as e:
            logger.warning(f"No active subscription for user {user_id}: {e}")
        
        return None
    
    async def get_api_usage_stats(
        self, 
        user_id: str, 
        api_key_id: Optional[str] = None,
        period: str = 'today'  # 'today', 'this_hour', 'this_month'
    ) -> Dict[str, Any]:
        """Get API usage statistics"""
        if not self.supabase:
            return {
                'total_requests': 0,
                'requests_today': 0,
                'requests_this_hour': 0,
                'requests_remaining_this_hour': 0,
                'requests_remaining_today': 0,
                'tier': 'free',
                'rate_limit_per_hour': 100,
                'rate_limit_per_minute': 10,
            }
        
        try:
            # Get subscription tier
            subscription = await self.get_user_subscription(user_id)
            tier = subscription['tier'] if subscription else 'free'
            
            # Get rate limits
            from .models.fee_models import get_fee_structure
            fee_structure = get_fee_structure(tier)
            
            # Calculate time ranges
            now = datetime.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            hour_start = now.replace(minute=0, second=0, microsecond=0)
            
            # Build query
            query = self.supabase.table('api_usage_logs').select('id', count='exact').eq('user_id', user_id)
            
            if api_key_id:
                query = query.eq('api_key_id', api_key_id)
            
            # Get counts
            total_result = query.execute()
            total_requests = total_result.count if hasattr(total_result, 'count') else 0
            
            today_result = query.gte('created_at', today_start.isoformat()).execute()
            requests_today = today_result.count if hasattr(today_result, 'count') else 0
            
            hour_result = query.gte('created_at', hour_start.isoformat()).execute()
            requests_this_hour = hour_result.count if hasattr(hour_result, 'count') else 0
            
            return {
                'total_requests': total_requests or 0,
                'requests_today': requests_today or 0,
                'requests_this_hour': requests_this_hour or 0,
                'requests_remaining_this_hour': max(0, fee_structure.api_calls_per_hour - (requests_this_hour or 0)),
                'requests_remaining_today': max(0, fee_structure.api_calls_per_hour - (requests_today or 0)),
                'tier': tier,
                'rate_limit_per_hour': fee_structure.api_calls_per_hour,
                'rate_limit_per_minute': fee_structure.api_calls_per_minute,
            }
        except Exception as e:
            logger.error(f"Error getting usage stats: {e}")
            return {
                'total_requests': 0,
                'requests_today': 0,
                'requests_this_hour': 0,
                'requests_remaining_this_hour': 0,
                'requests_remaining_today': 0,
                'tier': 'free',
                'rate_limit_per_hour': 100,
                'rate_limit_per_minute': 10,
            }
    
    async def record_trading_fee(
        self,
        user_id: str,
        api_key_id: Optional[str],
        order_id: str,
        pair_symbol: str,
        order_type: str,
        order_amount: Decimal,
        fee_amount: Decimal,
        fee_percentage: Decimal,
        user_tier: str,
        transaction_hash: Optional[str] = None
    ):
        """Record a trading fee"""
        if not self.supabase:
            return
        
        try:
            self.supabase.table('trading_fees').insert({
                'user_id': user_id,
                'api_key_id': api_key_id,
                'order_id': order_id,
                'pair_symbol': pair_symbol,
                'order_type': order_type,
                'order_amount': str(order_amount),
                'fee_amount': str(fee_amount),
                'fee_percentage': str(fee_percentage),
                'user_tier': user_tier,
                'transaction_hash': transaction_hash,
            }).execute()
        except Exception as e:
            logger.error(f"Error recording trading fee: {e}")
    
    async def get_trading_fees_summary(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get trading fees summary for a user"""
        if not self.supabase:
            return {'total_fees': 0, 'total_trades': 0, 'fees_by_type': {}}
        
        try:
            query = self.supabase.table('trading_fees').select('*').eq('user_id', user_id)
            
            if start_date:
                query = query.gte('created_at', start_date.isoformat())
            if end_date:
                query = query.lte('created_at', end_date.isoformat())
            
            result = query.execute()
            fees = result.data if result.data else []
            
            total_fees = sum(Decimal(fee['fee_amount']) for fee in fees)
            fees_by_type = {}
            
            for fee in fees:
                order_type = fee['order_type']
                if order_type not in fees_by_type:
                    fees_by_type[order_type] = {'count': 0, 'total': Decimal('0')}
                fees_by_type[order_type]['count'] += 1
                fees_by_type[order_type]['total'] += Decimal(fee['fee_amount'])
            
            return {
                'total_fees': float(total_fees),
                'total_trades': len(fees),
                'fees_by_type': {k: {'count': v['count'], 'total': float(v['total'])} for k, v in fees_by_type.items()},
            }
        except Exception as e:
            logger.error(f"Error getting fees summary: {e}")
            return {'total_fees': 0, 'total_trades': 0, 'fees_by_type': {}}
