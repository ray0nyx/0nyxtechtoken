#!/bin/bash

echo "🚀 Setting up WagYu Market Data Service..."

# Check if Python 3.8+ is installed
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ is required. Current version: $python_version"
    exit 1
fi

echo "✅ Python version: $python_version"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing requirements..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating .env file..."
    cat > .env << EOF
# API Keys for Free Market Data Services
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
POLYGON_API_KEY=your_polygon_key_here
FINNHUB_API_KEY=your_finnhub_key_here

# Redis Configuration (for caching)
REDIS_URL=redis://localhost:6379

# Server Configuration
HOST=0.0.0.0
PORT=8001
DEBUG=True

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
MAX_CONCURRENT_REQUESTS=10

# Data Sources Priority
PREFERRED_DATA_SOURCE=alpha_vantage
FALLBACK_DATA_SOURCES=yfinance,ccxt
EOF
    echo "📝 Please edit .env file with your API keys"
fi

echo "✅ Setup complete!"
echo ""
echo "🔑 To get free API keys:"
echo "   • Alpha Vantage: https://www.alphavantage.co/support/#api-key"
echo "   • Polygon.io: https://polygon.io/pricing"
echo "   • Finnhub: https://finnhub.io/register"
echo ""
echo "🚀 To start the service:"
echo "   source venv/bin/activate"
echo "   python start.py"
echo ""
echo "📊 API will be available at: http://localhost:8001"
echo "📖 API docs at: http://localhost:8001/docs"
