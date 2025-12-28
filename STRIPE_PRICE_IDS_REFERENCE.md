# Stripe Price IDs Reference

## Current Price IDs

Based on the code in `src/pages/Pricing.tsx`, here are the current Stripe Price IDs:

```javascript
const STRIPE_PRICE_IDS = {
  starter: 'price_1QzZqQK9cein1vEZExkBcl89',  // $19.99/month
  pro: 'price_1RBNSGK9cein1vEZ0UhpiPSZ',      // $39.99/month
  elite: 'price_1SaQuGK9cein1vEZSXHK1gPU'     // $79.99/month
};
```

## Price Tiers

### Tier 1: Starter - $19.99/month
- **Price ID**: `price_1QzZqQK9cein1vEZExkBcl89`
- **Features**:
  - Unlimited CSV trade uploads
  - SOL & BTC trade tracking
  - Basic P&L analytics
  - Trade journaling
  - Performance metrics
  - Email support

### Tier 2: Pro - $39.99/month
- **Price ID**: `price_1RBNSGK9cein1vEZ0UhpiPSZ`
- **Features**:
  - Everything in Starter
  - Automatic broker sync (Binance, Bybit, OKX)
  - Advanced backtesting
  - Real-time P&L tracking
  - Liquidation risk alerts
  - Priority support

### Tier 3: Elite - $79.99/month
- **Price ID**: `price_1SaQuGK9cein1vEZSXHK1gPU`
- **Features**:
  - Everything in Pro
  - Wallet copy trading
  - Track top SOL wallets
  - Bitcoin on-chain analysis
  - Whale movement alerts
  - DEX trade analytics
  - Finality-to-emotion analyzer
  - Tax-ready reporting
  - Dedicated support

## Environment Variables

The system uses environment variables with fallback to hardcoded values:

```env
VITE_STRIPE_PRICE_STARTER=price_1QzZqQK9cein1vEZExkBcl89
VITE_STRIPE_PRICE_PRO=price_1RBNSGK9cein1vEZ0UhpiPSZ
VITE_STRIPE_PRICE_ELITE=price_1SaQuGK9cein1vEZSXHK1gPU
```

## How to Update Price IDs

### Option 1: Update Environment Variables (Recommended)
1. Add/update the price IDs in your `.env` file:
   ```env
   VITE_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
   VITE_STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
   VITE_STRIPE_PRICE_ELITE=price_xxxxxxxxxxxxx
   ```
2. Restart your development server
3. The code will automatically use the environment variables

### Option 2: Update Code Directly
1. Edit `src/pages/Pricing.tsx`
2. Update the fallback values in `STRIPE_PRICE_IDS`:
   ```javascript
   const STRIPE_PRICE_IDS = {
     starter: import.meta.env.VITE_STRIPE_PRICE_STARTER || 'price_NEW_STARTER_ID',
     pro: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_NEW_PRO_ID',
     elite: import.meta.env.VITE_STRIPE_PRICE_ELITE || 'price_NEW_ELITE_ID'
   };
   ```

## Creating New Products in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Click **+ Add Product**
3. For each tier:
   - **Name**: Starter / Pro / Elite
   - **Description**: See features above
   - **Price**: $19.99 / $39.99 / $79.99 USD
   - **Billing period**: Monthly (recurring)
   - Click **Save product**
   - Copy the **Price ID** (starts with `price_`)

## Verification

To verify the price IDs are correct:

1. **Check Stripe Dashboard**:
   - Go to Products section
   - Verify each product exists
   - Check the Price ID matches

2. **Test Checkout Flow**:
   - Navigate to `/pricing` page
   - Click "Subscribe" on any tier
   - Verify the correct price ID is sent to Stripe
   - Check browser console for any errors

3. **Check Environment Variables**:
   ```bash
   # In your terminal
   echo $VITE_STRIPE_PRICE_STARTER
   echo $VITE_STRIPE_PRICE_PRO
   echo $VITE_STRIPE_PRICE_ELITE
   ```

## Important Notes

⚠️ **Test Mode vs Live Mode**:
- Stripe has separate price IDs for test and live modes
- Test mode price IDs start with `price_` but are different from live mode
- Make sure you're using the correct mode for your environment

⚠️ **Price ID Format**:
- All Stripe price IDs start with `price_`
- They are typically 24-28 characters long
- Example: `price_1RUC9AK9cein1vEZPurHdRzw`

⚠️ **Updating Prices**:
- If you change the price amount in Stripe, you'll get a NEW price ID
- Old subscriptions will continue with the old price ID
- New subscriptions will use the new price ID
- Update your code/environment variables when creating new prices

## Related Files

- `src/pages/Pricing.tsx` - Main pricing page with price IDs
- `STRIPE_PRICING_SETUP.md` - Detailed setup guide
- `.env` / `.env.local` - Environment variables (not in git)
- `src/lib/services/subscriptionService.ts` - Subscription service that uses price IDs

## Support

If you need to verify or update price IDs:
1. Check Stripe Dashboard → Products
2. Verify the price ID matches what's in code
3. Test the checkout flow
4. Check webhook logs for subscription events

