"""
HTTP Utilities
Helper functions for aiohttp session management and validation
"""

import logging
from typing import Optional
import aiohttp

logger = logging.getLogger(__name__)


def is_session_valid(session: Optional[aiohttp.ClientSession]) -> bool:
    """
    Check if aiohttp session is valid and not closed.
    
    Args:
        session: The aiohttp ClientSession to validate
        
    Returns:
        True if session is valid and can be used, False otherwise
    """
    if session is None:
        return False
    
    try:
        # Check if session is closed
        return not session.closed
    except (AttributeError, RuntimeError) as e:
        logger.debug(f"Error checking session validity: {e}")
        return False


async def safe_close_session(session: Optional[aiohttp.ClientSession]) -> None:
    """
    Safely close an aiohttp session, handling any errors.
    
    Args:
        session: The aiohttp ClientSession to close
    """
    if session is None:
        return
    
    try:
        if not session.closed:
            await session.close()
    except Exception as e:
        logger.debug(f"Error closing session: {e}")


async def safe_close_connector(connector: Optional[aiohttp.TCPConnector]) -> None:
    """
    Safely close an aiohttp connector, handling any errors.
    
    Args:
        connector: The aiohttp TCPConnector to close
    """
    if connector is None:
        return
    
    try:
        if not connector.closed:
            await connector.close()
    except Exception as e:
        logger.debug(f"Error closing connector: {e}")


def is_cloudflare_error(status_code: int) -> bool:
    """
    Check if HTTP status code indicates a Cloudflare error.
    
    Common Cloudflare error codes:
    - 520: Web server is returning an unknown error
    - 521: Web server is down
    - 522: Connection timed out
    - 523: Origin is unreachable
    - 524: A timeout occurred
    - 525: SSL handshake failed
    - 526: Invalid SSL certificate
    - 527: Railgun error
    - 530: Origin DNS error
    
    Args:
        status_code: HTTP status code
        
    Returns:
        True if status code is a Cloudflare error, False otherwise
    """
    cloudflare_errors = {520, 521, 522, 523, 524, 525, 526, 527, 530}
    return status_code in cloudflare_errors
