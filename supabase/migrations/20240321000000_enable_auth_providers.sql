-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create providers table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.providers (
    provider_id text PRIMARY KEY,
    provider jsonb NOT NULL
);

-- Create config table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.config (
    id integer PRIMARY KEY,
    enable_signup boolean DEFAULT true,
    enable_confirmations boolean DEFAULT false,
    mailer_autoconfirm boolean DEFAULT true,
    sms_autoconfirm boolean DEFAULT true,
    site_url text,
    additional_redirect_urls text[]
);

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),¬¬¬
    email text UNIQUE,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token text,
    confirmation_sent_at timestamp with time zone,
    recovery_token text,
    recovery_sent_at timestamp with time zone,
    email_change_token text,
    email_change text,
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text,
    phone_confirmed_at timestamp with time zone,
    phone_change text,
    phone_change_token text,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    email_change_confirm_status smallint,
    banned_until timestamp with time zone,
    reauthentication_token text,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamp with time zone
);

-- Insert default config if not exists
INSERT INTO auth.config (
    id, 
    enable_signup, 
    enable_confirmations, 
    mailer_autoconfirm, 
    sms_autoconfirm,
    site_url,
    additional_redirect_urls
)
VALUES (
    1, 
    true, 
    false, 
    true, 
    true,
    'http://localhost:5173',
    ARRAY['https://localhost:5173', 'http://localhost:3000', 'https://localhost:3000']
)
ON CONFLICT (id) DO UPDATE
SET enable_signup = EXCLUDED.enable_signup,
    enable_confirmations = EXCLUDED.enable_confirmations,
    mailer_autoconfirm = EXCLUDED.mailer_autoconfirm,
    sms_autoconfirm = EXCLUDED.sms_autoconfirm,
    site_url = EXCLUDED.site_url,
    additional_redirect_urls = EXCLUDED.additional_redirect_urls;

-- Enable auth providers with environment variables
INSERT INTO auth.providers (provider_id, provider)
VALUES
    ('google', jsonb_build_object(
        'client_id', COALESCE(current_setting('app.settings.google_client_id', true), 'your-client-id'),
        'secret', COALESCE(current_setting('app.settings.google_client_secret', true), 'your-client-secret'),
        'redirect_uri', COALESCE(current_setting('app.settings.site_url', true), 'http://localhost:5173') || '/auth/callback'
    ))
ON CONFLICT (provider_id) DO UPDATE
SET provider = EXCLUDED.provider;

-- Create identities table for SSO
CREATE TABLE IF NOT EXISTS auth.identities (
    id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (identity_data->>'email') STORED,
    CONSTRAINT identities_pkey PRIMARY KEY (provider, id)
);

-- Enable email auth
UPDATE auth.config
SET enable_signup = true,
    enable_confirmations = false,
    mailer_autoconfirm = true,
    sms_autoconfirm = true; 