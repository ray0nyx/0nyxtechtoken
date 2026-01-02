import aiohttp
import asyncio
import json
import os
import sys

# Add parent dir to path to import config if needed, or just mock it
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def check_apis():
    print("----- Checking DexScreener -----")
    async with aiohttp.ClientSession() as session:
        try:
            url = "https://api.dexscreener.com/latest/dex/search?q=Raydium"
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    pairs = data.get("pairs", [])
                    if pairs:
                        print("Sample Pair Keys:", pairs[0].keys())
                        print("Info Keys:", pairs[0].get("info", {}).keys())
                        # Check typical holder fields
                        print("Holder info found?", "holders" in str(pairs[0]).lower())
                    else:
                        print("No pairs found")
        except Exception as e:
            print(f"DexScreener failed: {e}")

    print("\n----- Checking Birdeye -----")
    # Need API Key
    api_key = os.environ.get("BIRDEYE_API_KEY")
    if not api_key:
        print("No BIRDEYE_API_KEY found in env")
        # Try to read from .env manually just in case
        try:
            with open("../.env", "r") as f:
                for line in f:
                    if line.startswith("BIRDEYE_API_KEY="):
                        api_key = line.strip().split("=")[1]
                        break
        except:
            pass
    
    if api_key:
        async with aiohttp.ClientSession() as session:
            try:
                url = "https://public-api.birdeye.so/defi/tokenlist"
                headers = {"X-API-KEY": api_key}
                params = {"sort_by": "mc", "sort_type": "desc", "limit": 1}
                async with session.get(url, headers=headers, params=params) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        tokens = data.get("data", {}).get("tokens", [])
                        if tokens:
                            print("Sample Token Keys:", tokens[0].keys())
                            print("Holder field:", tokens[0].get("holder"))
                        else:
                            print("No tokens found")
                    else:
                        print(f"Birdeye status: {resp.status}")
            except Exception as e:
                print(f"Birdeye failed: {e}")
    else:
        print("Skipping Birdeye check (no key)")

if __name__ == "__main__":
    asyncio.run(check_apis())
