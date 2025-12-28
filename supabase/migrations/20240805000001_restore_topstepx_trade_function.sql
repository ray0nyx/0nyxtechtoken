-- Migration to restore the missing process_topstepx_trade function

-- Function to process a single TopstepX trade
CREATE OR REPLACE FUNCTION process_topstepx_trade(
  p_user_id UUID,
  p_contract_name TEXT,
  p_entered_at TIMESTAMP,
  p_exited_at TIMESTAMP,
  p_entry_price NUMERIC,
  p_exit_price NUMERIC,
  p_fees NUMERIC DEFAULT 2.50,
  p_pnl NUMERIC DEFAULT NULL,
  p_size INTEGER DEFAULT 1,
  p_type TEXT DEFAULT 'long',
  p_trade_day TIMESTAMP DEFAULT NULL,
  p_trade_duration INTEGER DEFAULT 0,
  p_account_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_position TEXT;
  v_date DATE;
  v_calculated_pnl NUMERIC;
  v_account_id UUID := p_account_id;
BEGIN
  -- Set position type (ensure it's consistent with our schema)
  v_position := LOWER(p_type);
  IF v_position NOT IN ('long', 'short') THEN
    v_position := 'long';
  END IF;
  
  -- Calculate trade date (using entry time if trade_day isn't provided)
  v_date := COALESCE(DATE(p_trade_day), DATE(p_entered_at));
  
  -- If no account_id provided, try to find a default account or create one
  IF v_account_id IS NULL THEN
    -- Try to find a default account for the user
    SELECT id INTO v_account_id 
    FROM trading_accounts 
    WHERE user_id = p_user_id 
    ORDER BY is_default DESC, created_at ASC 
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- No account found, create a default account
      INSERT INTO trading_accounts (user_id, name, is_default) 
      VALUES (p_user_id, 'Default Account', TRUE)
      RETURNING id INTO v_account_id;
    END IF;
  END IF;
  
  -- Calculate P&L if not provided
  IF p_pnl IS NULL THEN
    IF v_position = 'long' THEN
      v_calculated_pnl := (p_exit_price - p_entry_price) * p_size;
    ELSE
      v_calculated_pnl := (p_entry_price - p_exit_price) * p_size;
    END IF;
  ELSE
    v_calculated_pnl := p_pnl;
  END IF;
  
  -- Insert the trade into the trades table
  INSERT INTO trades (
    user_id,
    symbol,
    position,
    entry_date,
    exit_date,
    entry_price,
    exit_price,
    quantity,
    pnl,
    broker,
    date,
    fees,
    account_id,
    duration
  ) VALUES (
    p_user_id,
    p_contract_name,
    v_position,
    p_entered_at,
    p_exited_at,
    p_entry_price,
    p_exit_price,
    p_size,
    v_calculated_pnl,
    'TopstepX',
    v_date,
    p_fees,
    v_account_id,
    INTERVAL '1 second' * p_trade_duration
  ) RETURNING id INTO v_trade_id;
  
  -- Update analytics for this user
  BEGIN
    PERFORM populate_analytics_table(p_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error updating analytics: %', SQLERRM;
  END;
  
  RETURN v_trade_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error processing TopstepX trade: %', SQLERRM;
    -- Return NULL to indicate failure
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_trade(
  UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, TIMESTAMP, INTEGER, UUID
) TO authenticated; 