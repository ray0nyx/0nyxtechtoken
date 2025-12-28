#!/usr/bin/env python3
"""
Run WagyuTech API Server
"""

import sys
import os
import uvicorn
import socket

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

def is_port_in_use(port: int) -> bool:
    """Check if a port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

if __name__ == "__main__":
    port = int(os.getenv("WAGYU_API_PORT", 8002))
    
    # Check if port is in use
    if is_port_in_use(port):
        print(f"⚠️  Port {port} is already in use!")
        print(f"   To use a different port, set WAGYU_API_PORT environment variable")
        print(f"   Example: WAGYU_API_PORT=8003 python3 run_wagyu_api.py")
        print(f"\n   Or kill the process using port {port}:")
        print(f"   lsof -ti:{port} | xargs kill -9")
        sys.exit(1)
    
    print(f"🚀 Starting WagyuTech API server on port {port}...")
    print(f"📡 API will be available at http://localhost:{port}")
    print(f"📚 API docs will be available at http://localhost:{port}/docs\n")
    
    # Run the FastAPI app
    uvicorn.run(
        "services.wagyu_api.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
