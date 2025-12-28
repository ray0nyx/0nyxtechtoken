#!/bin/bash

# Configuration
API_URL="http://localhost:8080/api/trade/execute"

# Sample Trade Request
TRADE_DATA='{
  "mint": "So11111111111111111111111111111111111111112",
  "amount": 1000000000,
  "side": "buy",
  "price": 100000000
}'

echo "Sending trade request to Rust HFT Engine..."
curl -X POST $API_URL \
     -H "Content-Type: application/json" \
     -d "$TRADE_DATA"

echo -e "\n\nCheck the Rust backend logs to see the HFT pipeline processing the event on its pinned core."

