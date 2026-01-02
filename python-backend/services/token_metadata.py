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
    
    logger.debug(f"Enriching token {mint[:8]}... (name={token.get('name')}, symbol={token.get('symbol')}, image={token.get('image_uri', '')[:30] if token.get('image_uri') else 'None'})")
    
    # Define what a "real" image looks like
    def is_real_image(url):
        if not url: return False
        url_lower = url.lower()
        if url_lower.endswith('.json') or "metadata" in url_lower:
            return False
        # If it has common image extensions or contains 'image', 'ipfs', etc.
        return any(ext in url_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']) or \
               "ipfs" in url_lower or "image" in url_lower or "cdn" in url_lower or \
               url_lower.startswith('data:')
    
    image_uri = token.get("image_uri", "")
    has_real_image = is_real_image(image_uri)
    
    # If we have basic info and a real image, we can skip (but still check cache)
    if token.get("name") and token.get("name") not in ["Loading...", "New Token"] and \
       token.get("symbol") and token.get("symbol") != "???" and \
       has_real_image:
        return token
    
    # Check cache first
    if mint in _metadata_cache:
        cached = _metadata_cache[mint]
        if is_real_image(cached.get("image_uri")):
            # Move to end (LRU)
            _metadata_cache.move_to_end(mint)
            return {**token, **cached}
    
    metadata = None
    
    # 1. ALWAYS try Pump.fun API first for brand new tokens
    # This is more reliable than IPFS for freshly created tokens
    if not token.get("name") or token.get("name") in ["Loading...", "New Token", ""]:
        metadata = await _fetch_from_pump_fun(mint)
        if metadata:
            logger.debug(f"Got metadata from Pump.fun for {mint[:8]}: name={metadata.get('name')}, image={metadata.get('image_uri', '')[:30] if metadata.get('image_uri') else 'None'}")
        else:
            # Fallback to DexScreener if Pump.fun failed or blocked
            logger.debug(f"Pump.fun metadata failed for {mint[:8]}, trying DexScreener fallback...")
            metadata = await _fetch_from_dexscreener(mint)
            if metadata:
                logger.debug(f"Got metadata from DexScreener fallback for {mint[:8]}: name={metadata.get('name')}")
    
    # 2. If Pump.fun failed or no real image, try IPFS metadata URI
    if (not metadata or not is_real_image(metadata.get("image_uri"))) and not has_real_image:
        uri_to_fetch = token.get("uri") or token.get("metadata_uri") or token.get("image_uri")
        if uri_to_fetch and (uri_to_fetch.endswith('.json') or "metadata" in uri_to_fetch.lower() or "ipfs" in uri_to_fetch.lower()):
            ipfs_metadata = await _fetch_from_ipfs(uri_to_fetch)
            if ipfs_metadata:
                logger.debug(f"Got metadata from IPFS for {mint[:8]}: name={ipfs_metadata.get('name')}, image={ipfs_metadata.get('image_uri', '')[:30] if ipfs_metadata.get('image_uri') else 'None'}")
                # Merge IPFS data with existing metadata
                if not metadata:
                    metadata = ipfs_metadata
                else:
                    # IPFS might have better image
                    if is_real_image(ipfs_metadata.get("image_uri")) and not is_real_image(metadata.get("image_uri")):
                        metadata["image_uri"] = ipfs_metadata["image_uri"]
    
    if metadata:
        # Update cache if we got something useful
        if metadata.get("name") or is_real_image(metadata.get("image_uri")):
            _metadata_cache[mint] = metadata
            if len(_metadata_cache) > MAX_CACHE_SIZE:
                _metadata_cache.popitem(last=False)
        
        # Merge metadata into token
        enriched = {**token}
        if metadata.get("name") and (not token.get("name") or token.get("name") in ["Loading...", "New Token"]):
            enriched["name"] = metadata["name"]
        if metadata.get("symbol") and (not token.get("symbol") or token.get("symbol") == "???"):
            enriched["symbol"] = metadata["symbol"]
            
        # IMPORTANT: Overwrite image_uri if it's not a real image OR if metadata has a better one
        new_image = metadata.get("image_uri")
        if is_real_image(new_image):
            if not has_real_image or not enriched.get("image_uri") or "ipfs" in new_image.lower():
                enriched["image_uri"] = new_image
        
        # Other fields
        for field in ["twitter", "telegram", "website", "description"]:
            if metadata.get(field) and not token.get(field):
                enriched[field] = metadata[field]
        
        return enriched
    
    # Log when enrichment fails completely for a token that still needs metadata
    if not token.get("name") or token.get("name") in ["Loading...", "New Token", ""] or not has_real_image:
        logger.warning(f"Enrichment failed for {mint[:12]}... - name={token.get('name')}, image={token.get('image_uri', '')[:40] if token.get('image_uri') else 'None'}")
    
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


async def _fetch_from_dexscreener(mint: str) -> Optional[Dict[str, Any]]:
    """Fetch token metadata from DexScreener as a fallback"""
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{mint}"
        timeout = aiohttp.ClientTimeout(total=5)
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    pairs = data.get("pairs")
                    if pairs and len(pairs) > 0:
                        # Grab the first Solana pair
                        solana_pairs = [p for p in pairs if p.get("chainId") == "solana"]
                        pair = solana_pairs[0] if solana_pairs else pairs[0]
                        
                        base_token = pair.get("baseToken", {})
                        info = pair.get("info", {})
                        
                        return {
                            "name": base_token.get("name", ""),
                            "symbol": base_token.get("symbol", ""),
                            "image_uri": info.get("imageUrl", ""),
                            "description": "",  # DexScreener doesn't usually give description in this endpoint
                            "twitter": next((s.get("url") for s in info.get("socials", []) if s.get("type") == "twitter"), None),
                            "telegram": next((s.get("url") for s in info.get("socials", []) if s.get("type") == "telegram"), None),
                            "website": next((s.get("url") for s in info.get("websites", [])), None),
                        }
        return None
    except Exception as e:
        logger.warning(f"Error fetching metadata from DexScreener: {e}")
        return None


async def _fetch_from_ipfs(uri: str) -> Optional[Dict[str, Any]]:
    """Fetch token metadata from IPFS via the metadata URI"""
    if not uri:
        return None
    
    # Extract CID
    cid = None
    if uri.startswith("ipfs://"):
        cid = uri.replace("ipfs://", "")
    elif "/ipfs/" in uri:
        cid = uri.split("/ipfs/")[-1]
    elif not uri.startswith("http") and (len(uri) >= 46): # Likely a CID
        cid = uri

    # Gateways to try (matching frontend priority)
    gateways = [
        "https://gateway.pinata.cloud/ipfs/",
        "https://ipfs.io/ipfs/",
        "https://dweb.link/ipfs/",
        "https://cf-ipfs.com/ipfs/"
    ]
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    # If we have a CID, try multiple gateways
    if cid:
        for gateway in gateways:
            gateway_url = f"{gateway}{cid}"
            try:
                timeout = aiohttp.ClientTimeout(total=8)
                connector = aiohttp.TCPConnector(ssl=ssl_context)
                
                async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                    async with session.get(gateway_url) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            logger.debug(f"Fetched metadata from IPFS gateway {gateway}: {cid[:8]}...")
                            return {
                                "name": data.get("name", ""),
                                "symbol": data.get("symbol", ""),
                                "image_uri": data.get("image") or data.get("image_uri") or "",
                                "description": data.get("description", ""),
                                "twitter": data.get("twitter"),
                                "telegram": data.get("telegram"),
                                "website": data.get("website"),
                            }
            except Exception as e:
                logger.debug(f"Failed to fetch from IPFS gateway {gateway}: {e}")
        
        logger.warning(f"Failed to fetch IPFS metadata for {cid[:8]} from all gateways")
    
    # If not a standard IPFS CID or gateways failed, try fetching original URI directly
    if uri.startswith("http"):
        try:
            timeout = aiohttp.ClientTimeout(total=8)
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                async with session.get(uri) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return {
                            "name": data.get("name", ""),
                            "symbol": data.get("symbol", ""),
                            "image_uri": data.get("image") or data.get("image_uri") or "",
                            "description": data.get("description", ""),
                            "twitter": data.get("twitter"),
                            "telegram": data.get("telegram"),
                            "website": data.get("website"),
                        }
        except Exception as e:
            logger.warning(f"Error fetching direct URI {uri[:50]}: {e}")
    
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
