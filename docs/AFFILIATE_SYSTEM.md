# Affiliate System Documentation

## Overview

The WagYu affiliate system allows users to earn commissions by referring new customers to the platform. The system includes comprehensive admin tools for managing affiliates, tracking referrals, calculating commissions, and processing payouts.

## Features

### Admin Features
- **Affiliate Management**: Create, edit, and delete affiliate accounts
- **Referral Tracking**: Monitor all referrals and their status
- **Commission Calculation**: Automatic commission calculation based on subscription events
- **Payout Processing**: Process commission payouts to affiliates
- **Analytics Dashboard**: View comprehensive statistics and reports

### User Features
- **Referral Code Entry**: Users can enter referral codes during signup
- **Automatic Attribution**: Referrals are automatically attributed to affiliates
- **Commission Tracking**: Real-time commission calculation and tracking

## Database Schema

### Affiliates Table
```sql
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  date_applied TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Referrals Table
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id),
  user_id UUID NOT NULL,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### Admin Endpoints

#### GET /api/admin/affiliates
List all affiliates with pagination and filtering.

**Query Parameters:**
- `page` (number): Page number for pagination
- `limit` (number): Number of items per page
- `status` (string): Filter by status (active, pending, inactive)
- `search` (string): Search by name or email

**Response:**
```json
{
  "affiliates": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### POST /api/admin/affiliates
Create a new affiliate.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "status": "active",
  "referral_code": "JOHN1234",
  "commission_rate": 15
}
```

#### PUT /api/admin/affiliates
Update an existing affiliate.

#### DELETE /api/admin/affiliates?id={id}
Delete an affiliate (only if no referrals exist).

### Referral Endpoints

#### GET /api/admin/referrals
List all referrals with affiliate and user details.

#### POST /api/admin/referrals
Create a new referral record.

#### PUT /api/admin/referrals
Update a referral record.

### Commission Endpoints

#### GET /api/admin/commissions
Get commission summary and statistics.

#### POST /api/admin/commissions
Calculate commissions for a specific period.

#### PUT /api/admin/commissions
Process payout for an affiliate.

### Public Endpoints

#### POST /api/referral-track
Track a referral during user signup.

**Request Body:**
```json
{
  "referral_code": "JOHN1234",
  "user_id": "user-uuid",
  "subscription_amount": 0
}
```

## Services

### AffiliateService
Handles all affiliate-related operations including CRUD operations, referral tracking, and commission calculations.

**Key Methods:**
- `getAffiliates()`: Fetch affiliates with filtering and pagination
- `createAffiliate()`: Create new affiliate
- `updateAffiliate()`: Update affiliate information
- `deleteAffiliate()`: Delete affiliate
- `trackReferral()`: Track referral during signup
- `generateReferralCode()`: Generate unique referral code
- `validateReferralCode()`: Validate referral code format

### CommissionService
Handles commission calculations and processing.

**Key Methods:**
- `processCommission()`: Process commission for subscription events
- `getAffiliateStats()`: Get commission statistics for an affiliate
- `processBulkCommissions()`: Process commissions for a date range
- `markCommissionsAsPaid()`: Mark commissions as paid
- `processPayout()`: Process payout for an affiliate

## Webhook Integration

### Stripe Webhooks
The system integrates with Stripe webhooks to automatically process commissions when subscription events occur.

**Supported Events:**
- `customer.subscription.created`: Process commission for new subscriptions
- `customer.subscription.updated`: Process commission for subscription renewals
- `invoice.payment_succeeded`: Process commission for successful payments
- `customer.subscription.deleted`: Handle subscription cancellations

**Webhook Endpoint:** `/api/webhooks/stripe`

## Admin Dashboard

### Affiliate Management
- View all affiliates in a table format
- Filter by status and search by name/email
- Create new affiliates with referral codes and commission rates
- Edit affiliate information and status
- Delete affiliates (with validation)

### Referral Tracking
- View all referrals with affiliate and user details
- Track referral status (pending, paid)
- Monitor commission amounts

### Commission Analytics
- View commission summary statistics
- Track total, pending, and paid commissions
- Analyze commission data by affiliate
- Generate commission reports

## User Flow

### Referral Process
1. User visits signup page with referral code in URL (`?ref=CODE`)
2. Referral code is pre-filled in the signup form
3. User completes signup process
4. System automatically creates referral record
5. Commission is calculated when user subscribes

### Commission Calculation
1. User subscribes to a plan
2. Stripe webhook triggers commission processing
3. System finds the user's referral record
4. Commission is calculated based on affiliate's rate
5. Referral record is updated with new commission amount

### Payout Process
1. Admin reviews pending commissions
2. Admin processes payout for specific affiliate
3. Commission status is updated to 'paid'
4. Payout record is created for audit trail

## Configuration

### Environment Variables
```env
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

### Commission Rates
- Default commission rate: 10%
- Configurable per affiliate
- Supports decimal rates (e.g., 15.5%)

### Referral Codes
- 8-character alphanumeric codes
- Auto-generated or manually created
- Must be unique across all affiliates

## Security

### Admin Access
- Admin access is restricted to specific user IDs
- All admin endpoints require authentication
- Admin operations are logged for audit purposes

### Data Validation
- All input data is validated
- Referral codes are validated for format
- Commission calculations are validated for accuracy

## Monitoring and Logging

### Commission Events
All commission events are logged for audit purposes:
- Referral creation
- Commission calculations
- Payout processing
- Status changes

### Error Handling
- Comprehensive error handling for all operations
- Graceful degradation if referral tracking fails
- Detailed error logging for debugging

## Future Enhancements

### Planned Features
- Affiliate dashboard for self-service
- Automated payout processing
- Commission tiers based on performance
- Referral link generation
- Email notifications for commissions
- Advanced analytics and reporting

### Integration Opportunities
- Payment processor integration (PayPal, etc.)
- Email marketing platform integration
- CRM system integration
- Advanced analytics tools

## Troubleshooting

### Common Issues

1. **Referral not tracked during signup**
   - Check if referral code exists in affiliates table
   - Verify affiliate status is 'active'
   - Check console for error messages

2. **Commission not calculated**
   - Verify Stripe webhook is configured correctly
   - Check webhook endpoint is accessible
   - Review webhook logs for errors

3. **Admin access denied**
   - Verify user ID is in admin list
   - Check authentication status
   - Review admin guard configuration

### Debug Mode
Enable debug logging by setting environment variable:
```env
DEBUG_AFFILIATE_SYSTEM=true
```

## Support

For technical support or questions about the affiliate system, please refer to the development team or create an issue in the project repository. 