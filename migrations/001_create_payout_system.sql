-- Migration: Create Payout System
-- Description: Creates complete payout system for affiliate commissions
-- Date: 2025-01-27

-- Create payouts table for affiliate payouts
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  payment_method VARCHAR(50) NOT NULL, -- bank_transfer, paypal, stripe_connect
  bank_details JSONB, -- encrypted bank account details
  stripe_transfer_id VARCHAR(255), -- Stripe transfer ID if using Stripe Connect
  paypal_transaction_id VARCHAR(255), -- PayPal transaction ID
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payout_commissions table to track which commissions are included in each payout
CREATE TABLE IF NOT EXISTS payout_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(payout_id, commission_id)
);

-- Create affiliate_bank_details table for storing encrypted bank information
CREATE TABLE IF NOT EXISTS affiliate_bank_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL, -- encrypted
  routing_number VARCHAR(20) NOT NULL, -- encrypted
  account_type VARCHAR(20) NOT NULL, -- checking, savings
  country VARCHAR(2) NOT NULL DEFAULT 'US',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(affiliate_id)
);

-- Create payout_settings table for global payout configuration
CREATE TABLE IF NOT EXISTS payout_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  minimum_payout_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  payout_frequency VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, weekly, monthly
  processing_days INTEGER NOT NULL DEFAULT 3, -- days to process payouts
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  stripe_connect_enabled BOOLEAN DEFAULT FALSE,
  paypal_enabled BOOLEAN DEFAULT FALSE,
  bank_transfer_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payout settings
INSERT INTO payout_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_commissions_payout_id ON payout_commissions(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_commissions_commission_id ON payout_commissions(commission_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_bank_details_affiliate_id ON affiliate_bank_details(affiliate_id);

-- Create RLS policies
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_settings ENABLE ROW LEVEL SECURITY;

-- Payouts policies
CREATE POLICY "Affiliates can view their own payouts" ON payouts
  FOR SELECT USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "Admins can manage all payouts" ON payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data ->> 'role' = 'admin'
    )
  );

-- Payout commissions policies
CREATE POLICY "Affiliates can view their payout commissions" ON payout_commissions
  FOR SELECT USING (payout_id IN (
    SELECT id FROM payouts WHERE affiliate_id IN (
      SELECT id FROM affiliates WHERE email = auth.jwt() ->> 'email'
    )
  ));

CREATE POLICY "Admins can manage payout commissions" ON payout_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data ->> 'role' = 'admin'
    )
  );

-- Bank details policies
CREATE POLICY "Affiliates can manage their own bank details" ON affiliate_bank_details
  FOR ALL USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "Admins can view all bank details" ON affiliate_bank_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data ->> 'role' = 'admin'
    )
  );

-- Payout settings policies
CREATE POLICY "Admins can manage payout settings" ON payout_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data ->> 'role' = 'admin'
    )
  );

-- Create function to calculate available payout amount
CREATE OR REPLACE FUNCTION get_available_payout_amount(affiliate_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_pending DECIMAL(10,2);
  already_paid DECIMAL(10,2);
BEGIN
  -- Get total pending commissions
  SELECT COALESCE(SUM(amount), 0) INTO total_pending
  FROM commissions 
  WHERE affiliate_id = affiliate_uuid 
  AND status = 'pending';
  
  -- Get amount already included in payouts
  SELECT COALESCE(SUM(pc.amount), 0) INTO already_paid
  FROM payout_commissions pc
  JOIN payouts p ON pc.payout_id = p.id
  JOIN commissions c ON pc.commission_id = c.id
  WHERE c.affiliate_id = affiliate_uuid
  AND p.status IN ('pending', 'processing', 'completed');
  
  RETURN GREATEST(0, total_pending - already_paid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create payout request
CREATE OR REPLACE FUNCTION create_payout_request(
  affiliate_uuid UUID,
  requested_amount DECIMAL(10,2)
)
RETURNS UUID AS $$
DECLARE
  payout_id UUID;
  available_amount DECIMAL(10,2);
  min_payout DECIMAL(10,2);
BEGIN
  -- Get available amount and minimum payout
  SELECT get_available_payout_amount(affiliate_uuid) INTO available_amount;
  SELECT minimum_payout_amount INTO min_payout FROM payout_settings LIMIT 1;
  
  -- Validate amount
  IF requested_amount > available_amount THEN
    RAISE EXCEPTION 'Requested amount exceeds available balance';
  END IF;
  
  IF requested_amount < min_payout THEN
    RAISE EXCEPTION 'Requested amount is below minimum payout threshold';
  END IF;
  
  -- Create payout record
  INSERT INTO payouts (affiliate_id, amount, status, payment_method)
  VALUES (affiliate_uuid, requested_amount, 'pending', 'bank_transfer')
  RETURNING id INTO payout_id;
  
  -- Add commissions to payout
  INSERT INTO payout_commissions (payout_id, commission_id)
  SELECT payout_id, c.id
  FROM commissions c
  WHERE c.affiliate_id = affiliate_uuid
  AND c.status = 'pending'
  AND c.id NOT IN (
    SELECT pc.commission_id 
    FROM payout_commissions pc
    JOIN payouts p ON pc.payout_id = p.id
    WHERE p.status IN ('pending', 'processing', 'completed')
  )
  ORDER BY c.created_at ASC
  LIMIT (SELECT COUNT(*) FROM commissions WHERE affiliate_id = affiliate_uuid AND status = 'pending');
  
  -- Mark commissions as processing
  UPDATE commissions 
  SET status = 'processing', updated_at = NOW()
  WHERE id IN (
    SELECT commission_id FROM payout_commissions WHERE payout_id = payout_id
  );
  
  RETURN payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
