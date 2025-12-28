# Stripe Pricing Setup Guide

## New Pricing Tiers for WagYuTech Crypto Analytics

### Tier 1: Starter - $19.99/month
- Unlimited CSV trade uploads
- SOL & BTC trade tracking
- Basic P&L analytics
- Trade journaling
- Performance metrics
- Email support

### Tier 2: Pro - $39.99/month
- Everything in Starter
- Automatic broker sync (Binance, Bybit, OKX)
- Advanced backtesting
- Real-time P&L tracking
- Liquidation risk alerts
- Priority support

### Tier 3: Elite - $79.99/month
- Everything in Pro
- Wallet copy trading
- Track top SOL wallets
- Bitcoin on-chain analysis
- Whale movement alerts
- DEX trade analytics
- Finality-to-emotion analyzer
- Tax-ready reporting
- Dedicated support

---

## Setup Instructions

### Step 1: Create Products in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Click **+ Add Product**

#### Product 1: Starter
- **Name:** Starter
- **Description:** Essential crypto trading analytics
- **Price:** $19.99 USD
- **Billing period:** Monthly
- Click **Save product**
- Copy the **Price ID** (starts with `price_`)

#### Product 2: Pro
- **Name:** Pro
- **Description:** Advanced analytics + broker sync
- **Price:** $39.99 USD
- **Billing period:** Monthly
- Click **Save product**
- Copy the **Price ID**

#### Product 3: Elite
- **Name:** Elite
- **Description:** Full suite + wallet copy trading
- **Price:** $79.99 USD
- **Billing period:** Monthly
- Click **Save product**
- Copy the **Price ID**

### Step 2: Update Environment Variables

Add these to your `.env` file:

```env
VITE_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_ELITE=price_xxxxxxxxxxxxx
```

Replace `price_xxxxxxxxxxxxx` with the actual Price IDs from Stripe.

### Step 3: Verify Webhook Configuration

Ensure your Stripe webhook is configured to handle:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Webhook endpoint: `https://your-domain.com/api/stripe-webhook`

### Step 4: Test the Integration

1. Use Stripe test mode first
2. Create a test subscription with card number: `4242 4242 4242 4242`
3. Verify the subscription is created in Supabase `user_subscriptions` table
4. Check that feature access is granted correctly

---

## Feature Access by Tier

| Feature | Starter | Pro | Elite |
|---------|---------|-----|-------|
| CSV Uploads | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| Trade Journaling | ✅ | ✅ | ✅ |
| Basic Analytics | ✅ | ✅ | ✅ |
| Broker Sync | ❌ | ✅ | ✅ |
| Advanced Backtesting | ❌ | ✅ | ✅ |
| Real-time Sync | ❌ | ✅ | ✅ |
| Wallet Copy Trading | ❌ | ❌ | ✅ |
| Bitcoin On-Chain | ❌ | ❌ | ✅ |
| DEX Analytics | ❌ | ❌ | ✅ |

---

## Current Price IDs (Update after creating in Stripe)

```javascript
const STRIPE_PRICE_IDS = {
  starter: 'price_1QzZqQK9cein1vEZExkBcl89', // $19.99/mo
  pro: 'price_1RBNSGK9cein1vEZ0UhpiPSZ',     // $39.99/mo
  elite: 'price_1SaQuGK9cein1vEZSXHK1gPU'    // $79.99/mo
};
```



