#!/bin/bash

echo "🚀 Starting WagYu Market Data Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "python-backend" ]; then
    echo "❌ python-backend directory not found. Please run this script from the WagYu root directory."
    exit 1
fi

# Navigate to python-backend directory
cd python-backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Virtual environment not found. Setting up..."
    ./setup.sh
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
if [ ! -f "venv/pyvenv.cfg" ]; then
    echo "📚 Installing requirements..."
    pip install -r requirements.txt
fi

# Start the service
echo "🚀 Starting market data service..."
echo "📊 API will be available at: http://localhost:8001"
echo "📖 API docs at: http://localhost:8001/docs"
echo "🛑 Press Ctrl+C to stop the service"
echo ""

python start.py
