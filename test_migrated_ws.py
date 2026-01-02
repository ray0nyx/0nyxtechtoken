import asyncio
import websockets
import json

async def test_migrated_ws():
    print("Testing /ws/migrated-tokens endpoint...")
    uri = "ws://127.0.0.1:8001/ws/migrated-tokens"
    
    try:
        async with websockets.connect(uri, ping_interval=None) as ws:
            print("✅ Connected!")
            
            # Wait for initial messages
            for i in range(5):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    msg_type = data.get("type", "unknown")
                    print(f"Received: {msg_type}")
                    
                    if msg_type == "initial_tokens":
                        tokens = data.get("tokens", [])
                        print(f"  → Got {len(tokens)} initial tokens")
                        if tokens:
                            print(f"  → Sample: {tokens[0].get('symbol', 'N/A')} (MC: {tokens[0].get('usd_market_cap', 0)})")
                        return len(tokens)
                    elif msg_type == "connected":
                        print(f"  → {data.get('message')}")
                    elif msg_type == "stream_status":
                        print(f"  → Stream connected: {data.get('connected')}")
                except asyncio.TimeoutError:
                    print("  → Timeout waiting for message")
                    break
                    
    except Exception as e:
        print(f"❌ Error: {e}")
        return 0

if __name__ == "__main__":
    result = asyncio.run(test_migrated_ws())
    print(f"\nResult: {result} tokens received")
