import aiohttp
import asyncio
import json

async def test_dex():
    url = "https://api.dexscreener.com/latest/dex/tokens/solana"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            print(f"Status: {resp.status}")
            if resp.status == 200:
                data = await resp.json()
                pairs = data.get("pairs") or []
                print(f"Total pairs: {len(pairs)}")
                if pairs:
                    first = pairs[0]
                    print(f"First pair Chain: {first.get('chainId')}")
                    print(f"First pair MC: {first.get('fdv') or first.get('marketCap')}")

if __name__ == "__main__":
    asyncio.run(test_dex())
