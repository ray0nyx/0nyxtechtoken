-- Function to update expired trials
CREATE OR REPLACE FUNCTION update_expired_trials()
RETURNS void AS $$
BEGIN
  -- Update trials that have expired
  UPDATE user_subscriptions
  SET 
    status = 'expired',
    updated_at = CURRENT_TIMESTAMP
  WHERE 
    status = 'trial' 
    AND trial_end_date < CURRENT_TIMESTAMP;
    
  -- Also update 'trialing' status (for compatibility)
  UPDATE user_subscriptions
  SET 
    status = 'expired',
    updated_at = CURRENT_TIMESTAMP
  WHERE 
    status = 'trialing' 
    AND trial_end_date < CURRENT_TIMESTAMP;
    
  -- Log the operation
  RAISE NOTICE 'Updated expired trials at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that will be called on each row access
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- If the trial has expired but the status is still 'trial' or 'trialing'
  -- update the status to 'expired'
  IF (NEW.status = 'trial' OR NEW.status = 'trialing') AND NEW.trial_end_date < CURRENT_TIMESTAMP THEN
    NEW.status := 'expired';
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to check expiration on each SELECT/UPDATE of user_subscriptions
CREATE TRIGGER check_trial_expiration_trigger
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION check_trial_expiration();

-- Immediately update any already expired trials
SELECT update_expired_trials();

-- Create a scheduled cron job to run daily at midnight
-- Note: requires pg_cron extension to be enabled
DO $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule the job to run daily at midnight
    PERFORM cron.schedule('0 0 * * *', 'SELECT update_expired_trials()');
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Please run the update_expired_trials() function manually or set up an external scheduler.';
  END IF;
END;
$$; 