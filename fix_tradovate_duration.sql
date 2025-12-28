-- Function to properly calculate and store duration for Tradovate trades
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_row JSONB;
  v_account_id UUID := p_account_id;
  v_trade_id UUID;
  v_symbol TEXT;
  v_date DATE;
  v_qty INTEGER;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_fees NUMERIC;
  v_pnl NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_bought_timestamp TIMESTAMP;
  v_sold_timestamp TIMESTAMP;
  v_duration INTERVAL;
  v_duration_seconds INTEGER;
BEGIN
  -- Create a default account if none specified
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM accounts 
    WHERE user_id = p_user_id AND platform = 'Tradovate' AND name = 'Default Tradovate'
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- Create a default account
      INSERT INTO accounts (user_id, name, platform, created_at, updated_at)
      VALUES (p_user_id, 'Default Tradovate', 'Tradovate', NOW(), NOW())
      RETURNING id INTO v_account_id;
    END IF;
  END IF;
  
  -- Process each row
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_row := p_rows->i;
    
    -- Extract values with error handling
    v_symbol := v_row->>'symbol';
    v_qty := (v_row->>'qty')::INTEGER;
    
    BEGIN
      v_entry_price := (v_row->>'entry_price')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_entry_price := 0;
    END;
    
    BEGIN
      v_exit_price := (v_row->>'exit_price')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_exit_price := 0;
    END;
    
    BEGIN
      v_fees := (v_row->>'fees')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_fees := 0;
    END;
    
    BEGIN
      v_pnl := (v_row->>'pnl')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      -- Calculate PnL if not provided
      v_pnl := (v_exit_price - v_entry_price) * v_qty - v_fees;
    END;
    
    -- Get timestamps first for proper date calculation
    BEGIN
      v_bought_timestamp := (v_row->>'boughtTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
      v_bought_timestamp := NULL;
    END;
    
    BEGIN
      v_sold_timestamp := (v_row->>'soldTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
      v_sold_timestamp := NULL;
    END;
    
    -- Determine entry and exit timestamps
    -- For long trades, entry is bought time, exit is sold time
    -- For short trades (where bought time is after sold time), reverse them
    IF v_bought_timestamp IS NOT NULL AND v_sold_timestamp IS NOT NULL THEN
      IF v_bought_timestamp < v_sold_timestamp THEN
        -- Long trade
        v_entry_date := v_bought_timestamp;
        v_exit_date := v_sold_timestamp;
      ELSE
        -- Short trade (bought/exit after sold/entry)
        v_entry_date := v_sold_timestamp;
        v_exit_date := v_bought_timestamp;
      END IF;
      
      -- Calculate duration
      IF v_entry_date IS NOT NULL AND v_exit_date IS NOT NULL THEN
        v_duration := v_exit_date - v_entry_date;
      END IF;
    ELSE
      -- Handle cases where one timestamp is missing
      v_entry_date := COALESCE(v_bought_timestamp, v_sold_timestamp);
      v_exit_date := COALESCE(v_sold_timestamp, v_bought_timestamp);
    END IF;
    
    -- Parse date, either from row or from timestamps
    BEGIN
      v_date := (v_row->>'date')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_date := COALESCE(
        v_entry_date::DATE,
        CURRENT_DATE
      );
    END;
    
    -- Check for custom duration string from frontend
    IF v_row->>'duration' IS NOT NULL AND v_duration IS NULL THEN
      BEGIN
        -- Try to parse duration as seconds
        v_duration_seconds := (v_row->>'duration')::INTEGER;
        v_duration := make_interval(secs => v_duration_seconds);
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try parsing directly as interval
          v_duration := (v_row->>'duration')::INTERVAL;
        EXCEPTION WHEN OTHERS THEN
          v_duration := NULL;
        END;
      END;
    END IF;
    
    -- Insert the trade with all timestamps and duration
    INSERT INTO trades (
      user_id,
      account_id,
      symbol,
      side,
      position,
      quantity,
      qty,
      price,
      entry_price,
      exit_price,
      pnl,
      fees,
      entry_date,
      exit_date,
      date,
      timestamp,
      platform,
      created_at,
      updated_at,
      notes,
      "buyFillId",
      "sellFillId",
      "buyPrice",
      "sellPrice",
      "boughtTimestamp",
      "soldTimestamp",
      duration
    ) VALUES (
      p_user_id,
      v_account_id,
      v_symbol,
      CASE WHEN v_entry_date = v_bought_timestamp THEN 'long' ELSE 'short' END,
      CASE WHEN v_entry_date = v_bought_timestamp THEN 'long' ELSE 'short' END,
      v_qty,
      v_qty,
      v_entry_price,
      v_entry_price,
      v_exit_price,
      v_pnl,
      v_fees,
      v_entry_date,
      v_exit_date,
      v_date,
      v_entry_date,
      'Tradovate',
      NOW(),
      NOW(),
      'Imported from Tradovate CSV',
      v_row->>'buyFillId',
      v_row->>'sellFillId',
      v_entry_price,
      v_exit_price,
      v_bought_timestamp,
      v_sold_timestamp,
      v_duration
    )
    RETURNING id INTO v_trade_id;
    
    -- Add to result
    v_result := v_result || jsonb_build_object(
      'id', v_trade_id,
      'success', TRUE,
      'account_id', v_account_id,
      'symbol', v_symbol,
      'entry_date', v_entry_date,
      'exit_date', v_exit_date,
      'duration', v_duration
    );
  END LOOP;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql; 