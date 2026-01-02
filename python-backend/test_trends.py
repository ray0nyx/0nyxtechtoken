import aiohttp
import asyncio
import os
import sys

# Define the fetch logic here to test it in isolation
async def test_fetch():
    print("🔍 Starting test_fetch...")
    
    # Try DexScreener fallback logic directly since that's what we expect to work if Birdeye key is missing/limited
    try:
        print("🔍 Trying DexScreener fallback for trending tokens (Query: Raydium)...")
        url = "https://api.dexscreener.com/latest/dex/search"
        params = {"q": "Raydium"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    tokens = []
                    pairs = data.get("pairs") or []
                    
                    valid_pairs = [p for p in pairs if p and p.get("chainId") == "solana"]
                    print(f"🔍 DexScreener returned {len(valid_pairs)} Solana pairs")
                    
                    valid_pairs.sort(key=lambda x: float(x.get("volume", {}).get("h24") or 0), reverse=True)
                    
                    for pair in valid_pairs:
                        base = pair.get("baseToken") or {}
                        mc = float(pair.get("fdv") or pair.get("marketCap") or 0)
                        
                        # Market Cap Filter
                        if mc < 50000:
                            print(f"Skipping {base.get('symbol')} (MC: {mc})")
                            continue
                            
                        # Pump check
                        if "pump" in (base.get("name") or "").lower():
                             print(f"Skipping {base.get('symbol')} (Pump token)")
                             continue
                             
                        tokens.append({
                            "symbol": base.get("symbol"),
                            "mc": mc
                        })
                    
                    print(f"✅ Found {len(tokens)} qualifying tokens")
                    return tokens
                else:
                    print(f"DexScreener Status: {resp.status}")
    except Exception as e:
        print(f"DexScreener Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_fetch())
