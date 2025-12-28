-- Migration: Create Test Commission
-- Description: Creates test commission for existing referral to test payout system
-- Date: 2025-01-27

-- Create test commission for the existing referral ($9.99 * 30% = $2.997)
INSERT INTO commissions (
  referral_id,
  affiliate_id,
  user_id,
  amount,
  event_type,
  description,
  status,
  created_at,
  updated_at
) VALUES (
  '1a2e6577-35cb-4017-abce-eb409a768c41',
  '1830aebe-c20f-4f61-a748-20d5c603b646',
  'bf5526a3-79b1-4844-8be0-292893971fd8',
  2.997,
  'manual_test_commission',
  'Test commission for $9.99 monthly subscription (30% = $2.997)',
  'pending',
  NOW(),
  NOW()
);
