
import asyncio
import aiohttp

async def test_problematic_urls():
    proxy_url = "http://localhost:8001/api/proxy/image"
    urls = [
        "https://metadata.j7tracker.com/metadata/17198da43f7a4d41.json",
        "https://gateway.pinata.cloud/ipfs/QmekCpn92JaK4PbGgjsMD786FoiEsRtr35JxGq8tGjL33a", # Same CID via Pinata
        "https://ipfs.io/ipfs/QmekCpn92JaK4PbGgjsMD786FoiEsRtr35JxGq8tGjL33a", # Same CID via ipfs.io
        "https://cf-ipfs.com/ipfs/QmekCpn92JaK4PbGgjsMD786FoiEsRtr35JxGq8tGjL33a", # Problematic CID via cf-ipfs.com
        "http://93.205.10.67:4141/metadata/0T56ebx8"
    ]

    async with aiohttp.ClientSession() as session:
        for url in urls:
            print(f"\nTesting URL: {url}")
            try:
                test_url = f"{proxy_url}?url={url}"
                async with session.get(test_url) as response:
                    print(f"Proxy Status: {response.status}")
                    content_type = response.headers.get('Content-Type')
                    print(f"Content-Type: {content_type}")
                    if response.status == 200:
                        content = await response.read()
                        print(f"Size: {len(content)}")
                        if "json" in content_type:
                            print(f"Body: {content.decode()[:200]}")
                    else:
                        print(f"Error Body: {await response.text()}")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_problematic_urls())
