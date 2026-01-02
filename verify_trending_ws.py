import asyncio
import websockets
import json
import time

async def test_trending_ws():
    uri = "ws://127.0.0.1:8001/ws/trending-tokens"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Send initial handshake/ping
            await websocket.send(json.dumps({"type": "ping"}))
            print("Sent user ping")

            start_time = time.time()
            timeout = 15 
            
            while time.time() - start_time < timeout:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    msg_type = data.get("type", "unknown")
                    print(f"Received: {msg_type} - {str(data)[:100]}...")
                    
                    if msg_type in ["initial_tokens", "trending_update"]:
                        tokens = data.get("tokens", [])
                        print(f"✅ Success! Got {len(tokens)} tokens.")
                        return True
                        
                except asyncio.TimeoutError:
                    print("Waiting for message...")
                    # Send a refresh request if we haven't heard anything
                    await websocket.send(json.dumps({"type": "refresh"}))
                    print("Sent manual refresh request")
                    continue
            
            print("❌ Timeout waiting for token data.")
            return False
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_trending_ws())
