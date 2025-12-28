-- Add phone column to profiles table for 14-day free trial signup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text;

-- Add index on phone for faster lookups (optional, but useful if we need to search by phone)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN public.profiles.phone IS 'User phone number collected during signup for 14-day free trial';
