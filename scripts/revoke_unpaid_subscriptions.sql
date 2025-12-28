-- Revoke subscriptions that are marked as active but don't have Stripe payment
-- This ensures only paying customers have access

-- First, check the current status of the specific user
SELECT 
  id,
  user_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  created_at,
  updated_at,
  CASE 
    WHEN stripe_customer_id IS NULL OR stripe_subscription_id IS NULL 
    THEN 'NO_PAYMENT'
    ELSE 'HAS_PAYMENT'
  END as payment_status
FROM user_subscriptions
WHERE user_id = '2916ba93-4609-4f8c-ba5f-ca3954859bdc';

-- Revoke all subscriptions that are active but missing Stripe payment info
UPDATE user_subscriptions
SET 
  status = 'expired',
  updated_at = NOW()
WHERE status = 'active'
  AND (stripe_customer_id IS NULL OR stripe_subscription_id IS NULL)
  AND is_developer = false; -- Don't revoke developer subscriptions

-- Show how many subscriptions were revoked
SELECT 
  COUNT(*) as revoked_count,
  'Subscriptions revoked (active but no Stripe payment)' as description
FROM user_subscriptions
WHERE status = 'expired'
  AND updated_at >= NOW() - INTERVAL '1 minute';

-- Verify the specific user's subscription was revoked
SELECT 
  id,
  user_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at
FROM user_subscriptions
WHERE user_id = '2916ba93-4609-4f8c-ba5f-ca3954859bdc';
