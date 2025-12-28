# 🚀 Stripe Webhook Quick Setup Guide

## Overview
This guide will help you set up the Stripe webhook system for automatic affiliate commission processing.

## ✅ Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Stripe account with API keys
- Database tables already created (commissions, referrals, affiliates)

## 🚀 Quick Setup

### 1. Run the Setup Script
```bash
./setup-stripe-webhook.sh
```

This will:
- Deploy the webhook functions to Supabase
- Display the webhook URLs
- Show you the next steps

### 2. Configure Stripe Webhook

1. **Go to Stripe Dashboard**:
   - Navigate to **Developers** → **Webhooks**
   - Click **Add endpoint**

2. **Set Webhook URL**:
   - Use the URL provided by the setup script
   - Format: `https://your-project.supabase.co/functions/v1/stripe-webhook`

3. **Select Events**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `checkout.session.completed`

4. **Copy Webhook Secret**:
   - After creating the webhook, copy the "Signing secret"
   - It starts with `whsec_`

### 3. Set Environment Variables

Add these to your Supabase project settings or local environment:

```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 4. Test the System

Test the webhook with the test endpoint:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/test-stripe-webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "subscription",
    "customer_id": "cus_test",
    "amount": 29.99,
    "subscription_id": "sub_test",
    "invoice_id": "in_test"
  }'
```

## 🔧 Commission Rules

- **Subscription Payments**: 15% commission
- **One-time Payments**: 10% commission
- **Trial Periods**: 0% commission
- **Minimum Commission**: $1.00

## 📊 What Happens

1. **Payment Received** → Stripe sends webhook
2. **User Lookup** → Find user by Stripe customer ID
3. **Referral Check** → Check if user was referred by affiliate
4. **Commission Calculation** → Calculate based on payment type
5. **Database Record** → Create commission record with 'pending' status
6. **Admin Review** → Admins can approve and pay commissions

## 🛠️ Troubleshooting

### Common Issues

1. **Webhook not receiving events**:
   - Check webhook URL is correct
   - Verify events are selected in Stripe dashboard
   - Check webhook secret is set correctly

2. **Commission not created**:
   - Verify user exists in database
   - Check if user has an active referral
   - Look at function logs in Supabase dashboard

3. **Database errors**:
   - Ensure all tables exist (commissions, referrals, affiliates)
   - Check database permissions

### Debug Commands

```bash
# Check function logs
supabase functions logs stripe-webhook

# Test webhook locally
supabase functions serve stripe-webhook

# Check database tables
supabase db reset
```

## 📈 Monitoring

- **Stripe Dashboard**: Monitor webhook delivery
- **Supabase Dashboard**: Check function logs and database
- **Commission Service**: Use the commission service to manage payouts

## 🎯 Next Steps

1. Set up admin dashboard for commission management
2. Configure payout methods (PayPal, bank transfer, etc.)
3. Set up monitoring and alerts
4. Test with real Stripe events

## 📞 Support

If you encounter issues:
1. Check the logs in Supabase dashboard
2. Verify webhook configuration in Stripe
3. Test with the test endpoint first
4. Check database connectivity and permissions

---

**Ready to go!** Your Stripe webhook system is now set up and ready to process affiliate commissions automatically. 🎉
