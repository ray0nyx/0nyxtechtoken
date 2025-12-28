# OAuth Setup Guide for Exchange Integration

This guide explains how to set up OAuth credentials for different cryptocurrency exchanges to enable automatic trade synchronization.

## 🔑 **Exchange-Specific Setup**

### **1. Coinbase Pro OAuth Setup**

**Step 1: Create Coinbase Developer Application**
1. Go to [Coinbase Developer Portal](https://developers.coinbase.com/)
2. Sign in with your Coinbase account
3. Click "Create an Application"
4. Fill in the application details:
   - **Name**: `WagYu Trade Sync`
   - **Description**: `Automatic trade synchronization for WagYu platform`
   - **Redirect URI**: `http://localhost:8080/auth/coinbase/callback` (for development)
   - **Redirect URI**: `https://yourdomain.com/auth/coinbase/callback` (for production)

**Step 2: Get OAuth Credentials**
1. After creating the application, you'll get:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value
2. Update your `.env` file:
   ```env
   VITE_COINBASE_CLIENT_ID=your_actual_client_id_here
   VITE_COINBASE_CLIENT_SECRET=your_actual_client_secret_here
   ```

**Step 3: Configure Scopes**
The application requests these scopes:
- `wallet:accounts:read` - Read account information
- `wallet:transactions:read` - Read transaction history

### **2. Kraken OAuth Setup**

**Step 1: Create Kraken OAuth Application**
1. Go to [Kraken Developer Portal](https://www.kraken.com/features/api)
2. Sign in to your Kraken account
3. Navigate to "OAuth Applications" or "API Management"
4. Click "Create New Application" or "Register OAuth App"
5. Fill in the application details:
   - **Application Name**: `WagYu Trade Sync`
   - **Description**: `Automatic trade synchronization for WagYu platform`
   - **Redirect URI**: `http://localhost:8080/auth/kraken/callback` (for development)
   - **Redirect URI**: `https://yourdomain.com/auth/kraken/callback` (for production)

**Step 2: Get OAuth Credentials**
1. After creating the application, you'll get:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value (keep this secure!)
2. Update your `.env` file:
   ```env
   VITE_KRAKEN_CLIENT_ID=your_actual_client_id
   VITE_KRAKEN_CLIENT_SECRET=your_actual_client_secret
   ```

**Step 3: Configure Scopes**
The application requests these scopes:
- `account.info:basic` - See your account information
- `account.fast-api-key:funds-query` - See your account balance
- `account.fast-api-key:trades-query-open` - View open orders & trades
- `account.fast-api-key:trades-query-closed` - View closed orders & trades
- `account.fast-api-key:ledger-query` - View your ledger history

**Step 4: Test OAuth Flow**
1. Go to `/app/quanttesting` in your WagYu app
2. Click on the "Kraken" tab
3. Click "Connect" on the Kraken card
4. You'll be redirected to Kraken's OAuth page
5. Authorize the application
6. You'll be redirected back with a success message

### **3. Binance API Setup**

**Note**: Binance also uses API keys, not OAuth2.

**Step 1: Create Binance API Key**
1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Sign in to your Binance account
3. Click "Create API"
4. Choose "System generated" for API key type
5. Set API restrictions:
   - ✅ **Enable Reading** - Required for account and trade data
   - ✅ **Enable Spot & Margin Trading** - Required for trade history
   - ❌ **Enable Futures** - Optional, only if you trade futures
   - ❌ **Enable Withdrawals** - Not needed for read-only access

**Step 2: Get API Credentials**
1. After creating the key, you'll get:
   - **API Key**: Copy this value
   - **Secret Key**: Copy this value (only shown once!)

**Step 3: Configure IP Restrictions (Recommended)**
1. Add your server's IP address to the whitelist
2. For development: Add your local IP
3. For production: Add your server's IP

### **4. Other Exchanges**

**Bybit, OKX, Bitget, Huobi, Gate.io, MEXC**
- These exchanges also use API keys
- Follow similar setup process as Binance
- Create API keys with read-only permissions
- No OAuth2 setup required

## 🚀 **Testing the Integration**

### **1. Development Testing**
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `/app/trades`
3. Click "Sync Trades"
4. Select an exchange
5. Enter credentials
6. Click "Connect"

### **2. Expected Results**
- ✅ Connection established
- ✅ Database record created
- ✅ Trade sync initiated
- ✅ Trades appear in your trades page

### **3. Troubleshooting**

**Common Issues:**
- **"Invalid credentials"**: Check API key and secret
- **"Insufficient permissions"**: Enable required permissions
- **"IP not whitelisted"**: Add your IP to exchange whitelist
- **"Rate limit exceeded"**: Wait and try again

## 🔒 **Security Best Practices**

### **1. API Key Security**
- ✅ Use read-only permissions only
- ✅ Enable IP restrictions
- ✅ Rotate keys regularly
- ✅ Never share keys in code or logs

### **2. Environment Variables**
- ✅ Store credentials in `.env` file
- ✅ Never commit `.env` to version control
- ✅ Use different keys for development/production

### **3. Database Security**
- ✅ Credentials are encrypted before storage
- ✅ Only accessible by authenticated users
- ✅ Automatic cleanup of expired tokens

## 📋 **Environment Variables Reference**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Coinbase OAuth (if using OAuth flow)
VITE_COINBASE_CLIENT_ID=your_coinbase_client_id
VITE_COINBASE_CLIENT_SECRET=your_coinbase_client_secret
VITE_KRAKEN_CLIENT_ID=your_kraken_client_id
VITE_KRAKEN_CLIENT_SECRET=your_kraken_client_secret

# API Keys (for direct API access - legacy)
VITE_BINANCE_API_KEY=your_binance_api_key
VITE_BINANCE_SECRET_KEY=your_binance_secret_key
VITE_KRAKEN_API_KEY=your_kraken_api_key
VITE_KRAKEN_SECRET_KEY=your_kraken_secret_key
VITE_KRAKEN_PASSPHRASE=your_kraken_passphrase
```

## 🆘 **Support**

If you encounter issues:
1. Check the browser console for errors
2. Verify your API credentials
3. Ensure proper permissions are enabled
4. Check IP whitelist settings
5. Contact support with specific error messages

## 🔄 **OAuth Flow Diagram**

```
User clicks "Sync Trades" 
    ↓
Selects Exchange
    ↓
For Coinbase: Redirects to OAuth
For Others: Shows API key form
    ↓
User enters credentials
    ↓
Validates with exchange API
    ↓
Saves encrypted credentials
    ↓
Starts trade synchronization
    ↓
Trades appear in dashboard
```

This setup enables secure, automatic trade synchronization with major cryptocurrency exchanges while maintaining the highest security standards.
