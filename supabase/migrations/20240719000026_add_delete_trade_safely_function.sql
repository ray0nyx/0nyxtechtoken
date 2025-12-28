-- Add a function to safely delete trades with proper permission checks
CREATE OR REPLACE FUNCTION delete_trade_safely(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_trade_exists BOOLEAN;
  v_is_owner BOOLEAN;
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
  
  -- Update the user's analytics
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
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in delete_trade_safely: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_trade_safely(UUID, UUID) TO authenticated;

-- Also grant direct delete permissions on trades table to authenticated users
ALTER TABLE IF EXISTS trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own trades" ON trades;
CREATE POLICY "Users can delete their own trades" 
ON trades 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id); 