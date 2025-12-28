-- COMPREHENSIVE AFFILIATE SYSTEM MIGRATION
-- This script ensures compatibility with existing affiliate tables and creates new application system

-- 1. First, check and create the existing affiliate tables if they don't exist
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'terminated')),
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  date_applied TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create referrals table if it doesn't exist
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT,
  referral_code TEXT,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC DEFAULT 0.30,
  commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid', 'cancelled')),
  subscription_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'cancelled')),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create NEW affiliate_applications table for the approval system
CREATE TABLE IF NOT EXISTS affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  website_url TEXT,
  social_media_links JSONB DEFAULT '{}',
  audience_size INTEGER,
  audience_description TEXT,
  marketing_channels TEXT[],
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  why_join TEXT,
  additional_info TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'suspended')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add missing columns to existing affiliates table
ALTER TABLE affiliates 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES affiliate_applications(id),
ADD COLUMN IF NOT EXISTS affiliate_code TEXT,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_referral_date TIMESTAMP WITH TIME ZONE;

-- 5. Update commission_rate to use decimal format if needed
DO $$
BEGIN
  -- Check if commission_rate is numeric and convert if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliates' 
    AND column_name = 'commission_rate' 
    AND data_type = 'numeric'
  ) THEN
    -- Convert percentage values to decimal (10% -> 0.10)
    UPDATE affiliates 
    SET commission_rate = commission_rate / 100 
    WHERE commission_rate > 1;
  END IF;
END $$;

-- 6. Ensure affiliate_code is populated (use referral_code if available)
UPDATE affiliates 
SET affiliate_code = referral_code 
WHERE affiliate_code IS NULL AND referral_code IS NOT NULL;

-- 7. Create unique constraint on affiliate_code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'affiliates_affiliate_code_key'
  ) THEN
    ALTER TABLE affiliates ADD CONSTRAINT affiliates_affiliate_code_key UNIQUE (affiliate_code);
  END IF;
END $$;

-- 8. Create function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  -- Create base code from email (first part before @)
  base_code := UPPER(LEFT(SPLIT_PART(user_email, '@', 1), 8));
  final_code := base_code;
  
  -- Check if code exists in either affiliate_code or referral_code columns
  WHILE EXISTS (
    SELECT 1 FROM affiliates 
    WHERE affiliate_code = final_code OR referral_code = final_code
  ) LOOP
    final_code := base_code || counter::TEXT;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to approve affiliate application
CREATE OR REPLACE FUNCTION approve_affiliate_application(
  application_id UUID,
  admin_user_id UUID,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  app_record affiliate_applications;
  new_affiliate_code TEXT;
  existing_affiliate_id UUID;
BEGIN
  -- Get application details
  SELECT * INTO app_record FROM affiliate_applications WHERE id = application_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  
  -- Update application status
  UPDATE affiliate_applications 
  SET 
    status = 'approved',
    admin_notes = COALESCE(admin_notes, admin_notes),
    reviewed_by = admin_user_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = application_id;
  
  -- Check if affiliate already exists for this user
  SELECT id INTO existing_affiliate_id 
  FROM affiliates 
  WHERE email = app_record.email OR user_id = app_record.user_id;
  
  IF existing_affiliate_id IS NOT NULL THEN
    -- Update existing affiliate record
    UPDATE affiliates 
    SET 
      application_id = application_id,
      status = 'active',
      user_id = app_record.user_id,
      updated_at = NOW()
    WHERE id = existing_affiliate_id;
  ELSE
    -- Generate unique affiliate code
    new_affiliate_code := generate_affiliate_code(app_record.email);
    
    -- Create new affiliate record
    INSERT INTO affiliates (
      user_id,
      application_id,
      name,
      email,
      status,
      referral_code,
      affiliate_code,
      commission_rate
    ) VALUES (
      app_record.user_id,
      application_id,
      app_record.full_name,
      app_record.email,
      'active',
      new_affiliate_code,
      new_affiliate_code,
      0.30 -- 30% commission rate
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to deny affiliate application
CREATE OR REPLACE FUNCTION deny_affiliate_application(
  application_id UUID,
  admin_user_id UUID,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE affiliate_applications 
  SET 
    status = 'denied',
    admin_notes = admin_notes,
    reviewed_by = admin_user_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = application_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create function to check if user is an approved affiliate
CREATE OR REPLACE FUNCTION is_user_affiliate(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM affiliates 
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create admin view for affiliate applications
CREATE OR REPLACE VIEW affiliate_applications_admin AS
SELECT 
  aa.*,
  u.email as user_email,
  u.created_at as user_created_at,
  admin_user.email as reviewed_by_email,
  CASE 
    WHEN a.id IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as has_affiliate_account
FROM affiliate_applications aa
LEFT JOIN auth.users u ON aa.user_id = u.id
LEFT JOIN auth.users admin_user ON aa.reviewed_by = admin_user.id
LEFT JOIN affiliates a ON aa.user_id = a.user_id
ORDER BY aa.created_at DESC;

-- 13. Enable RLS on new tables
ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS policies for affiliate_applications
DROP POLICY IF EXISTS "Users can view own applications" ON affiliate_applications;
CREATE POLICY "Users can view own applications" ON affiliate_applications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create applications" ON affiliate_applications;
CREATE POLICY "Users can create applications" ON affiliate_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all applications" ON affiliate_applications;
CREATE POLICY "Admins can view all applications" ON affiliate_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- 15. Enable RLS on affiliates table if not already enabled
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own affiliate data" ON affiliates;
CREATE POLICY "Users can view own affiliate data" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

-- 16. Enable RLS on referrals table if not already enabled
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view own referrals" ON referrals;
CREATE POLICY "Affiliates can view own referrals" ON referrals
  FOR SELECT USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- 17. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user_id ON affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_commission_status ON referrals(commission_status);

-- 18. Create commissions table if it doesn't exist (for tracking detailed commission history)
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
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

-- 19. Create indexes for commissions table
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_event_type ON commissions(event_type);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);

-- 20. Add comments for documentation
COMMENT ON TABLE affiliate_applications IS 'Stores affiliate program applications for admin review';
COMMENT ON TABLE affiliates IS 'Stores affiliate accounts with tracking codes';
COMMENT ON TABLE referrals IS 'Stores referral records and commission tracking';
COMMENT ON TABLE commissions IS 'Detailed commission tracking and payment history';
COMMENT ON FUNCTION approve_affiliate_application(UUID, UUID, TEXT) IS 'Approves affiliate application and creates/updates affiliate account';
COMMENT ON FUNCTION deny_affiliate_application(UUID, UUID, TEXT) IS 'Denies affiliate application with admin notes';

-- 21. Final verification and summary
DO $$
DECLARE
  app_count INTEGER;
  affiliate_count INTEGER;
  referral_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO app_count FROM affiliate_applications;
  SELECT COUNT(*) INTO affiliate_count FROM affiliates;
  SELECT COUNT(*) INTO referral_count FROM referrals;
  
  RAISE NOTICE '=== AFFILIATE SYSTEM MIGRATION COMPLETED ===';
  RAISE NOTICE 'Affiliate Applications: % records', app_count;
  RAISE NOTICE 'Affiliates: % records', affiliate_count;
  RAISE NOTICE 'Referrals: % records', referral_count;
  RAISE NOTICE '============================================';
END $$;

SELECT 'Affiliate system migration completed successfully!' as message;
