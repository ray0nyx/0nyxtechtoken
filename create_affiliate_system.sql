-- Create affiliate applications and management system

-- 1. Create affiliate_applications table
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

-- 2. Create affiliates table for approved affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES affiliate_applications(id),
  affiliate_code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,4) DEFAULT 0.30, -- 30% commission
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  total_referrals INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  last_referral_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update existing referrals table to link to affiliates
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id);

-- 4. Create function to generate unique affiliate code
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
  
  -- Check if code exists, if so add numbers
  WHILE EXISTS (SELECT 1 FROM affiliates WHERE affiliate_code = final_code) LOOP
    final_code := base_code || counter::TEXT;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to approve affiliate application
CREATE OR REPLACE FUNCTION approve_affiliate_application(
  application_id UUID,
  admin_user_id UUID,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  app_record affiliate_applications;
  new_affiliate_code TEXT;
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
  
  -- Generate unique affiliate code
  new_affiliate_code := generate_affiliate_code(app_record.email);
  
  -- Create affiliate record
  INSERT INTO affiliates (
    user_id,
    application_id,
    affiliate_code,
    commission_rate
  ) VALUES (
    app_record.user_id,
    application_id,
    new_affiliate_code,
    0.30 -- 30% commission rate
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to deny affiliate application
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

-- 7. Create function to check if user is an approved affiliate
CREATE OR REPLACE FUNCTION is_user_affiliate(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM affiliates 
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create view for admin to see all applications with user details
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

-- 9. Enable RLS on new tables
ALTER TABLE affiliate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies
-- Users can only see their own applications
CREATE POLICY "Users can view own applications" ON affiliate_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own applications
CREATE POLICY "Users can create applications" ON affiliate_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can see all applications (you'll need to define admin check)
CREATE POLICY "Admins can view all applications" ON affiliate_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = auth.uid() 
      AND (is_developer = true OR user_id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76'))
    )
  );

-- Users can only see their own affiliate data
CREATE POLICY "Users can view own affiliate data" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user_id ON affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);

-- 12. Add comments
COMMENT ON TABLE affiliate_applications IS 'Stores affiliate program applications for admin review';
COMMENT ON TABLE affiliates IS 'Stores approved affiliate accounts with tracking codes';
COMMENT ON FUNCTION approve_affiliate_application(UUID, UUID, TEXT) IS 'Approves affiliate application and creates affiliate account';
COMMENT ON FUNCTION deny_affiliate_application(UUID, UUID, TEXT) IS 'Denies affiliate application with admin notes';

-- Show completion message
SELECT 'Affiliate system database setup completed!' as message;
