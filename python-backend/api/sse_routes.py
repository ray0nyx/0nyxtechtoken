"""
Server-Sent Events (SSE) Routes
Real-time streaming endpoints for price and market data
"""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging
from typing import Optional
from datetime import datetime

from services.redis_service import get_redis_service, RedisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sse", tags=["sse"])


async def price_stream_generator(
    token_address: str,
    redis_service: RedisService
):
    """Generate SSE stream for price updates"""
    pubsub = None
    try:
        # Subscribe to price updates from Redis
        channel = f"price:{token_address}"
        pubsub = await redis_service.get_pubsub()
        await pubsub.subscribe(channel)
        
        # Send initial connection message
        yield f"data: {json.dumps({'type': 'connected', 'token': token_address})}\n\n"
        
        # Stream updates
        async for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    data = json.loads(message['data'])
                    sse_data = json.dumps({
                        'type': 'price_update',
                        'token': token_address,
                        'data': data,
                        'timestamp': datetime.utcnow().isoformat(),
                    })
                    yield f"data: {sse_data}\n\n"
                except Exception as e:
                    logger.error(f"Error processing SSE message: {e}")
    
    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for {token_address}")
    except Exception as e:
        logger.error(f"SSE stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe(channel)
            except:
                pass


@router.get("/price/{token_address}")
async def stream_price_updates(token_address: str, request: Request):
    """Stream real-time price updates via SSE"""
    redis_service = await get_redis_service()
    
    return StreamingResponse(
        price_stream_generator(token_address, redis_service),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


async def market_data_stream_generator(
    symbol: str,
    redis_service: RedisService
):
    """Generate SSE stream for market data updates"""
    pubsub = None
    try:
        channel = f"market:{symbol}"
        pubsub = await redis_service.get_pubsub()
        await pubsub.subscribe(channel)
        
        yield f"data: {json.dumps({'type': 'connected', 'symbol': symbol})}\n\n"
        
        async for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    data = json.loads(message['data'])
                    sse_data = json.dumps({
                        'type': 'market_update',
                        'symbol': symbol,
                        'data': data,
                        'timestamp': datetime.utcnow().isoformat(),
                    })
                    yield f"data: {sse_data}\n\n"
                except Exception as e:
                    logger.error(f"Error processing SSE message: {e}")
    
    except asyncio.CancelledError:
        logger.info(f"SSE market stream cancelled for {symbol}")
    except Exception as e:
        logger.error(f"SSE market stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe(channel)
            except:
                pass


@router.get("/market/{symbol}")
async def stream_market_data(symbol: str, request: Request):
    """Stream real-time market data via SSE"""
    redis_service = await get_redis_service()
    
    return StreamingResponse(
        market_data_stream_generator(symbol, redis_service),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


async def pulse_stream_generator(
    category: Optional[str],
    redis_service: RedisService
):
    """Generate SSE stream for Pulse updates"""
    pubsub = None
    channels = []
    try:
        if category:
            channels = [f"pulse:{category}"]
        else:
            channels = ["pulse:new_pairs", "pulse:final_stretch", "pulse:migrated"]
        
        pubsub = await redis_service.get_pubsub()
        for channel in channels:
            await pubsub.subscribe(channel)
        
        yield f"data: {json.dumps({'type': 'connected', 'categories': channels})}\n\n"
        
        async for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    data = json.loads(message['data'])
                    sse_data = json.dumps({
                        'type': 'pulse_update',
                        'data': data,
                        'timestamp': datetime.utcnow().isoformat(),
                    })
                    yield f"data: {sse_data}\n\n"
                except Exception as e:
                    logger.error(f"Error processing Pulse SSE message: {e}")
    
    except asyncio.CancelledError:
        logger.info("SSE Pulse stream cancelled")
    except Exception as e:
        logger.error(f"SSE Pulse stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        if pubsub and channels:
            try:
                for channel in channels:
                    await pubsub.unsubscribe(channel)
            except:
                pass


@router.get("/pulse")
async def stream_pulse_updates(category: Optional[str] = None, request: Request = None):
    """Stream Axiom Pulse updates via SSE"""
    redis_service = await get_redis_service()
    
    return StreamingResponse(
        pulse_stream_generator(category, redis_service),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
