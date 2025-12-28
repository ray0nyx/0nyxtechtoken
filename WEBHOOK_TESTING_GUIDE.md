# Stripe Webhook Commission Testing Guide

This guide will help you test the Stripe webhook system to ensure it properly tracks user commissions and calculates them correctly.

## 🎯 What We're Testing

1. **Commission Calculations** - Verify correct percentage calculations
2. **Database Records** - Ensure commissions are stored properly
3. **Webhook Events** - Test different Stripe event types
4. **User-Affiliate Relationships** - Verify referral tracking

## 🚀 Quick Start

### 1. Verify Database Setup
First, check if your database has the necessary tables and data:

```bash
npm run verify:commissions
```

This will check:
- Database table existence
- Affiliate records
- Referral relationships
- Commission records
- User subscriptions

### 2. Test Commission Calculations
Test the commission calculation logic:

```bash
npm run test:webhook
```

This tests:
- Subscription payments (30% commission)
- One-time payments (20% commission)
- Trial payments (0% commission)
- Minimum commission enforcement ($1 minimum)

### 3. Test Stripe Webhook Events
Simulate actual Stripe webhook events:

```bash
npm run test:stripe-events
```

This tests:
- `customer.subscription.created`
- `invoice.payment_succeeded`
- `payment_intent.succeeded`
- `checkout.session.completed`

### 4. Run All Tests
Run the complete test suite:

```bash
npm run test:all
```

## 📊 Expected Commission Rates

| Payment Type | Commission Rate | Example |
|--------------|----------------|---------|
| Subscription | 30% | $100 → $30 commission |
| One-time | 20% | $50 → $10 commission |
| Trial | 0% | $0 → $0 commission |
| Minimum | $1.00 | $2 → $1 commission (not $0.60) |

## 🔧 Test Configuration

### Environment Variables
Make sure these are set in your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

### Webhook Endpoints
The tests use these endpoints:
- Test endpoint: `http://localhost:3000/api/webhooks/test-stripe`
- Live endpoint: `http://localhost:3000/api/webhooks/stripe`

## 🧪 Test Scenarios

### Scenario 1: New Subscription
1. User signs up with affiliate code
2. User subscribes to $29.99/month plan
3. Webhook processes `customer.subscription.created`
4. Commission: $8.997 (30% of $29.99)

### Scenario 2: Monthly Payment
1. Existing subscriber pays monthly invoice
2. Webhook processes `invoice.payment_succeeded`
3. Commission: $8.997 (30% of $29.99)

### Scenario 3: One-time Purchase
1. User makes one-time purchase of $99.99
2. Webhook processes `checkout.session.completed`
3. Commission: $19.998 (20% of $99.99)

### Scenario 4: Small Payment
1. User makes small payment of $2.00
2. Commission: $1.00 (minimum commission)

## 🔍 Troubleshooting

### Common Issues

#### 1. "No user found for customer ID"
- Check if user has `stripe_customer_id` in metadata
- Verify `user_subscriptions` table has the customer ID
- Ensure webhook is using correct customer ID

#### 2. "No referral found for user"
- User must have an active referral record
- Check `referrals` table for the user
- Verify affiliate relationship exists

#### 3. "Commission calculation incorrect"
- Check commission rates in webhook code
- Verify amount conversion (cents to dollars)
- Ensure minimum commission logic

#### 4. "Database error"
- Check Supabase connection
- Verify table permissions
- Check for missing columns

### Debug Steps

1. **Check Webhook Logs**
   ```bash
   # If using Vercel
   vercel logs --follow
   
   # If using local development
   # Check console output
   ```

2. **Verify Database Records**
   ```sql
   -- Check commissions
   SELECT * FROM commissions ORDER BY created_at DESC LIMIT 10;
   
   -- Check referrals
   SELECT * FROM referrals WHERE status = 'active';
   
   -- Check affiliates
   SELECT * FROM affiliates WHERE status = 'active';
   ```

3. **Test Webhook Manually**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/test-stripe \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "subscription",
       "customer_id": "cus_test123",
       "amount": 2999,
       "subscription_id": "sub_test123",
       "invoice_id": "in_test123"
     }'
   ```

## 📈 Success Criteria

Your webhook system is working correctly if:

✅ All test cases pass  
✅ Commission calculations are accurate  
✅ Database records are created  
✅ User-affiliate relationships are tracked  
✅ Different event types are handled  
✅ Error cases are handled gracefully  

## 🚨 Production Checklist

Before going live:

- [ ] Test with real Stripe webhook events
- [ ] Verify webhook signature validation
- [ ] Test with actual payment amounts
- [ ] Monitor webhook delivery success rate
- [ ] Set up error alerting
- [ ] Test commission payout process
- [ ] Verify affiliate dashboard functionality

## 📞 Support

If you encounter issues:

1. Check the test output for specific error messages
2. Verify your database setup
3. Check webhook endpoint configuration
4. Review Stripe webhook logs
5. Test with smaller amounts first

## 🔄 Continuous Testing

Set up automated testing:

```bash
# Add to your CI/CD pipeline
npm run test:all

# Or run specific tests
npm run verify:commissions
```

This ensures your commission tracking system remains functional as you make changes to the codebase.
