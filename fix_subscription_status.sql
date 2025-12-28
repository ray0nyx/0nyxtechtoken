-- Fix subscription statuses for non-paying users
-- This script updates users who have "active" status but no Stripe payment information

-- Update non-paying users to inactive status
-- Exception: Keep the bypassed dev user (856950ff-d638-419d-bcf1-b7dac51d1c7f) as active
UPDATE user_subscriptions 
SET status = 'inactive', 
    updated_at = NOW() 
WHERE status = 'active' 
AND (stripe_customer_id IS NULL OR stripe_subscription_id IS NULL)
AND user_id NOT IN ('856950ff-d638-419d-bcf1-b7dac51d1c7f');

-- Verify the changes
SELECT 
    u.email,
    us.status,
    us.stripe_customer_id,
    us.stripe_subscription_id,
    CASE 
        WHEN us.user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f' 
        THEN 'BYPASSED DEV USER'
        WHEN us.stripe_customer_id IS NOT NULL AND us.stripe_subscription_id IS NOT NULL 
        THEN 'PAID STRIPE SUBSCRIBER'
        ELSE 'NON-PAYING USER'
    END as user_type
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE us.status IS NOT NULL
ORDER BY user_type, u.email;

-- Check specifically for the problematic user
SELECT 
    u.email,
    us.status,
    us.stripe_customer_id,
    us.stripe_subscription_id,
    us.updated_at
FROM auth.users u
JOIN user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'ramirezrayba@gmail.com';
