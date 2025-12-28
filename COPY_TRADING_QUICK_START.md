# Copy Trading Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you test the copy trading system that's been implemented.

---

## Step 1: Apply Database Migrations

First, apply all the new database tables:

```bash
cd /Users/rayhan/Documents/Github\ Repos\ and\ Projects/WagYu

# Push migrations to Supabase
supabase db push

# Or if using Supabase CLI
npx supabase db push
```

**Expected Output:** Should see 6 new migrations applied successfully.

---

## Step 2: Verify Dependencies

Make sure all packages are installed:

```bash
npm install
```

**Key Dependencies:**
- `@jup-ag/api` - Jupiter DEX aggregator
- `bs58` - Base58 encoding
- `@solana/web3.js` - Solana web3
- `@solana/wallet-adapter-react` - Wallet connection

---

## Step 3: Start the Dev Server

```bash
npm run dev
```

Visit `http://localhost:5173` (or your configured port).

---

## Step 4: Access Copy Trading

1. **Navigate to Copy Trading:**
   - Click on "Crypto Analytics" in the sidebar
   - Click on the "Copy Trading" tab

2. **Connect Wallet:**
   - Click "Connect Wallet" button
   - Select Phantom, Solflare, or another Solana wallet
   - Approve the connection

---

## Step 5: Explore the Interface

### View the Leaderboard

1. Click **"Find Traders to Copy"** button
2. You should see:
   - Search bar (search by wallet address)
   - Filter dropdowns (sort by ROI, P&L, win rate, etc.)
   - Stats summary cards at bottom

**Note:** The leaderboard will be empty initially. You need to analyze traders first (see Step 6).

### Dashboard Overview

The main dashboard shows 4 tabs:
- **Active Copies** - Your copy trading configurations
- **Pending** - Trades awaiting approval
- **Positions** - Open positions
- **History** - Closed positions

---

## Step 6: Populate the Leaderboard (Testing)

To test the system, you need to analyze some Solana wallets and add them to the leaderboard.

### Option A: Manual Analysis via Browser Console

1. Open browser console (F12)
2. Navigate to Copy Trading tab
3. Run this code:

```javascript
// Import required modules
import { Connection } from '@solana/web3.js';
import { analyzeTraderPerformance, updateTraderLeaderboard } from '/src/lib/trader-performance-tracker';

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Example profitable wallet addresses (replace with real ones)
const tradersToAnalyze = [
  '7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi', // Example
  '8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6', // Example
  // Add more wallet addresses here
];

// Analyze each trader
for (const wallet of tradersToAnalyze) {
  try {
    console.log(`Analyzing ${wallet}...`);
    const metrics = await analyzeTraderPerformance(connection, wallet, 100);
    
    if (metrics) {
      await updateTraderLeaderboard(metrics);
      console.log(`✓ Added ${wallet} to leaderboard`);
      console.log(`  ROI: ${metrics.roi.toFixed(2)}%`);
      console.log(`  Win Rate: ${metrics.win_rate.toFixed(1)}%`);
      console.log(`  Total Trades: ${metrics.total_trades}`);
    } else {
      console.log(`✗ No trades found for ${wallet}`);
    }
  } catch (error) {
    console.error(`Error analyzing ${wallet}:`, error);
  }
  
  // Wait 2 seconds between analyses to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log('Analysis complete! Refresh the leaderboard.');
```

### Option B: Use Pre-populated Curated List

The system already has a curated list of profitable traders. To use them:

```javascript
import { CURATED_MASTER_TRADERS } from '/src/data/curated-master-traders';
import { Connection } from '@solana/web3.js';
import { batchAnalyzeTraders } from '/src/lib/trader-performance-tracker';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const walletAddresses = CURATED_MASTER_TRADERS.map(t => t.wallet);

// Analyze all curated traders
const result = await batchAnalyzeTraders(connection, walletAddresses);
console.log(`Success: ${result.success}, Failed: ${result.failed}`);
```

### Option C: Manual Database Insert (Fastest for Testing)

Directly insert test data into Supabase:

