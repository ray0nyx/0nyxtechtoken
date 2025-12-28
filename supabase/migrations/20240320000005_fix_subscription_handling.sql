-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text NOT NULL DEFAULT 'trialing',
    trial_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    trial_end timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + interval '14 days'),
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create function to automatically create a trial subscription for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (user_id, status, trial_start, trial_end)
    VALUES (
        NEW.id,
        'trialing',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + interval '14 days'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Create function to check subscription status
CREATE OR REPLACE FUNCTION check_subscription_status(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_record record;
BEGIN
    -- Get the subscription record for the user
    SELECT * INTO subscription_record
    FROM subscriptions
    WHERE user_id = user_id_param
    LIMIT 1;

    -- If no subscription found, return false
    IF subscription_record IS NULL THEN
        RETURN false;
    END IF;

    -- Check if subscription is active or in trial
    RETURN (
        subscription_record.status = 'active'
        OR (
            subscription_record.status = 'trialing'
            AND subscription_record.trial_end > CURRENT_TIMESTAMP
        )
    );
END;
$$;

-- Create RLS policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Function to get subscription details
CREATE OR REPLACE FUNCTION get_subscription_details(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_record record;
    result jsonb;
BEGIN
    -- Get the subscription record
    SELECT * INTO subscription_record
    FROM subscriptions
    WHERE user_id = user_id_param
    LIMIT 1;

    -- If no subscription found, return empty status
    IF subscription_record IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'none',
            'trial_end', null,
            'is_active', false
        );
    END IF;

    -- Build the response
    result = jsonb_build_object(
        'status', subscription_record.status,
        'trial_end', subscription_record.trial_end,
        'trial_start', subscription_record.trial_start,
        'current_period_end', subscription_record.current_period_end,
        'current_period_start', subscription_record.current_period_start,
        'is_active', (
            subscription_record.status = 'active'
            OR (
                subscription_record.status = 'trialing'
                AND subscription_record.trial_end > CURRENT_TIMESTAMP
            )
        )
    );

    RETURN result;
END;
$$; 