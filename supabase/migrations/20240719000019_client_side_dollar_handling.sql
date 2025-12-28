-- Migration to update database functions to rely on client-side dollar sign handling
-- The client will now properly clean monetary values before sending to the database

-- Drop the clean_dollar_amount helper function since we now handle this on the client
DROP FUNCTION IF EXISTS clean_dollar_amount(text);
DROP FUNCTION IF EXISTS clean_dollar_sign(text);

-- Update the process_tradovate_csv_batch function to assume values are already cleaned
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE(
  trade_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_row JSONB;
  v_trade_id UUID;
  v_error TEXT;
  v_account_id UUID;
  v_data_array JSONB;
BEGIN
  -- Validate and sanitize the account ID
  IF p_account_id IS NULL THEN
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
  ELSE
    -- Use the provided account ID
    v_account_id := p_account_id;
  END IF;
  
  -- Parse the JSON data to ensure it's valid
  v_data_array := p_data;
  IF v_data_array IS NULL THEN
    RAISE EXCEPTION 'Invalid JSON data provided';
  END IF;

  -- Process each row in the batch
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_data_array) LOOP
    BEGIN
      -- Process the row and get the trade ID
      -- Note: Client is now responsible for cleaning dollar signs and formatting
      v_trade_id := process_tradovate_csv_row(
        p_user_id,
        v_row->>'symbol',
        (v_row->>'created_at')::TIMESTAMP,
        (v_row->>'updated_at')::TIMESTAMP,
        (v_row->>'pnl')::NUMERIC,
        v_row->>'_priceFormat',
        (v_row->>'_tickSize')::NUMERIC,
        v_row->>'buyFillId',
        v_row->>'sellFillId',
        (v_row->>'entry_price')::NUMERIC,
        (v_row->>'exit_price')::NUMERIC,
        (v_row->>'boughtTimestamp')::TIMESTAMP,
        (v_row->>'soldTimestamp')::TIMESTAMP,
        (v_row->>'duration')::INTERVAL,
        v_account_id
      );
      
      -- Return success
      trade_id := v_trade_id;
      success := v_trade_id IS NOT NULL;
      error_message := NULL;
      RETURN NEXT;
    EXCEPTION
      WHEN OTHERS THEN
        -- Return failure with error message
        trade_id := NULL;
        success := FALSE;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated; 