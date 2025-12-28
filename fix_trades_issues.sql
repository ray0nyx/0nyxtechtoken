-- Create a function to safely delete trades
CREATE OR REPLACE FUNCTION delete_trade_safely(p_trade_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  -- Disable all triggers temporarily to avoid conflicts
  SET session_replication_role = 'replica';
  
  -- Delete the trade
  DELETE FROM trades 
  WHERE id = p_trade_id 
  AND user_id = p_user_id
  RETURNING 1 INTO v_affected;
  
  -- Re-enable triggers
  SET session_replication_role = 'origin';
  
  -- If we deleted something, update the analytics
  IF v_affected IS NOT NULL THEN
    -- Recalculate analytics for the user
    PERFORM calculate_user_analytics(p_user_id);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_trade_safely(UUID, UUID) TO authenticated;

-- Function to ensure analytics are properly updated
CREATE OR REPLACE FUNCTION update_all_user_analytics()
RETURNS VOID AS $$
DECLARE
  user_rec RECORD;
BEGIN
  -- Loop through all users with trades
  FOR user_rec IN 
    SELECT DISTINCT user_id 
    FROM trades 
    WHERE user_id IS NOT NULL
  LOOP
    -- Recalculate analytics for each user
    PERFORM calculate_user_analytics(user_rec.user_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_all_user_analytics() TO authenticated;

-- Update the refresh_analytics_for_user function
CREATE OR REPLACE FUNCTION refresh_analytics_for_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- First, recalculate analytics for the user
  PERFORM calculate_user_analytics(p_user_id);
  
  -- Return success
  RAISE NOTICE 'Analytics refreshed for user %', p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION refresh_analytics_for_user(UUID) TO authenticated;

-- Process any pending trades
SELECT process_pending_trades();

-- Update all analytics
SELECT update_all_user_analytics(); 