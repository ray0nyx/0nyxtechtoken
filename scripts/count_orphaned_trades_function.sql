-- Create a function to count orphaned trades (trades with invalid account_id references)
CREATE OR REPLACE FUNCTION count_orphaned_trades()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count orphaned trades
  SELECT COUNT(*)
  INTO v_count
  FROM trades t
  LEFT JOIN trading_accounts ta ON t.account_id = ta.id
  WHERE t.user_id = v_user_id AND ta.id IS NULL AND t.account_id IS NOT NULL;
  
  RETURN v_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION count_orphaned_trades() TO authenticated; 