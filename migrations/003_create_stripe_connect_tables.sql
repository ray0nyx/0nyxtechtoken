-- Create Stripe Connect accounts table
CREATE TABLE IF NOT EXISTS affiliate_stripe_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  stripe_account_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'restricted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_stripe_accounts_affiliate_id ON affiliate_stripe_accounts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_stripe_accounts_stripe_account_id ON affiliate_stripe_accounts(stripe_account_id);

-- Enable RLS
ALTER TABLE affiliate_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Affiliates can view their own Stripe accounts" ON affiliate_stripe_accounts;
DROP POLICY IF EXISTS "Affiliates can insert their own Stripe accounts" ON affiliate_stripe_accounts;
DROP POLICY IF EXISTS "Affiliates can update their own Stripe accounts" ON affiliate_stripe_accounts;
DROP POLICY IF EXISTS "Admins can view all Stripe accounts" ON affiliate_stripe_accounts;

-- Create RLS policies
CREATE POLICY "Affiliates can view their own Stripe accounts" ON affiliate_stripe_accounts
  FOR SELECT USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Affiliates can insert their own Stripe accounts" ON affiliate_stripe_accounts
  FOR INSERT WITH CHECK (affiliate_id IN (
    SELECT id FROM affiliates WHERE email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Affiliates can update their own Stripe accounts" ON affiliate_stripe_accounts
  FOR UPDATE USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  ));

-- Admin can view all Stripe accounts
CREATE POLICY "Admins can view all Stripe accounts" ON affiliate_stripe_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR access_level = 'admin')
    )
  );

-- Update payout_settings to include Stripe Connect settings
INSERT INTO payout_settings (
  minimum_payout_amount,
  payout_frequency,
  processing_days,
  currency,
  stripe_connect_enabled,
  paypal_enabled,
  bank_transfer_enabled
) VALUES (
  50.00,
  'manual',
  2,
  'USD',
  true,
  false,
  false
) ON CONFLICT (id) DO UPDATE SET
  stripe_connect_enabled = true,
  processing_days = 2;

-- Add function to check if affiliate has Stripe Connect account
CREATE OR REPLACE FUNCTION has_stripe_connect_account(affiliate_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM affiliate_stripe_accounts 
    WHERE affiliate_id = affiliate_uuid 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get affiliate's Stripe account status
CREATE OR REPLACE FUNCTION get_affiliate_stripe_status(affiliate_uuid UUID)
RETURNS TABLE(
  has_account BOOLEAN,
  account_status VARCHAR(50),
  stripe_account_id VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN asa.id IS NOT NULL THEN true ELSE false END as has_account,
    COALESCE(asa.status, 'none') as account_status,
    asa.stripe_account_id
  FROM affiliates a
  LEFT JOIN affiliate_stripe_accounts asa ON a.id = asa.affiliate_id
  WHERE a.id = affiliate_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;