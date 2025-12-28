-- Check subscription status for h.venema44@gmail.com
-- This will show if they have a real paid subscription

-- First, get the user ID from email
SELECT 
  id as user_id,
  email,
  created_at as user_created_at
FROM auth.users
WHERE email = 'h.venema44@gmail.com';

-- Then check their subscription (replace USER_ID_HERE with the ID from above)
-- Or use this query that joins both:
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  us.id as subscription_id,
  us.status,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.plan_id,
  us.is_developer,
  us.current_period_start,
  us.current_period_end,
  us.created_at as subscription_created_at,
  CASE 
    WHEN us.stripe_customer_id IS NOT NULL AND us.stripe_subscription_id IS NOT NULL 
    THEN 'HAS_PAID_SUBSCRIPTION'
    WHEN us.status = 'active' AND (us.stripe_customer_id IS NULL OR us.stripe_subscription_id IS NULL)
    THEN 'ACTIVE_BUT_NO_PAYMENT'
    WHEN us.status IS NULL
    THEN 'NO_SUBSCRIPTION'
    ELSE 'OTHER_STATUS'
  END as subscription_type
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'h.venema44@gmail.com'
ORDER BY us.created_at DESC
LIMIT 1;
