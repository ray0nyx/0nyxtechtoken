-- Remove phone authentication from database
-- This migration removes phone-related columns and disables phone auth

-- Remove phone column from profiles table if it exists
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- Remove phone-related columns from auth.users (if we have access)
-- Note: This may require Supabase admin access. If not possible, document that phone auth is disabled via config.
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS phone;
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS phone_confirmed_at;
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS phone_change;
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS phone_change_token;
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS phone_change_sent_at;

-- Disable phone/SMS authentication in auth config
-- Note: This should be done via Supabase dashboard or config.toml
-- UPDATE auth.config SET sms_autoconfirm = false WHERE id = 1;

-- Drop phone-related index if it exists
DROP INDEX IF EXISTS idx_profiles_phone;

-- Add comment documenting phone auth removal
COMMENT ON TABLE public.profiles IS 'User profiles - phone authentication has been removed';
