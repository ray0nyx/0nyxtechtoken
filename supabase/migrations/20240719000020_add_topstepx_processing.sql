-- Migration to add TopstepX CSV processing functions
-- Similar to the Tradovate functions but adapted for TopstepX format

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
    v_calculated_pnl - COALESCE(p_fees, 0),
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

-- Drop the existing function first
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);

-- Function to process a batch of TopstepX trades
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  -- Extract user ID from the first trade (all trades should have the same user ID)
  IF jsonb_array_length(p_data) > 0 THEN
    v_user_id := (p_data->0->>'user_id')::UUID;
    v_account_id := (p_data->0->>'account_id')::UUID;
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No trades provided',
      'processed', 0
    );
  END IF;

  -- Process each trade in the batch
  FOR v_trade IN SELECT * FROM jsonb_array_elements(p_data) LOOP
    BEGIN
      -- Process the trade
      v_trade_id := process_topstepx_trade(
        v_user_id,
        v_trade->>'contract_name',
        (v_trade->>'entered_at')::TIMESTAMP,
        (v_trade->>'exited_at')::TIMESTAMP,
        (v_trade->>'entry_price')::NUMERIC,
        (v_trade->>'exit_price')::NUMERIC,
        (v_trade->>'fees')::NUMERIC,
        (v_trade->>'pnl')::NUMERIC,
        (v_trade->>'size')::INTEGER,
        v_trade->>'type',
        (v_trade->>'trade_day')::TIMESTAMP,
        (v_trade->>'trade_duration')::INTEGER,
        v_account_id
      );
      
      -- Add result to results array
      IF v_trade_id IS NOT NULL THEN
        v_success_count := v_success_count + 1;
        v_results := v_results || jsonb_build_object(
          'trade_id', v_trade_id,
          'success', TRUE
        );
      ELSE
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', 'Failed to process trade'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Add error to results array
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', SQLERRM
        );
    END;
  END LOOP;
  
  -- Try to recalculate PnL periods after all trades are processed
  BEGIN
    PERFORM calculate_period_pnl(v_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating period PnL: %', SQLERRM;
  END;
  
  -- Return summary of results
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'processed', v_success_count
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_trade(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, TIMESTAMP, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated; 