# Solana Wallet Copying Verification Guide

## Overview
This guide helps you verify that the Solana wallet copying/tracking functionality works properly. The system allows users to track Solana wallets and analyze their trading activity.

## System Components

### 1. Database Tables
- **`wallet_tracking`**: Stores user-tracked wallets
- **`wallet_analytics_cache`**: Caches wallet analytics data (5-minute TTL)

### 2. Edge Function
- **`supabase/functions/solana-wallet-analytics/index.ts`**: Fetches wallet data from Solana RPC

### 3. Frontend Components
- **`src/components/crypto/WalletCopyTrading.tsx`**: Main UI component
- **`src/lib/solana-utils.ts`**: Utility functions for wallet operations

## Verification Steps

### Step 1: Verify Database Migration
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('wallet_tracking', 'wallet_analytics_cache');

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'wallet_tracking';
```

### Step 2: Test Wallet Addition
1. Navigate to the Crypto Analytics page (or wherever WalletCopyTrading is rendered)
2. Click "Add Wallet" button
3. Enter a valid Solana wallet address (e.g., `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`)
4. Add an optional label
5. Select "Solana" as blockchain
6. Click "Add"

**Expected Result:**
- Wallet should be added to `wallet_tracking` table
- Success toast notification appears
- Wallet appears in the tracked wallets list

**Verify in Database:**
```sql
SELECT * FROM wallet_tracking 
WHERE user_id = '<your_user_id>' 
ORDER BY created_at DESC;
```

### Step 3: Test Wallet Analytics Fetching
1. Click on a tracked wallet to view details
2. The system should fetch analytics from the edge function

**Expected Result:**
- Wallet balance (SOL and USD value)
- Token holdings
- Transaction count
- Recent transaction signatures

**Verify Edge Function:**
```bash
# Test the edge function directly
curl -X POST https://<your-project>.supabase.co/functions/v1/solana-wallet-analytics \
  -H "Authorization: Bearer <your_anon_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "useDevnet": false
  }'
```

### Step 4: Test Cache Functionality
1. Fetch analytics for a wallet (first request)
2. Immediately fetch again (within 5 minutes)

**Expected Result:**
- First request: `cached: false` in response
- Second request: `cached: true` in response
- Data should be identical

**Verify Cache:**
```sql
SELECT * FROM wallet_analytics_cache 
WHERE wallet_address = '<test_wallet_address>' 
AND blockchain = 'solana';
```

### Step 5: Test Wallet Removal
1. Click the delete/trash icon on a tracked wallet
2. Confirm deletion

**Expected Result:**
- Wallet removed from `wallet_tracking` table
- Wallet disappears from UI
- Success toast notification

### Step 6: Test Wallet Toggle (Active/Inactive)
1. Click the eye icon to toggle wallet visibility
2. Toggle between active and inactive

**Expected Result:**
- `is_active` field updates in database
- UI reflects the change

### Step 7: Test RLS (Row Level Security)
1. Create a test wallet as User A
2. Try to access it as User B (different account)

**Expected Result:**
- User B cannot see User A's wallets
- Database query returns empty for User B

**Verify RLS:**
```sql
-- Test as different user (in Supabase SQL editor, switch user context)
SELECT * FROM wallet_tracking; 
-- Should only return wallets for current user
```

### Step 8: Test with Devnet
1. Add a wallet with `useDevnet: true`
2. Fetch analytics

**Expected Result:**
- Uses `https://api.devnet.solana.com` RPC endpoint
- Cache key includes 'devnet' identifier

## Common Test Wallet Addresses

### Mainnet (Real Wallets)
- **Raydium Program**: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
- **Jupiter Aggregator**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- **Orca DEX**: `9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP`

### Devnet (Test Wallets)
- Use any valid Solana address format (base58, 32-44 characters)

## Troubleshooting

### Issue: Wallet not adding
**Check:**
1. User is authenticated
2. Wallet address is valid Solana format
3. No duplicate wallet (same address + blockchain + user)
4. Check browser console for errors

### Issue: Analytics not loading
**Check:**
1. Edge function is deployed: `supabase functions deploy solana-wallet-analytics`
2. Edge function has correct environment variables
3. RPC endpoint is accessible
4. Check edge function logs: `supabase functions logs solana-wallet-analytics`

### Issue: Cache not working
**Check:**
1. `expires_at` is in the future
2. Cache cleanup function is running
3. RLS policies allow read access

### Issue: RLS blocking access
**Check:**
1. Policies are created correctly
2. User is authenticated
3. `auth.uid()` matches `user_id` in table

## Automated Testing Script

Create a test script to verify all functionality:

```javascript
// test-wallet-tracking.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testWalletTracking() {
  // 1. Test wallet addition
  const { data: wallet, error: addError } = await supabase
    .from('wallet_tracking')
    .insert({
      wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      blockchain: 'solana',
      label: 'Test Wallet'
    })
    .select()
    .single();

  if (addError) {
    console.error('❌ Failed to add wallet:', addError);
    return;
  }
  console.log('✅ Wallet added:', wallet.id);

  // 2. Test wallet fetch
  const { data: wallets, error: fetchError } = await supabase
    .from('wallet_tracking')
    .select('*')
    .eq('id', wallet.id);

  if (fetchError) {
    console.error('❌ Failed to fetch wallet:', fetchError);
    return;
  }
  console.log('✅ Wallet fetched:', wallets.length === 1);

  // 3. Test wallet update
  const { error: updateError } = await supabase
    .from('wallet_tracking')
    .update({ is_active: false })
    .eq('id', wallet.id);

  if (updateError) {
    console.error('❌ Failed to update wallet:', updateError);
    return;
  }
  console.log('✅ Wallet updated');

  // 4. Test wallet deletion
  const { error: deleteError } = await supabase
    .from('wallet_tracking')
    .delete()
    .eq('id', wallet.id);

  if (deleteError) {
    console.error('❌ Failed to delete wallet:', deleteError);
    return;
  }
  console.log('✅ Wallet deleted');

  console.log('🎉 All tests passed!');
}

testWalletTracking();
```

## Edge Function Testing

Test the edge function directly:

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Test with mainnet
curl -X POST https://your-project.supabase.co/functions/v1/solana-wallet-analytics \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "useDevnet": false
  }'

# Test with devnet
curl -X POST https://your-project.supabase.co/functions/v1/solana-wallet-analytics \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "useDevnet": true
  }'
```

## Expected Response Format

```json
{
  "data": {
    "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "balance": {
      "sol": 123.45,
      "usdValue": 12345.67
    },
    "tokens": [
      {
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "amount": 1000.5,
        "decimals": 6
      }
    ],
    "transactionCount": 10,
    "lastTransactionDate": "2024-01-15T10:30:00.000Z",
    "solPrice": 100.50
  },
  "cached": false
}
```

## Next Steps

1. ✅ Verify database tables exist
2. ✅ Test wallet CRUD operations
3. ✅ Test edge function
4. ✅ Test caching
5. ✅ Test RLS policies
6. ✅ Test UI integration
7. ✅ Monitor edge function logs for errors
8. ✅ Check performance (cache hit rate)

## Notes

- Wallet analytics are cached for 5 minutes to reduce RPC calls
- The system currently uses mock analytics data in the UI (see `fetchTrackedWallets` function)
- Real analytics integration requires connecting to DEX APIs (Jupiter, Raydium, etc.)
- Bitcoin wallet tracking is supported but not yet fully implemented

