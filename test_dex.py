import aiohttp
import asyncio
import json

async def test_dex():
    url = "https://api.dexscreener.com/latest/dex/search"
    params = {"q": "Raydium"}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as resp:
            data = await resp.json()
            pairs = data.get("pairs") or []
            print(f"Total pairs: {len(pairs)}")
            solana_pairs = [p for p in pairs if p.get("chainId") == "solana"]
            print(f"Solana pairs: {len(solana_pairs)}")
            if solana_pairs:
                first = solana_pairs[0]
                mc = first.get("fdv") or first.get("marketCap") or 0
                print(f"First pair MC: {mc} (type: {type(mc)})")

if __name__ == "__main__":
    asyncio.run(test_dex())
