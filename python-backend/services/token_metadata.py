"""
Token metadata enrichment service.
Fetches full token metadata from Pump.fun API with IPFS fallback.
"""
import asyncio
import json
import logging
import ssl
from typing import Optional, Dict, Any
from collections import OrderedDict
import aiohttp

logger = logging.getLogger(__name__)

# LRU cache for metadata (max 500 entries)
_metadata_cache: OrderedDict = OrderedDict()
MAX_CACHE_SIZE = 500


async def enrich_token_metadata(token: dict) -> dict:
    """
    Enrich a token with full metadata (name, symbol, image).
    Uses Pump.fun API with IPFS fallback.
    """
    mint = token.get("mint")
    if not mint:
        return token
    
    # Skip if already has good metadata
    if token.get("name") and token.get("symbol") and token.get("image_uri"):
        return token
    
    # Check cache first
    if mint in _metadata_cache:
        cached = _metadata_cache[mint]
        # Move to end (LRU)
        _metadata_cache.move_to_end(mint)
        return {**token, **cached}
    
    # Try Pump.fun API first
    metadata = await _fetch_from_pump_fun(mint)
    
    # Fallback to IPFS if no metadata
    if not metadata and token.get("uri"):
        metadata = await _fetch_from_ipfs(token.get("uri"))
    
    if metadata:
        # Update cache
        _metadata_cache[mint] = metadata
        if len(_metadata_cache) > MAX_CACHE_SIZE:
            _metadata_cache.popitem(last=False)  # Remove oldest
        
        # Merge metadata into token
        enriched = {**token}
        if metadata.get("name") and not token.get("name"):
            enriched["name"] = metadata["name"]
        if metadata.get("symbol") and not token.get("symbol"):
            enriched["symbol"] = metadata["symbol"]
        if metadata.get("image_uri") and not token.get("image_uri"):
            enriched["image_uri"] = metadata["image_uri"]
        if metadata.get("twitter") and not token.get("twitter"):
            enriched["twitter"] = metadata["twitter"]
        if metadata.get("telegram") and not token.get("telegram"):
            enriched["telegram"] = metadata["telegram"]
        if metadata.get("website") and not token.get("website"):
            enriched["website"] = metadata["website"]
        if metadata.get("description"):
            enriched["description"] = metadata["description"]
        
        return enriched
    
    return token


async def _fetch_from_pump_fun(mint: str) -> Optional[Dict[str, Any]]:
    """Fetch token metadata from Pump.fun API"""
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        url = f"https://frontend-api.pump.fun/coins/{mint}"
        timeout = aiohttp.ClientTimeout(total=5)
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Accept": "application/json"
            }) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.debug(f"Fetched metadata for {mint[:8]}... from Pump.fun")
                    return {
                        "name": data.get("name", ""),
                        "symbol": data.get("symbol", ""),
                        "image_uri": data.get("image_uri", ""),
                        "description": data.get("description", ""),
                        "twitter": data.get("twitter"),
                        "telegram": data.get("telegram"),
                        "website": data.get("website"),
                        "complete": data.get("complete", False),
                        "raydium_pool": data.get("raydium_pool"),
                        "usd_market_cap": data.get("usd_market_cap", 0),
                        "virtual_sol_reserves": data.get("virtual_sol_reserves"),
                        "virtual_token_reserves": data.get("virtual_token_reserves"),
                    }
                elif resp.status in (530, 503):
                    # Cloudflare blocked
                    logger.debug(f"Pump.fun API blocked (status {resp.status})")
                    return None
                else:
                    logger.debug(f"Pump.fun API returned {resp.status} for {mint[:8]}...")
                    return None
                    
    except asyncio.TimeoutError:
        logger.debug(f"Timeout fetching metadata for {mint[:8]}...")
        return None
    except Exception as e:
        logger.warning(f"Error fetching metadata from Pump.fun: {e}")
        return None


async def _fetch_from_ipfs(uri: str) -> Optional[Dict[str, Any]]:
    """Fetch token metadata from IPFS via the metadata URI"""
    if not uri:
        return None
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        # Convert IPFS URI to HTTP gateway URL if needed
        if uri.startswith("ipfs://"):
            uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/")
        elif not uri.startswith("http"):
            # May be just the CID
            uri = f"https://ipfs.io/ipfs/{uri}"
        
        timeout = aiohttp.ClientTimeout(total=8)
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(uri) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.debug(f"Fetched metadata from IPFS: {uri[:50]}...")
                    return {
                        "name": data.get("name", ""),
                        "symbol": data.get("symbol", ""),
                        "image_uri": data.get("image", ""),
                        "description": data.get("description", ""),
                        "twitter": data.get("twitter"),
                        "telegram": data.get("telegram"),
                        "website": data.get("website"),
                    }
                    
    except Exception as e:
        logger.warning(f"Error fetching IPFS metadata: {e}")
    
    return None


async def batch_enrich_tokens(tokens: list, max_concurrent: int = 10) -> list:
    """
    Enrich multiple tokens in parallel.
    Limits concurrency to avoid overwhelming APIs.
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def enrich_with_limit(token):
        async with semaphore:
            return await enrich_token_metadata(token)
    
    tasks = [enrich_with_limit(t) for t in tokens]
    return await asyncio.gather(*tasks)
