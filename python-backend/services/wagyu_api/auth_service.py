"""
API Key Authentication Service
"""

import hashlib
import secrets
import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Supabase connection
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def hash_api_key(key: str) -> str:
    """Hash API key using SHA-256"""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key(prefix: str = "wgy") -> tuple[str, str]:
    """
    Generate a new API key
    Returns: (full_key, key_hash)
    """
    # Generate random key
    random_part = secrets.token_urlsafe(32)
    full_key = f"{prefix}_{random_part}"
    
    # Hash for storage
    key_hash = hash_api_key(full_key)
    
    return full_key, key_hash


async def create_api_key(
    user_id: str,
    name: str,
    tier: str = "free"
) -> tuple[str, str]:
    """
    Create a new API key for a user
    Returns: (full_key, key_id)
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials not configured")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Generate key
    full_key, key_hash = generate_api_key()
    key_prefix = full_key[:8]  # First 8 chars for display
    
    # Get rate limits based on tier
    rate_limits = {
        'free': {'per_hour': 100, 'per_minute': 10},
        'pro': {'per_hour': 1000, 'per_minute': 100},
        'enterprise': {'per_hour': 10000, 'per_minute': 1000},
    }
    limits = rate_limits.get(tier, rate_limits['free'])
    
    # Insert into database
    result = supabase.table('api_keys').insert({
        'user_id': user_id,
        'key_hash': key_hash,
        'key_prefix': key_prefix,
        'name': name,
        'tier': tier,
        'rate_limit_per_hour': limits['per_hour'],
        'rate_limit_per_minute': limits['per_minute'],
        'is_active': True,
    }).execute()
    
    if result.data:
        key_id = result.data[0]['id']
        return full_key, key_id
    
    raise Exception("Failed to create API key")


async def validate_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Validate an API key and return key info
    Returns: {user_id, tier, rate_limits, key_id} or None if invalid
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Hash the provided key
    key_hash = hash_api_key(api_key)
    
    # Look up in database
    result = supabase.table('api_keys').select('*').eq('key_hash', key_hash).eq('is_active', True).single().execute()
    
    if result.data:
        key_data = result.data
        
        # Update last_used_at
        supabase.table('api_keys').update({
            'last_used_at': datetime.now().isoformat()
        }).eq('id', key_data['id']).execute()
        
        return {
            'user_id': key_data['user_id'],
            'tier': key_data['tier'],
            'rate_limit_per_hour': key_data['rate_limit_per_minute'] * 60,  # Convert to hourly
            'rate_limit_per_minute': key_data['rate_limit_per_minute'],
            'key_id': key_data['id'],
            'permissions': key_data.get('permissions', {}),
        }
    
    return None


async def get_user_tier(user_id: str) -> str:
    """Get user's subscription tier"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return 'free'
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Check active subscription
    result = supabase.table('api_subscriptions').select('tier').eq('user_id', user_id).eq('status', 'active').single().execute()
    
    if result.data:
        return result.data['tier']
    
    return 'free'


async def log_api_usage(
    api_key_id: str,
    user_id: str,
    endpoint: str,
    method: str,
    response_time_ms: int,
    status_code: int,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log API usage for analytics and billing"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        supabase.table('api_usage_logs').insert({
            'api_key_id': api_key_id,
            'user_id': user_id,
            'endpoint': endpoint,
            'method': method,
            'response_time_ms': response_time_ms,
            'status_code': status_code,
            'ip_address': ip_address,
            'user_agent': user_agent,
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log API usage: {e}")
