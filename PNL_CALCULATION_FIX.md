# PnL Calculation Fix for Futures Contracts

## Problem Identified

Your NQ trade is showing $0 instead of $100 because the system was using a simple `(exit_price - entry_price) * quantity` formula without considering futures contract multipliers.

## Root Cause

1. **Missing Contract Multipliers**: NQ (E-mini NASDAQ-100) has a $20 per point multiplier, but this wasn't being applied
2. **Incorrect PnL Formula**: The database function was using stock-like calculations instead of futures-specific calculations
3. **No Position Direction Logic**: The system wasn't properly handling long vs short positions for futures

## Solution Implemented

### 1. Database Function Updates (`scripts/fix_pnl_calculation.sql`)

**New Functions Created:**
- `get_contract_multiplier(symbol TEXT)`: Returns the correct multiplier for each futures contract
- `calculate_futures_pnl()`: Calculates PnL using proper futures logic

**Contract Multipliers Added:**
```sql
-- E-mini contracts
NQ: $20 per point
ES: $50 per point  
RTY: $50 per point
YM: $5 per point

-- Micro contracts
MNQ: $5 per point
MES: $5 per point
M2K: $5 per point
MYM: $1 per point

-- Energy contracts
CL (Crude Oil): $1,000 per point
NG (Natural Gas): $10,000 per point
GC (Gold): $100 per point
SI (Silver): $5,000 per point
```

**Correct PnL Formula:**
```sql
-- For Long positions:
PnL = (exit_price - entry_price) * quantity * multiplier - fees

-- For Short positions:
PnL = (entry_price - exit_price) * quantity * multiplier - fees
```

### 2. Frontend Updates (`src/lib/tradovate-processor.ts`)

**Added Functions:**
- `getContractMultiplier()`: Frontend version of the multiplier function
- Updated PnL calculation logic to use futures multipliers

### 3. Example Calculation for Your NQ Trade

**Assuming:**
- Symbol: NQ
- Entry Price: 15,000
- Exit Price: 15,005  
- Quantity: 1 contract
- Position: Long
- Fees: $2.58 (Tradovate standard)

**Calculation:**
```
Price Difference = 15,005 - 15,000 = 5 points
Multiplier = $20 per point (for NQ)
Gross PnL = 5 points × 1 contract × $20 = $100
Net PnL = $100 - $2.58 = $97.42
```

## How to Apply the Fix

### Step 1: Run the Database Script
```sql
-- Run this in your Supabase SQL Editor
\i scripts/fix_pnl_calculation.sql
```

### Step 2: Re-import Your CSV
1. Delete the existing $0 trade
2. Re-upload your NQ CSV file
3. The system will now calculate PnL correctly

### Step 3: Verify the Fix
- Check that your NQ trade now shows ~$97.42 (or $100 - fees)
- Verify cumulative PnL includes commissions
- Confirm all future trades calculate correctly

## Additional Benefits

### 1. Cumulative PnL with Commissions
- All trades now include commission costs in PnL calculation
- Cumulative PnL reflects true profit/loss after fees
- Analytics will be more accurate

### 2. Support for All Major Futures
- NQ, ES, RTY, YM (E-mini contracts)
- MNQ, MES, M2K, MYM (Micro contracts)  
- CL, NG, GC, SI (Energy/Metals)
- 6E, 6J, 6B (Currency futures)

### 3. Proper Position Handling
- Long positions: `(exit - entry) × qty × multiplier - fees`
- Short positions: `(entry - exit) × qty × multiplier - fees`
- Automatic position detection from timestamps

## Testing the Fix

### Test Case 1: NQ Long Trade
```
Entry: 15,000
Exit: 15,005
Quantity: 1
Expected PnL: ~$97.42 (5 points × $20 - fees)
```

### Test Case 2: NQ Short Trade  
```
Entry: 15,005
Exit: 15,000
Quantity: 1
Expected PnL: ~$97.42 (5 points × $20 - fees)
```

### Test Case 3: Multiple Contracts
```
Entry: 15,000
Exit: 15,010
Quantity: 2
Expected PnL: ~$197.42 (10 points × $20 × 2 - fees)
```

## Troubleshooting

### If PnL Still Shows $0:
1. Check that the database script ran successfully
2. Verify the symbol is exactly "NQ" (case-sensitive)
3. Check the browser console for calculation logs
4. Ensure entry/exit prices are valid numbers

### If PnL Shows Wrong Amount:
1. Verify the contract multiplier is correct
2. Check that position (long/short) is detected properly
3. Confirm fees are being subtracted
4. Check that prices are in the correct format

## Future Enhancements

1. **Custom Multipliers**: Allow users to set custom multipliers for new contracts
2. **Real-time Updates**: Update PnL when prices change
3. **Portfolio Analytics**: Include contract-specific analytics
4. **Risk Management**: Add position sizing based on contract value

The fix ensures that all futures trades calculate PnL correctly using proper contract multipliers and commission handling, giving you accurate profit/loss tracking for your trading analysis.
