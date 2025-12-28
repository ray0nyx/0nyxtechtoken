-- Update trial period from 14 days to 7 days
ALTER TABLE user_subscriptions 
  ALTER COLUMN trial_end_date SET DEFAULT (now() + interval '7 days');

-- Update trigger function to use 7-day trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_start_date timestamptz;
  v_trial_end_date timestamptz;
BEGIN
  -- Set trial dates
  v_trial_start_date := NOW();
  v_trial_end_date := v_trial_start_date + INTERVAL '7 days';

  -- Create subscription record
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    connected_accounts
  ) VALUES (
    NEW.id,
    'trial',
    v_trial_start_date,
    v_trial_end_date,
    0
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 