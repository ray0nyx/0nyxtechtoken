-- Fix the delete_trade_safely function to properly handle cases where a user doesn't have analytics metrics
CREATE OR REPLACE FUNCTION delete_trade_safely(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_trade_exists BOOLEAN;
  v_is_owner BOOLEAN;
  v_analytics_exists BOOLEAN;
BEGIN
  -- Check if the trade exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM trades
    WHERE id = p_trade_id AND user_id = p_user_id
  ) INTO v_is_owner;
  
  -- If the user doesn't own this trade, return false
  IF NOT v_is_owner THEN
    RETURN FALSE;
  END IF;
  
  -- Delete the trade
  DELETE FROM trades WHERE id = p_trade_id AND user_id = p_user_id;
  
  -- Check if analytics record exists for this user
  SELECT EXISTS(
    SELECT 1 FROM analytics WHERE user_id = p_user_id
  ) INTO v_analytics_exists;
  
  -- Update the user's analytics if they exist
  IF v_analytics_exists THEN
    BEGIN
      PERFORM update_analytics_for_user(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error updating analytics after trade deletion: %', SQLERRM;
      -- Continue with deletion even if analytics update fails
    END;
    
    -- Calculate period PnL if possible
    BEGIN
      PERFORM calculate_period_pnl(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating period PnL after trade deletion: %', SQLERRM;
      -- Continue even if this fails
    END;
  ELSE
    -- User doesn't have analytics records yet, try to create them
    BEGIN
      PERFORM calculate_user_analytics(p_user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating initial analytics for user: %', SQLERRM;
      -- Continue with deletion even if analytics creation fails
    END;
  END IF;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in delete_trade_safely: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_trade_safely(UUID, UUID) TO authenticated; 