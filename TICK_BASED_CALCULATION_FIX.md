# Tick-Based PnL Calculation Fix

## Problem Identified

Your NQ trade was showing incorrect PnL because the system was using **point-based** calculations instead of **tick-based** calculations.

## Your Trade Analysis (From Screenshot)

**Trade Details:**
- **Symbol**: NQZ5 (E-Mini NASDAQ 100)
- **Buy Price**: 24970.75
- **Sell Price**: 24971.25
- **Price Difference**: 0.5 points
- **Tick Size**: 0.25 (as shown in your screenshot)
- **Ticks**: 0.5 ÷ 0.25 = 2 ticks
- **Quantity**: 10 contracts
- **P/L**: $100.00 (as shown in your screenshot)

## Correct Calculation

**NQ E-mini Contract:**
- **Tick Size**: 0.25 points
- **Tick Value**: $5.00 per tick
- **Your Trade**: 2 ticks × $5.00 × 10 contracts = $100.00

## Solution Applied

### 1. Updated Contract Multipliers (Tick Values)

**E-mini Contracts:**
- **NQ**: $5.00 per tick
- **ES**: $12.50 per tick
- **RTY**: $12.50 per tick
- **YM**: $5.00 per tick

**Micro Contracts:**
- **MNQ**: $0.50 per tick
- **MES**: $1.25 per tick
- **M2K**: $1.25 per tick
- **MYM**: $0.50 per tick

### 2. Updated Tick Sizes

**E-mini Contracts:**
- **NQ**: 0.25 points per tick
- **ES**: 0.25 points per tick
- **RTY**: 0.10 points per tick
- **YM**: 1.0 points per tick

**Micro Contracts:**
- **MNQ**: 0.25 points per tick
- **MES**: 0.25 points per tick
- **M2K**: 0.10 points per tick
- **MYM**: 1.0 points per tick

### 3. New Calculation Formula

```sql
-- Calculate price difference
price_diff = exit_price - entry_price

-- Calculate number of ticks
ticks = price_diff / tick_size

-- Calculate gross PnL
gross_pnl = ticks * quantity * tick_value

-- Calculate net PnL
net_pnl = gross_pnl - commission
```

## Your Trade Calculation

**Step-by-Step:**
1. **Price Difference**: 24971.25 - 24970.75 = 0.5 points
2. **Tick Size**: 0.25 points per tick
3. **Number of Ticks**: 0.5 ÷ 0.25 = 2 ticks
4. **Tick Value**: $5.00 per tick
5. **Gross PnL**: 2 × 10 × $5.00 = $100.00
6. **Commission**: 10 × $1.50 × 2 = $30.00
7. **Net PnL**: $100.00 - $30.00 = $70.00

## Test Cases

### NQ E-mini (Your Trade)
```
Entry: 24970.75
Exit: 24971.25
Ticks: 2
Tick Value: $5.00
Contracts: 10
Expected: 2 × 10 × $5.00 = $100.00
```

### ES E-mini
```
Entry: 4000.00
Exit: 4000.50
Ticks: 2
Tick Value: $12.50
Contracts: 5
Expected: 2 × 5 × $12.50 = $125.00
```

### MNQ Micro
```
Entry: 15000.00
Exit: 15000.25
Ticks: 1
Tick Value: $0.50
Contracts: 10
Expected: 1 × 10 × $0.50 = $5.00
```

## Files Updated

1. **`scripts/fix_emini_commissions.sql`** - Database functions with tick-based calculation
2. **`src/lib/tradovate-processor.ts`** - Frontend functions updated
3. **`TICK_BASED_CALCULATION_FIX.md`** - This documentation

## How to Apply the Fix

**Step 1: Run the Database Fix**
```sql
-- Copy and paste this into your Supabase SQL Editor:
-- (The complete script is in scripts/fix_emini_commissions.sql)
```

**Step 2: Re-upload Your CSV**
1. Delete the existing incorrect trade
2. Re-upload your NQ CSV file
3. The system will now calculate using tick values

## Expected Results

Your NQ trade should now show:
- **Gross PnL**: $100.00 (2 ticks × 10 contracts × $5.00)
- **Commission**: $30.00 (10 contracts × $1.50 × 2)
- **Net PnL**: $70.00

## Key Differences

| Contract | Tick Size | Tick Value | Example (2 ticks, 10 contracts) |
|----------|-----------|------------|----------------------------------|
| **NQ** | 0.25 | $5.00 | $100.00 |
| **ES** | 0.25 | $12.50 | $250.00 |
| **MNQ** | 0.25 | $0.50 | $10.00 |
| **MES** | 0.25 | $1.25 | $25.00 |

The system now correctly calculates PnL using tick-based values instead of point-based values, matching how futures exchanges actually work! 🎯
