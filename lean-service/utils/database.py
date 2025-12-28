"""
Database utility functions
"""

import asyncpg
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

async def get_database_connection() -> asyncpg.Connection:
    """Get database connection"""
    try:
        # Try TimescaleDB first
        timescale_url = os.getenv('TIMESCALE_URL')
        if timescale_url:
            return await asyncpg.connect(timescale_url)
        
        # Fallback to Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        if supabase_url:
            return await asyncpg.connect(supabase_url)
        
        raise Exception("No database URL configured")
        
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

async def get_supabase_connection() -> asyncpg.Connection:
    """Get Supabase connection specifically"""
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        if not supabase_url:
            raise Exception("SUPABASE_URL not configured")
        
        return await asyncpg.connect(supabase_url)
        
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        raise
