# 🎉 Stripe Webhook Setup - Complete!

## ✅ What I've Done

### 1. **Fixed Your Webhook Architecture**
- **Problem**: Your webhook endpoints were in `src/pages/api/` but Vercel expects them in `api/`
- **Solution**: Created proper Vercel API routes in `api/webhooks/`
- **Files Created**:
  - `api/webhooks/stripe.js` - Main webhook handler
  - `api/webhooks/test-stripe.js` - Test webhook handler
  - `api/lib/supabase/client.js` - Supabase client for API routes

### 2. **Commission System Integration**
- ✅ **Automatic commission calculation** (15% subscriptions, 10% one-time)
- ✅ **Database integration** with your existing tables
- ✅ **Error handling** and logging
- ✅ **Test endpoint** for safe testing

### 3. **Database Tables** (Already Working)
- ✅ `commissions` table - stores affiliate commission records
- ✅ `referrals` table - tracks user referrals  
- ✅ `affiliates` table - stores affiliate information

## 🚀 What You Need to Do

### 1. **Deploy to Vercel**
```bash
# Deploy your updated code
vercel --prod
```

### 2. **Set Environment Variables in Vercel**
In your Vercel dashboard, add these environment variables:
- `STRIPE_SECRET_KEY` = your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` = your webhook secret from Stripe dashboard
- `VITE_SUPABASE_URL` = your Supabase URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

### 3. **Update Stripe Webhook URL**
In your Stripe dashboard:
1. Go to **Developers** → **Webhooks**
2. Edit your existing webhook endpoint
3. Update URL to: `https://www.wagyutech.app/api/webhooks/stripe`
4. Make sure these events are selected:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `checkout.session.completed`

### 4. **Test the System**
After deployment, test with:
```bash
# Test the webhook
curl -X POST https://www.wagyutech.app/api/webhooks/test-stripe \
  -H 'Content-Type: application/json' \
  -d '{
    "event_type": "subscription",
    "customer_id": "cus_test",
    "amount": 29.99,
    "subscription_id": "sub_test",
    "invoice_id": "in_test"
  }'
```

## 🔧 How It Works

### Commission Processing Flow:
1. **Payment Received** → Stripe sends webhook to your endpoint
2. **User Lookup** → Find user by Stripe customer ID
3. **Referral Check** → Check if user was referred by affiliate
4. **Commission Calculation** → Calculate based on payment type
5. **Database Record** → Create commission record with 'pending' status
6. **Admin Review** → Admins can approve and pay commissions

### Commission Rules:
- **Subscription Payments**: 15% commission
- **One-time Payments**: 10% commission
- **Trial Periods**: 0% commission
- **Minimum Commission**: $1.00

## 📊 What You Get

✅ **Automatic Commission Processing** - No manual work needed
✅ **Real-time Webhook Handling** - Instant processing of payments
✅ **Comprehensive Logging** - Full audit trail of all events
✅ **Admin Controls** - Easy commission management via existing service
✅ **Test System** - Safe testing without affecting real data
✅ **Error Handling** - Robust error handling and recovery

## 🛠️ Files Created/Modified

### New API Routes:
- `api/webhooks/stripe.js` - Main webhook handler
- `api/webhooks/test-stripe.js` - Test webhook handler
- `api/lib/supabase/client.js` - Supabase client

### Existing Files (Already Working):
- `src/services/commissionService.ts` - Commission management service
- `scripts/create_commissions_table.sql` - Database schema
- Database tables: `commissions`, `referrals`, `affiliates`

## 🎯 Next Steps

1. **Deploy to Vercel** with the new API routes
2. **Set environment variables** in Vercel dashboard
3. **Update Stripe webhook URL** to point to new endpoint
4. **Test the system** with the test endpoint
5. **Monitor commission creation** in your database
6. **Set up admin dashboard** for commission management

## 🚨 Important Notes

1. **Environment Variables**: Make sure to set them in Vercel dashboard
2. **Webhook Secret**: Keep this secure and don't commit it to code
3. **Testing**: Always test with the test endpoint first
4. **Monitoring**: Check Vercel function logs for any issues
5. **Database**: Your commission data is automatically backed up in Supabase

## 📞 Troubleshooting

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables are set correctly
3. Test with the test endpoint first
4. Check database connectivity
5. Verify Stripe webhook configuration

---

**🎉 Your Stripe webhook system is now properly set up for Vercel deployment!** 

The commission system will automatically process affiliate commissions whenever payments are received through Stripe. Just deploy to Vercel and update your webhook URL! 🚀
