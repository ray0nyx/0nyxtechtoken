# Stripe Webhook Setup & Commission System

## Overview

This document describes the comprehensive Stripe webhook system for processing affiliate commissions automatically when payments are received.

## 🏗️ System Architecture

### Components
1. **Stripe Webhook Endpoint** (`/api/webhooks/stripe.ts`)
2. **Commission Service** (`src/services/commissionService.ts`)
3. **Commission Database Table** (`commissions`)
4. **Admin API Endpoints** (`/api/admin/commissions.ts`)
5. **Test Endpoint** (`/api/webhooks/test-stripe.ts`)

## 📊 Commission Rules

### Commission Rates
- **Subscription Payments**: 15% commission
- **One-time Payments**: 10% commission
- **Trial Periods**: 0% commission
- **Minimum Commission**: $1.00

### Event Types Handled
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Subscription cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment
- `payment_intent.succeeded` - One-time payment
- `checkout.session.completed` - Checkout completion

## 🗄️ Database Schema

### Commissions Table
```sql
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Stripe references
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Metadata
    description TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Setup Instructions

### 1. Environment Variables
Add these to your `.env.local`:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Create Database Tables
Run the SQL script:
```sql
-- Execute scripts/create_commissions_table.sql
```

### 3. Configure Stripe Webhook
In your Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `checkout.session.completed`
5. Copy the webhook secret to your environment variables

## 🚀 Usage

### Webhook Processing Flow
1. **Stripe Event Received** → Webhook endpoint validates signature
2. **Event Type Determined** → Routes to appropriate handler
3. **User Lookup** → Maps Stripe customer ID to internal user ID
4. **Referral Check** → Finds active referral for the user
5. **Commission Calculation** → Calculates commission based on rules
6. **Database Record** → Creates commission record with status 'pending'
7. **Admin Review** → Admins can approve/pay commissions

### Testing the System

#### Test Webhook Endpoint
```bash
POST /api/webhooks/test-stripe
Content-Type: application/json

{
  "event_type": "subscription",
  "customer_id": "cus_123456789",
  "amount": 29.99,
  "subscription_id": "sub_123456789",
  "invoice_id": "in_123456789"
}
```

#### Test Commission Creation
```bash
POST /api/admin/commissions
Content-Type: application/json

{
  "affiliate_id": "uuid",
  "amount": 50.00,
  "payment_method": "PayPal",
  "notes": "Test payout"
}
```

## 📈 Commission Lifecycle

### Status Flow
1. **Pending** - Commission created, awaiting admin approval
2. **Paid** - Commission paid to affiliate
3. **Failed** - Payment failed, commission cancelled
4. **Cancelled** - Commission cancelled (subscription cancelled)

### Payout Process
1. Admin reviews pending commissions
2. Admin processes payout via API
3. Commission status updated to 'paid'
4. Payment method and notes recorded

## 🔍 Monitoring & Debugging

### Logs to Monitor
- Webhook signature verification
- Commission calculation
- Database operations
- Error handling

### Common Issues
1. **Webhook Signature Failures** - Check webhook secret
2. **User Not Found** - Verify customer ID mapping
3. **No Referral Found** - Check referral status
4. **Database Errors** - Verify table structure

### Debug Endpoints
- `/api/webhooks/test-stripe` - Test commission creation
- `/api/admin/commissions?summary=true` - Get commission summary

## 🛡️ Security Considerations

### Webhook Security
- Signature verification required
- HTTPS endpoints only
- Rate limiting recommended
- Idempotency handling

### Data Protection
- Commission amounts encrypted
- User data anonymized in logs
- Access control for admin endpoints
- Audit trail for all operations

## 📊 Reporting & Analytics

### Available Metrics
- Total commissions by period
- Commission success rates
- Affiliate performance
- Payout summaries
- Event type distribution

### API Endpoints
```bash
# Get commission summary
GET /api/admin/commissions?summary=true

# Get affiliate commissions
GET /api/admin/commissions?affiliate_id=uuid

# Get commission stats
GET /api/admin/commissions?event_type=subscription_payment
```

## 🔄 Integration Points

### With Existing Systems
- **User Management** - Links to existing user accounts
- **Affiliate System** - Integrates with affiliate dashboard
- **Admin Panel** - Commission management interface
- **Stripe Billing** - Automatic payment processing

### External Services
- **Payment Processors** - PayPal, bank transfers
- **Accounting Systems** - Commission reporting
- **Analytics Platforms** - Performance tracking

## 🚨 Error Handling

### Webhook Errors
- Invalid signature → 400 Bad Request
- Missing data → 400 Bad Request
- Database errors → 500 Internal Server Error
- Rate limiting → 429 Too Many Requests

### Commission Errors
- Insufficient funds → 400 Bad Request
- Invalid affiliate → 400 Bad Request
- Duplicate commission → 409 Conflict

## 📝 Best Practices

### Development
1. Test with Stripe CLI webhook forwarding
2. Use test mode for development
3. Monitor webhook delivery in Stripe dashboard
4. Implement proper error handling

### Production
1. Use production webhook endpoints
2. Monitor webhook delivery rates
3. Set up alerts for failed webhooks
4. Regular commission reconciliation

### Maintenance
1. Regular database cleanup
2. Monitor commission calculation accuracy
3. Update commission rates as needed
4. Backup commission data regularly

## 🔧 Configuration Options

### Commission Rates
```typescript
const COMMISSION_RATES = {
  subscription: 0.15, // 15%
  one_time: 0.10,     // 10%
  trial: 0.00,        // 0%
};
```

### Minimum Commission
```typescript
const MIN_COMMISSION = 1.00; // $1 minimum
```

### Webhook Events
```typescript
const WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_intent.succeeded',
  'checkout.session.completed'
];
```

## 📞 Support

For issues with the webhook system:
1. Check Stripe webhook dashboard for delivery status
2. Review application logs for errors
3. Test with the test endpoint
4. Verify database connectivity
5. Contact development team with error details

## 🔄 Updates & Maintenance

### Regular Tasks
- Monitor webhook delivery rates
- Review commission calculations
- Update commission rates as needed
- Clean up old commission records
- Backup commission data

### Version Updates
- Test webhook changes in staging
- Update webhook endpoints carefully
- Maintain backward compatibility
- Document all changes

---

This system provides a robust, automated solution for processing affiliate commissions based on Stripe payment events, with comprehensive monitoring, error handling, and admin controls. 