```sql
-- Open Supabase Studio → SQL Editor
-- Run this query:

INSERT INTO copy_trading_leaderboard (
  wallet_address,
  blockchain,
  total_pnl,
  roi,
  win_rate,
  total_trades,
  winning_trades,
  losing_trades,
  max_drawdown,
  sharpe_ratio,
  risk_score,
  consistency_score,
  avg_position_size,
  largest_win,
  largest_loss,
  pnl_30d,
  roi_30d,
  trades_30d,
  is_active,
  is_verified
) VALUES
  ('7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi', 'solana', 15000, 75.5, 68.2, 150, 102, 48, 12.5, 1.8, 35, 72, 100, 500, 200, 5000, 25.3, 45, true, true),
  ('8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6', 'solana', 22000, 110.2, 72.8, 200, 146, 54, 15.3, 2.1, 42, 78, 110, 800, 250, 7500, 37.5, 60, true, false),
  ('9rKFCytX5bnKypJP6yV9NkwGqrk7g8h4wFN3vQgJDJh8', 'solana', 8500, 42.5, 62.1, 100, 62, 38, 18.7, 1.4, 48, 65, 85, 350, 180, 3000, 15.0, 30, true, false);

-- Refresh the leaderboard page to see results
```

---

## Step 7: Test Copy Trading Setup

1. **Select a Trader:**
   - From the leaderboard, click "Copy" on any trader
   - The setup modal should open

2. **Configure Settings:**

   **Position Sizing Tab:**
   - Set allocated capital: `$100`
   - Choose mode: "Proportional"
   - Set percentage: `10%`
   - Set max position size: `$50`

   **Risk Management Tab:**
   - Max slippage: `1%`
   - Max price impact: `3%`
   - Stop loss: `10%` (optional)
   - Take profit: `50%` (optional)
   - Max daily trades: `20`
   - Max daily loss: `$50` (optional)

   **Token Filters Tab:**
   - Leave whitelist/blacklist empty (copy all tokens)
   - Or add specific token addresses
   - Enable "Auto-Execute" if you want automatic copying
   - Set priority fee: `0.000005 SOL`

3. **Save & Activate:**
   - Click "Save & Activate" button
   - Should see success toast
   - Configuration saved to database

4. **Verify Configuration:**
   - Go back to dashboard
   - Check "Active Copies" tab
   - Should see your new configuration listed

---

## Step 8: Test the Monitoring Service (Background)

The monitoring service needs to run separately. Here's how to test it:

### Option A: Node Script

Create `test-monitor.js`:

```javascript
import { Connection } from '@solana/web3.js';
import { startCopyTradingMonitor } from './src/lib/copy-trading-monitor.js';

const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

console.log('Starting copy trading monitor...');
console.log('Press Ctrl+C to stop');

// Start monitoring every 30 seconds
const stopMonitoring = startCopyTradingMonitor(connection, 30000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping monitor...');
  stopMonitoring();
  process.exit(0);
});
```

Run it:

```bash
node test-monitor.js
```

### Option B: Browser Console (for quick testing)

In the Copy Trading dashboard, open console and run:

```javascript
import { Connection } from '@solana/web3.js';
import { monitorCopyTradingConfigs, createPendingCopyTrades } from '/src/lib/copy-trading-monitor';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Check for new opportunities
const opportunities = await monitorCopyTradingConfigs(connection);
console.log(`Found ${opportunities.length} copy opportunities`);

if (opportunities.length > 0) {
  const created = await createPendingCopyTrades(opportunities);
  console.log(`Created ${created} pending trades`);
}
```

---

## Step 9: Test Trade Execution (Manual)

⚠️ **Warning:** This will execute a real trade on Solana mainnet. Only use small amounts for testing!

1. **Get a Pending Trade:**
   - Monitoring service should create pending trades
   - Or manually insert into `pending_copy_trades` table

2. **Execute from Dashboard:**
   - Go to "Pending" tab
   - Click "Execute" button on a pending trade
   - Sign the transaction in your wallet
   - Wait for confirmation

3. **Verify Position:**
   - Go to "Positions" tab
   - Should see new open position
   - Check token pair, amount, opened timestamp

---

## Step 10: Test Position Closing

1. **Close a Position:**
   - Go to "Positions" tab
   - Click "Close Position" button
   - Sign the reverse swap transaction
   - Wait for confirmation

2. **Check History:**
   - Go to "History" tab
   - Should see closed position
   - P&L should be calculated
   - Win/loss displayed in green/red

---

## 🔍 Verification Checklist

Use this checklist to verify everything works:

### Database
- [ ] 15 new tables created in Supabase
- [ ] RLS policies enabled
- [ ] Triggers working (updated_at, follower_count, etc.)

