-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    stripe_price_id text NOT NULL UNIQUE,
    price numeric(10,2) NOT NULL,
    interval text NOT NULL CHECK (interval IN ('month', 'year')),
    features jsonb NOT NULL DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription_tier_id uuid REFERENCES public.subscription_tiers(id),
    stripe_customer_id text,
    stripe_subscription_id text,
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')),
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscription tiers policies
CREATE POLICY "Allow read access to all users for subscription_tiers"
    ON public.subscription_tiers
    FOR SELECT
    TO authenticated
    USING (true);

-- User subscriptions policies
CREATE POLICY "Users can view their own subscription"
    ON public.user_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Function to check if user has active subscription or trial
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_subscriptions
        WHERE user_id = user_uuid
        AND (
            -- Has active subscription
            (status = 'active' AND current_period_end > now())
            OR
            -- Is in trial period
            (status = 'trialing' AND trial_end > now())
        )
    );
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert trial subscription for new user
    INSERT INTO public.user_subscriptions (
        user_id,
        status,
        trial_start,
        trial_end
    ) VALUES (
        NEW.id,
        'trialing',
        now(),
        now() + interval '14 days'
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_trial();

-- Function to check subscription status before allowing access
CREATE OR REPLACE FUNCTION public.require_active_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_active_subscription(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: No active subscription';
    END IF;
    RETURN NEW;
END;
$$;

-- Insert default subscription tiers
INSERT INTO public.subscription_tiers (name, stripe_price_id, price, interval, features) VALUES
    ('Basic', 'price_basic_monthly', 9.99, 'month', '{"max_trades": 100, "analytics": true}'),
    ('Pro', 'price_pro_monthly', 19.99, 'month', '{"max_trades": 500, "analytics": true, "api_access": true}'),
    ('Enterprise', 'price_enterprise_monthly', 49.99, 'month', '{"max_trades": -1, "analytics": true, "api_access": true, "priority_support": true}')
ON CONFLICT (stripe_price_id) DO UPDATE
SET 
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    updated_at = now(); 