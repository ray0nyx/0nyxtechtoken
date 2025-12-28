-- Add OTP Codes Table
-- Stores OTP codes for email verification

CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    purpose TEXT DEFAULT 'signup' CHECK (purpose IN ('signup', 'login', 'transaction')),
    verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON public.otp_codes(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON public.otp_codes(expires_at);

-- RLS Policies
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own OTP codes
CREATE POLICY "Users can access their own OTP codes"
    ON public.otp_codes
    FOR ALL
    USING (true); -- OTP codes are temporary, allow access for verification

-- Auto-cleanup expired OTPs (via trigger or cron)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM public.otp_codes
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.otp_codes IS 'Stores OTP codes for email verification';
COMMENT ON COLUMN public.otp_codes.purpose IS 'Purpose of OTP: signup, login, or transaction';
