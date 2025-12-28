#!/usr/bin/env python3
"""
Startup script for the market data service
"""
import uvicorn
import os
import sys
from pathlib import Path

# Add the current directory to Python path
sys.path.append(str(Path(__file__).parent))

from config import settings

if __name__ == "__main__":
    print("🚀 Starting WagYu Market Data Service...")
    print(f"📊 Host: {settings.host}")
    print(f"🔌 Port: {settings.port}")
    print(f"🐛 Debug: {settings.debug}")
    print(f"📈 Data Sources: {settings.preferred_data_source}")
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
