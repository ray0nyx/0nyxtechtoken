-- Create subscription_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL,
  price_yearly numeric NOT NULL,
  features jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'trialing',
  trial_start_date timestamptz DEFAULT now(),
  trial_end_date timestamptz DEFAULT (now() + interval '14 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  is_developer boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create function to handle new user creation and initialization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a record into public.users
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth process
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to handle new user creation
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Make sure public.users table exists with proper structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END
$$;

-- Add RLS policies to users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own records
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Create function to redirect users after signup
CREATE OR REPLACE FUNCTION public.get_redirect_url(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  has_subscription BOOLEAN;
BEGIN
  -- Check if user has any subscription
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = $1 AND (status = 'active' OR status = 'trialing')
  ) INTO has_subscription;
  
  -- If user has subscription, redirect to dashboard
  -- Otherwise redirect to pricing
  IF has_subscription THEN
    RETURN '/app/dashboard';
  ELSE
    RETURN '/app/pricing';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Default to pricing on error
  RETURN '/app/pricing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow users to view their own subscription"
  ON user_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to view active plans"
  ON subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Insert default plans if they don't exist
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, is_active)
VALUES 
  ('Basic', 'Perfect for individual traders', 9.99, 99.99, '{"features": ["Basic analytics", "Trade tracking", "CSV imports"]}', true),
  ('Pro', 'For serious traders', 19.99, 199.99, '{"features": ["Advanced analytics", "API integrations", "Priority support"]}', true)
ON CONFLICT DO NOTHING; 