-- FINAL COMPREHENSIVE AFFILIATE SYSTEM SETUP
-- Run this in your Supabase SQL Editor to set up the complete affiliate system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or update affiliates table (compatible with existing structure)
DO $$
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  );
  
  -- Add all necessary columns
  ALTER TABLE affiliates 
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10,
    ADD COLUMN IF NOT EXISTS date_applied TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS application_id UUID,
    ADD COLUMN IF NOT EXISTS affiliate_code TEXT,
    ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS last_referral_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
  -- Add constraints if they don't exist
  BEGIN
    ALTER TABLE affiliates ADD CONSTRAINT affiliates_email_unique UNIQUE (email);
  EXCEPTION WHEN duplicate_table THEN
    -- Constraint already exists
    NULL;
  END;
  
  BEGIN
    ALTER TABLE affiliates ADD CONSTRAINT affiliates_referral_code_unique UNIQUE (referral_code);
  EXCEPTION WHEN duplicate_table THEN
    -- Constraint already exists
    NULL;
  END;
  
  BEGIN
    ALTER TABLE affiliates ADD CONSTRAINT affiliates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists
    NULL;
  END;
  
  -- Add check constraint for status
  BEGIN
    ALTER TABLE affiliates ADD CONSTRAINT affiliates_status_check CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'terminated'));
  EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists
    NULL;
  END;
END $$;

-- 2. Create referrals table
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID,
    user_id UUID NOT NULL,
    email TEXT,
    referral_code TEXT,
    commission_amount NUMERIC DEFAULT 0,
    commission_rate NUMERIC DEFAULT 0.30,
    commission_status TEXT DEFAULT 'pending',
    subscription_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Add foreign key constraint
  BEGIN
    ALTER TABLE referrals ADD CONSTRAINT referrals_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  -- Add check constraints
  BEGIN
    ALTER TABLE referrals ADD CONSTRAINT referrals_commission_status_check CHECK (commission_status IN ('pending', 'approved', 'paid', 'cancelled'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'converted', 'cancelled'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 3. Create affiliate_applications table
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

-- 4. Add application_id foreign key to affiliates table
DO $$
BEGIN
  ALTER TABLE affiliates ADD CONSTRAINT affiliates_application_id_fkey FOREIGN KEY (application_id) REFERENCES affiliate_applications(id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 5. Create commissions table for detailed tracking
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
    affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Fix commission rate format (convert percentage to decimal)
UPDATE affiliates 
SET commission_rate = commission_rate / 100 
WHERE commission_rate > 1;

-- 7. Ensure affiliate_code is populated
UPDATE affiliates 
SET affiliate_code = referral_code 
WHERE affiliate_code IS NULL AND referral_code IS NOT NULL;

-- 8. Create function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  base_code := UPPER(LEFT(SPLIT_PART(user_email, '@', 1), 8));
  final_code := base_code;
  
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

-- 9. Create approval function
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
  SELECT * INTO app_record FROM affiliate_applications WHERE id = application_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  
  UPDATE affiliate_applications 
  SET 
    status = 'approved',
    admin_notes = COALESCE(admin_notes, admin_notes),
    reviewed_by = admin_user_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = application_id;
  
  SELECT id INTO existing_affiliate_id 
  FROM affiliates 
  WHERE email = app_record.email OR user_id = app_record.user_id;
  
  IF existing_affiliate_id IS NOT NULL THEN
    UPDATE affiliates 
    SET 
      application_id = application_id,
      status = 'active',
      user_id = app_record.user_id,
      updated_at = NOW()
    WHERE id = existing_affiliate_id;
  ELSE
    new_affiliate_code := generate_affiliate_code(app_record.email);
    
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
      0.30
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create denial function
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

-- 11. Create helper function
CREATE OR REPLACE FUNCTION is_user_affiliate(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM affiliates 
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create admin view
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

-- 13. Enable RLS
ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS policies
-- Affiliate applications policies
DROP POLICY IF EXISTS "Users can view own applications" ON affiliate_applications;
CREATE POLICY "Users can view own applications" ON affiliate_applications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create applications" ON affiliate_applications;
CREATE POLICY "Users can create applications" ON affiliate_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage applications" ON affiliate_applications;
CREATE POLICY "Admins can manage applications" ON affiliate_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- Affiliates policies
DROP POLICY IF EXISTS "Users can view own affiliate data" ON affiliates;
CREATE POLICY "Users can view own affiliate data" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage affiliates" ON affiliates;
CREATE POLICY "Admins can manage affiliates" ON affiliates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- Referrals policies
DROP POLICY IF EXISTS "Affiliates can view own referrals" ON referrals;
CREATE POLICY "Affiliates can view own referrals" ON referrals
  FOR SELECT USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage referrals" ON referrals;
CREATE POLICY "Admins can manage referrals" ON referrals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- 15. Create indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user_id ON affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_commission_status ON referrals(commission_status);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- 16. Grant permissions
GRANT ALL ON affiliate_applications TO authenticated;
GRANT ALL ON affiliates TO authenticated;
GRANT ALL ON referrals TO authenticated;
GRANT ALL ON commissions TO authenticated;

-- 17. Add helpful comments
COMMENT ON TABLE affiliate_applications IS 'Stores affiliate program applications for admin review';
COMMENT ON TABLE affiliates IS 'Stores approved affiliate accounts with tracking codes';
COMMENT ON TABLE referrals IS 'Tracks referrals and commission calculations';
COMMENT ON TABLE commissions IS 'Detailed commission tracking and payment history';

-- 18. Final verification
DO $$
DECLARE
  app_count INTEGER;
  affiliate_count INTEGER;
  referral_count INTEGER;
  commission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO app_count FROM affiliate_applications;
  SELECT COUNT(*) INTO affiliate_count FROM affiliates;
  SELECT COUNT(*) INTO referral_count FROM referrals;
  SELECT COUNT(*) INTO commission_count FROM commissions;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AFFILIATE SYSTEM SETUP COMPLETED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '- affiliate_applications: % records', app_count;
  RAISE NOTICE '- affiliates: % records', affiliate_count;
  RAISE NOTICE '- referrals: % records', referral_count;
  RAISE NOTICE '- commissions: % records', commission_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '- approve_affiliate_application()';
  RAISE NOTICE '- deny_affiliate_application()';
  RAISE NOTICE '- is_user_affiliate()';
  RAISE NOTICE '- generate_affiliate_code()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '- affiliate_applications_admin';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies and indexes created';
  RAISE NOTICE '========================================';
END $$;

-- Return success message
SELECT 
  'Affiliate system setup completed successfully!' as message,
  'Check the admin panel at /admin/affiliate-applications' as next_step;
