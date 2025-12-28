# Stripe Payout System for Affiliates

## 🚀 **Overview**

The Stripe payout system allows affiliates to receive their commission payments directly to their bank accounts through Stripe Connect. This provides a secure, automated way to process affiliate payouts without manual intervention.

## 🔧 **How It Works**

### **1. Affiliate Setup Process**
1. **Stripe Connect Account Creation**: Affiliate clicks "Start Setup" to create a Stripe Connect account
2. **Onboarding**: Affiliate completes Stripe's secure onboarding process (requires bank details, SSN, ID verification)
3. **Account Verification**: Stripe verifies the affiliate's identity and bank account
4. **Ready for Payouts**: Once verified, affiliate can request payouts

### **2. Payout Process**
1. **Payout Request**: Affiliate requests a payout (minimum $50)
2. **Automatic Processing**: System creates a Stripe transfer to affiliate's bank account
3. **Bank Transfer**: Money is sent directly to affiliate's bank account (1-2 business days)
4. **Status Tracking**: Both affiliate and admin can track payout status

## 📁 **Files Created/Modified**

### **New Files:**
- `src/services/stripePayoutService.ts` - Core Stripe Connect integration
- `src/pages/api/affiliate/stripe-connect.ts` - API endpoint for Stripe Connect operations
- `src/pages/api/admin/process-payout.ts` - Admin API for processing payouts
- `src/components/affiliate/StripeConnectSetup.tsx` - UI component for Stripe setup
- `migrations/003_create_stripe_connect_tables.sql` - Database schema for Stripe accounts

### **Modified Files:**
- `src/components/affiliate/PayoutRequestForm.tsx` - Integrated Stripe Connect
- `src/pages/affiliate/AffiliateDashboard.tsx` - Added userEmail prop

## 🗄️ **Database Schema**

### **New Table: `affiliate_stripe_accounts`**
```sql
CREATE TABLE affiliate_stripe_accounts (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  stripe_account_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### **Updated: `payout_settings`**
- Added `stripe_connect_enabled: true`
- Updated `processing_days: 2` (faster than manual bank transfers)

## 🔑 **Environment Variables Required**

Add these to your `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
NEXT_PUBLIC_APP_URL=http://localhost:8080 # Your app URL for redirects
```

## 🚀 **Setup Instructions**

### **1. Install Stripe SDK**
```bash
npm install stripe
```

### **2. Run Database Migration**
```sql
-- Run this in your Supabase SQL editor
-- Copy and paste the contents of migrations/003_create_stripe_connect_tables.sql
```

### **3. Configure Stripe Connect**
1. Go to your Stripe Dashboard
2. Navigate to Connect > Settings
3. Enable Express accounts
4. Set up your branding and terms
5. Configure webhook endpoints (optional)

### **4. Test the System**
1. Create an affiliate account
2. Go to Affiliate Dashboard
3. Click "Start Setup" for Stripe Connect
4. Complete the onboarding process
5. Request a test payout

## 💰 **Payout Flow**

### **For Affiliates:**
1. **Setup**: Complete Stripe Connect onboarding
2. **Request**: Enter payout amount (minimum $50)
3. **Process**: System automatically transfers money to bank account
4. **Receive**: Money appears in bank account within 1-2 business days

### **For Admins:**
1. **Monitor**: View all payout requests in admin panel
2. **Process**: Payouts are processed automatically
3. **Track**: Monitor payout status and history
4. **Support**: Help affiliates with setup issues

## 🔒 **Security Features**

- **Row Level Security**: Affiliates can only access their own Stripe accounts
- **Secure Onboarding**: Stripe handles all sensitive data (SSN, bank details)
- **Encrypted Storage**: All Stripe account IDs are encrypted
- **Audit Trail**: Complete history of all payout activities

## 📊 **Admin Features**

### **Payout Management Dashboard**
- View all pending/completed payouts
- Process payouts manually (if needed)
- Track payout status and history
- Monitor affiliate Stripe account status

### **Analytics**
- Total payouts processed
- Average payout amount
- Payout success rates
- Affiliate payment preferences

## 🛠️ **API Endpoints**

### **Affiliate Endpoints:**
- `POST /api/affiliate/stripe-connect` - Create account, check status, get dashboard URL
- `POST /api/affiliate/stripe-connect` - Create payout request

### **Admin Endpoints:**
- `POST /api/admin/process-payout` - Process payout, check status

## 🎯 **Benefits**

### **For Affiliates:**
- ✅ **Fast Payouts**: 1-2 business days vs 3-5 for manual processing
- ✅ **Secure**: Stripe handles all sensitive financial data
- ✅ **Transparent**: Real-time status tracking
- ✅ **Convenient**: Direct bank account deposits
- ✅ **Professional**: Integrated with Stripe's trusted platform

### **For Business:**
- ✅ **Automated**: No manual payout processing
- ✅ **Scalable**: Handles unlimited affiliates
- ✅ **Compliant**: Stripe handles tax reporting
- ✅ **Cost-Effective**: Lower processing fees than manual transfers
- ✅ **Reliable**: Stripe's proven infrastructure

## 🚨 **Important Notes**

1. **Stripe Connect Required**: Affiliates must complete Stripe onboarding before receiving payouts
2. **Minimum Payout**: $50 minimum (configurable in payout_settings)
3. **Processing Time**: 1-2 business days for bank transfers
4. **Fees**: Stripe charges small fees for transfers (typically 0.5% + $0.30)
5. **Compliance**: Stripe handles 1099 tax reporting for US affiliates

## 🔧 **Troubleshooting**

### **Common Issues:**
1. **"Stripe Connect Required"**: Affiliate needs to complete onboarding
2. **"Account Not Ready"**: Stripe is still verifying the account
3. **"Minimum Amount"**: Payout amount below $50 threshold
4. **"Transfer Failed"**: Bank account details incorrect or account closed

### **Support:**
- Check Stripe Dashboard for detailed error messages
- Verify affiliate's bank account details
- Ensure Stripe Connect account is fully verified
- Contact Stripe support for technical issues

## 🎉 **Success!**

Your affiliates can now receive their commission payments automatically through Stripe Connect! This creates a professional, scalable payout system that will grow with your business.

---

**Next Steps:**
1. Run the database migration
2. Configure Stripe Connect settings
3. Test with a few affiliate accounts
4. Monitor the first few payouts
5. Scale to all affiliates once confirmed working
