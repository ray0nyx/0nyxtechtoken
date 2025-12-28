# Environment Configuration

## Required Environment Variables

### QuickNode RPC Endpoint
```bash
QUICKNODE_RPC_URL=https://misty-alien-panorama.soneium-mainnet.quiknode.pro/31ceef5941b0811baf68fff3e4884c002c2a9b2e
```
Used for:
- Jupiter price fetching via Solana RPC
- On-chain monitoring (Pump.fun migrations, new tokens)
- Transaction monitoring

### Supabase Configuration
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
Required for API key authentication and database operations.

## Optional Environment Variables

### Jupiter Price API
```bash
JUPITER_PRICE_API_URL=https://price.jup.ag/v4
```
Default is already set in code. Only override if using a different endpoint.

### Moralis API (Backup Price Data)
```bash
MORALIS_API_KEY=your_moralis_api_key
```

### Birdeye API (Primary for Pump.fun Tokens)
```bash
BIRDEYE_API_KEY=your_birdeye_api_key
```
**Birdeye is the recommended primary source for Pump.fun token prices.**

Endpoints used:
- Token Price: `https://public-api.birdeye.so/v1/token/price?address={token_address}`
- Token Overview: `https://public-api.birdeye.so/v1/token/overview?address={token_address}`

Headers required: `X-API-KEY: {BIRDEYE_API_KEY}`

Rate limits: Check Birdeye documentation (typically 100-1000 req/min depending on plan)

### Redis Configuration (Caching)
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```
If not configured, in-memory caching will be used.

### Social Media Monitoring
```bash
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## Frontend Environment Variables

Add to `.env.local`:

```bash
# QuickNode RPC Endpoint (optional - for direct Solana RPC calls)
VITE_QUICKNODE_RPC_URL=https://misty-alien-panorama.soneium-mainnet.quiknode.pro/31ceef5941b0811baf68fff3e4884c002c2a9b2e

# WagyuTech API URL
VITE_WAGYU_API_URL=http://localhost:8002
```

## Setup Instructions

1. Copy `.env.example` to `.env` in `python-backend/` directory
2. Fill in your API keys and configuration
3. For frontend, copy `.env.local.example` to `.env.local` in project root
4. Restart the API server after changing environment variables
