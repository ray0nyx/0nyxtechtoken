import aiohttp
import asyncio
import json
import os

async def check_birdeye():
    print("----- Checking Birdeye -----")
    api_key = None
    try:
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("BIRDEYE_API_KEY="):
                    api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                    break
    except FileNotFoundError:
        print(".env file not found in current dir")
        
    if not api_key:
        # Try parent dir
        try:
            with open("../.env", "r") as f:
                for line in f:
                    if line.startswith("BIRDEYE_API_KEY="):
                        api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                        break
        except:
            pass

    if api_key:
        print(f"API Key found: {api_key[:4]}...")
        async with aiohttp.ClientSession() as session:
            try:
                url = "https://public-api.birdeye.so/defi/tokenlist"
                headers = {"X-API-KEY": api_key, "accept": "application/json"}
                # Sort by v24hUSD to get active tokens
                params = {"sort_by": "v24hUSD", "sort_type": "desc", "limit": 5}
                async with session.get(url, headers=headers, params=params) as resp:
                    print(f"Status: {resp.status}")
                    if resp.status == 200:
                        data = await resp.json()
                        tokens = data.get("data", {}).get("tokens", [])
                        if tokens:
                            t = tokens[0]
                            print("Sample Token Keys:", t.keys())
                            print(f"Holder field value: {t.get('holder')}")
                        else:
                            print("No tokens found")
                    else:
                        text = await resp.text()
                        print(f"Error: {text}")
            except Exception as e:
                print(f"Birdeye failed: {e}")
    else:
        print("Still no API key found")

if __name__ == "__main__":
    asyncio.run(check_birdeye())
