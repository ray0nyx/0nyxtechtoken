#!/usr/bin/env python3
"""
Test script for crypto API integration
"""

import asyncio
import sys
import os

# Add the python-backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'python-backend'))

from services.market_data_service import MarketDataService

async def test_crypto_api():
    """Test the crypto API integration"""
    print("🚀 Testing Crypto API Integration")
    print("=" * 50)
    
    # Initialize the market data service
    service = MarketDataService()
    await service.initialize()
    
    try:
        # Test 1: Get supported exchanges
        print("\n1. Testing supported exchanges...")
        exchanges = await service.get_supported_exchanges()
        crypto_exchanges = [ex for ex in exchanges if ex.id == "crypto_api"]
        
        if crypto_exchanges:
            print(f"✅ Crypto API exchange found: {crypto_exchanges[0].name}")
            print(f"   Symbols: {crypto_exchanges[0].symbols[:5]}...")  # Show first 5
            print(f"   Timeframes: {crypto_exchanges[0].timeframes}")
        else:
            print("❌ Crypto API exchange not found")
        
        # Test 2: Test crypto symbol detection
        print("\n2. Testing crypto symbol detection...")
        test_symbols = ["BTC/USDT", "ETH/USDT", "AAPL", "MSFT"]
        for symbol in test_symbols:
            is_crypto = service._is_crypto_symbol(symbol)
            print(f"   {symbol}: {'✅ Crypto' if is_crypto else '❌ Not crypto'}")
        
        # Test 3: Test crypto OHLCV data fetching
        print("\n3. Testing crypto OHLCV data fetching...")
        try:
            crypto_data = await service.fetch_crypto_ohlcv("BTC/USDT", "1h", 10)
            print(f"✅ Successfully fetched {len(crypto_data)} crypto data points")
            if crypto_data:
                print(f"   First data point: {crypto_data[0]}")
        except Exception as e:
            print(f"❌ Crypto data fetch failed: {e}")
        
        # Test 4: Test general OHLCV with crypto priority
        print("\n4. Testing general OHLCV with crypto priority...")
        try:
            general_data = await service.get_ohlcv("BTC/USDT", "1h", 5)
            print(f"✅ Successfully fetched {len(general_data)} data points via general method")
            if general_data:
                print(f"   First data point: {general_data[0]}")
        except Exception as e:
            print(f"❌ General OHLCV fetch failed: {e}")
        
        print("\n" + "=" * 50)
        print("🎉 Crypto API integration test completed!")
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
    finally:
        await service.cleanup()

if __name__ == "__main__":
    asyncio.run(test_crypto_api())




