# Solana Integration - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Apply Database Migrations
Option A - Using Supabase CLI:
```bash
supabase db push
```

Option B - Manual (Supabase Studio):
1. Go to SQL Editor in Supabase Dashboard
2. Run `supabase/migrations/add_master_traders_table.sql`
3. Run `supabase/migrations/add_copy_trades_table.sql`

### Step 3: Start Development Server
```bash
npm run dev
```

---

## 📱 Using the Features

### Connect Your Wallet
1. Navigate to **Crypto Analytics** → **Solana DEX Analytics** tab
2. Click **"Connect Wallet"** button
3. Choose Phantom or Solflare
4. Approve the connection

### Import Your DEX Trades
1. After connecting wallet, click **"Import Trades"**
2. Wait for parsing (may take 30-60 seconds)
3. View imported trades and metrics

### Discover Master Traders
1. Navigate to **Crypto Analytics** → **Wallet Copier** tab
2. Browse the 12 curated profitable wallets
3. Use filters to find traders matching your strategy:
   - **Risk Level**: Low, Medium, High
   - **Tags**: Whale, Arbitrage, DeFi, Memecoin, etc.
   - **Min Win Rate**: Set minimum percentage
   - **Verified Only**: Show only verified traders

### Follow & Copy Traders
1. Click **"Follow"** on any master trader
2. Go to **"Following"** tab
3. Click the bell icon to enable copy trading notifications
4. Configure your settings in **"Settings"** tab

---

## ⚙️ Copy Trading Settings

### Essential Settings
- **Default Copy Mode**: Manual (notifications) or Auto (requires approval)
- **Max Copy Amount**: Maximum $ per trade
- **Position Size**: % of portfolio to copy
- **Max Daily Trades**: Limit number of copies per day

### Risk Management
- **Slippage Tolerance**: % slippage allowed
- **Max Price Impact**: Maximum acceptable impact
- **Stop-Loss**: Auto-exit at loss threshold
- **Notifications**: Enable/disable alerts

---

## 🧪 Testing

### Test Solana Connection
Open browser console and run:
```javascript
// Test all functionality
window.testSolana.runAll('YOUR_WALLET_ADDRESS')

// Or test individually
window.testSolana.testConnection()
```

### Manual Test Checklist
- [ ] Wallet connects successfully
- [ ] Balance displays correctly
- [ ] Trades import without errors
- [ ] Master traders load (12 shown)
- [ ] Filters work correctly
- [ ] Can follow/unfollow traders
- [ ] Copy settings save properly

---

## 🎯 What's Included

### 12 Curated Master Traders
Each trader includes:
- Real Solana wallet address
- Estimated 30-day P&L
- Win rate percentage
- Total trades count
- Risk level (low/medium/high)
- Relevant tags and description
- Verification status

### Supported DEXs
- ✅ Jupiter (aggregator)
- ✅ Raydium (AMM)
- ✅ Orca (concentrated liquidity)
- ✅ Meteora (dynamic pools)

### Key Features
- Real-time wallet balance
- Transaction history parsing
- Trade import with deduplication
- Advanced filtering system
- Follow/unfollow functionality
- Copy trading modes (manual/auto)
- Risk management settings
- Trade execution tracking

---

## ❓ FAQ

### Q: Do I need to pay for RPC access?
**A:** No, the public RPC works fine. However, for production or heavy usage, consider:
- Alchemy: 300M compute units/month free
- Helius: 100k requests/month free
- QuickNode: Paid plans from $9/month

### Q: Is my wallet secure?
**A:** Yes! Private keys never leave your wallet. All transactions require your approval.

### Q: Can copy trading execute automatically?
**A:** Not yet. Auto mode requires Jupiter API integration (coming soon). Currently, manual mode shows notifications.

### Q: How often does it check for new trades?
**A:** The monitoring service checks every 30 seconds by default.

### Q: Can I copy multiple traders at once?
**A:** Yes! Follow as many traders as you want and enable copy trading for each.

### Q: What if a master trader loses money?
**A:** You can:
- Set stop-loss limits
- Set max copy amount
- Unfollow anytime
- Disable copy trading instantly

---

## 🐛 Common Issues

### Issue: Wallet button doesn't appear
**Fix**: Make sure `npm install` completed successfully

### Issue: "Connect Wallet" button unresponsive
**Fix**: 
1. Install Phantom or Solflare browser extension
2. Refresh the page
3. Check browser console for errors

### Issue: No trades imported
**Fix**:
1. Verify your wallet has DEX transaction history
2. Ensure transactions are from supported DEXs
3. Try reducing import limit
4. Check RPC connection

### Issue: Master traders not showing
**Fix**:
1. Verify database migrations ran successfully
2. Check browser console for errors
3. Clear filters and search query

---

## 📞 Support

### Check These First
1. **Browser Console**: Look for error messages
2. **Network Tab**: Check failed API requests
3. **Supabase Logs**: View database errors
4. **RPC Status**: Verify Solana network is operational

### Debug Mode
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'solana:*')
```

---

## 🎉 You're All Set!

Start by:
1. Connecting your wallet
2. Importing some trades
3. Exploring the 12 curated master traders
4. Following traders that match your strategy
5. Configuring your copy settings

**Happy Trading!** 🚀

---

*For detailed technical information, see [SOLANA_INTEGRATION_COMPLETE.md](./SOLANA_INTEGRATION_COMPLETE.md)*

