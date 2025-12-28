-- Remove trial access for unauthorized user
-- This script removes the trial subscription for samsam1114555@yahoo.com.hk

-- First, remove the user subscription record
DELETE FROM user_subscriptions 
WHERE user_id = '7da417d1-bc02-4d18-b15b-e3685b93c8a9';

-- Optional: If you want to completely remove the user account
-- DELETE FROM auth.users WHERE email = 'samsam1114555@yahoo.com.hk';

-- Verify the removal
SELECT 
    u.email,
    us.status,
    us.trial_start_date,
    us.trial_end_date
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'samsam1114555@yahoo.com.hk';

-- Check that only allowed users have access
SELECT 
    u.email,
    u.id,
    us.status,
    CASE 
        WHEN u.id IN ('92172686-1ae8-47d8-ad96-9514860ab468', '8538e0b7-6dcd-4673-b39f-00d273c7fc76') 
        THEN 'ALLOWED'
        ELSE 'NOT ALLOWED'
    END as access_status
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE us.status IS NOT NULL OR u.id IN ('92172686-1ae8-47d8-ad96-9514860ab468', '8538e0b7-6dcd-4673-b39f-00d273c7fc76')
ORDER BY access_status, u.email;