### Leaderboard
- [ ] Traders displayed (after analysis)
- [ ] Sorting works (ROI, P&L, win rate, etc.)
- [ ] Filtering works (min win rate, max risk)
- [ ] Search works
- [ ] Copy button opens setup modal
- [ ] Stats summary updates

### Setup Modal
- [ ] Opens when clicking "Copy"
- [ ] Shows trader quick stats
- [ ] All 3 tabs accessible
- [ ] Position sizing options work
- [ ] Risk management sliders work
- [ ] Token filter inputs work
- [ ] Auto-execute toggle works
- [ ] Save button works
- [ ] Save & Activate button works
- [ ] Modal closes after save

### Dashboard
- [ ] Stats cards show correct counts
- [ ] Active Copies tab lists configurations
- [ ] Pause/Play buttons work
- [ ] Delete button works
- [ ] Pending tab shows pending trades
- [ ] Execute button works (creates position)
- [ ] Reject button works
- [ ] Positions tab shows open positions
- [ ] Close button works (closes position)
- [ ] History tab shows closed positions
- [ ] P&L displays correctly

### Real-time Updates
- [ ] New configs appear immediately
- [ ] Status changes reflect instantly
- [ ] Pending trades update
- [ ] Position counts update

---

## 🐛 Troubleshooting

### "No traders found"
- Leaderboard is empty because no traders have been analyzed yet
- Run the analysis script (Step 6)

### "Connect Wallet" button doesn't work
- Check that Solana wallet extension is installed
- Try refreshing the page
- Check browser console for errors

### "Failed to execute trade"
- Check wallet has sufficient SOL balance
- Check RPC endpoint is working
- Verify Jupiter API is accessible
- Check slippage tolerance isn't too low

### Monitoring service not finding trades
- Master traders may not have recent trades
- Check that configs are set to `is_active = true`
- Verify RPC connection is working
- Check console for errors

### Position P&L not calculating
- Ensure both entry and exit prices are recorded
- Check that closing transaction completed
- Verify P&L trigger is working

---

## 📚 Additional Resources

### Useful SQL Queries

**Check leaderboard:**
```sql
SELECT wallet_address, roi, win_rate, total_trades, is_active 
FROM copy_trading_leaderboard 
ORDER BY roi DESC 
LIMIT 10;
```

**Check active configs:**
```sql
SELECT user_id, master_wallet, allocated_capital, is_active 
FROM copy_trading_config 
WHERE is_active = true;
```

**Check pending trades:**
```sql
SELECT * FROM pending_copy_trades 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

**Check positions:**
```sql
SELECT * FROM copy_trading_positions 
WHERE status = 'open' 
ORDER BY opened_at DESC;
```

**Check performance summary:**
```sql
SELECT master_wallet, total_positions, win_rate, total_pnl 
FROM copy_trading_performance_summary 
ORDER BY total_pnl DESC;
```

### Wallet Addresses for Testing

Some known profitable Solana traders (example addresses):
- `7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi`
- `8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6`
- `9rKFCytX5bnKypJP6yV9NkwGqrk7g8h4wFN3vQgJDJh8`

*(Note: These are example addresses. Replace with real profitable trader addresses)*

### RPC Endpoints

**Free:**
- `https://api.mainnet-beta.solana.com` (public, rate limited)

**Paid (recommended for production):**
- Helius: `https://rpc.helius.xyz/?api-key=YOUR_KEY`
- QuickNode: `https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/`
- Alchemy: `https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY`

---

## 🎯 Next Steps

Once you've verified the basic functionality:

1. **Seed Real Traders:**
   - Find profitable Solana wallets using Solscan, Solana Floor, etc.
   - Run analysis on them
   - Build up your leaderboard

2. **Deploy Monitoring Service:**
   - Set up a background service (Node.js, worker, cron job)
   - Monitor active configs every 30 seconds
   - Handle errors gracefully

3. **Add Notifications:**
   - Email when new trades are pending
   - Email when positions close
   - Email for daily P&L summaries

4. **Enhance UI:**
   - Add performance charts
   - Add trader profiles
   - Add comparison tool
   - Mobile responsive views

5. **Test with Real Money:**
   - Start with small amounts ($10-50)
   - Test all execution paths
   - Verify P&L calculations
   - Monitor gas fees

---

## 🎊 You're Ready!

Your copy trading system is now ready to test. Start with the leaderboard, configure a test trader, and execute a small trade to see the full flow in action.

Happy trading! 🚀


