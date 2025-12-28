-- Create or replace the function to clean numeric values with more robust handling
CREATE OR REPLACE FUNCTION clean_numeric_value(value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_value TEXT;
  is_negative BOOLEAN;
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN 0;
  END IF;
  
  -- First, trim whitespace
  cleaned_value := TRIM(value);
  
  -- Check if the value is in parentheses (indicating negative)
  is_negative := LEFT(cleaned_value, 1) = '(' AND RIGHT(cleaned_value, 1) = ')';
  
  -- Remove parentheses if present
  IF is_negative THEN
    cleaned_value := TRIM(SUBSTRING(cleaned_value FROM 2 FOR LENGTH(cleaned_value) - 2));
  END IF;
  
  -- Handle dollar sign at the beginning
  IF LEFT(cleaned_value, 1) = '$' THEN
    cleaned_value := SUBSTRING(cleaned_value FROM 2);
  END IF;
  
  -- Remove commas and other non-numeric characters except decimal points and negative signs
  cleaned_value := REGEXP_REPLACE(cleaned_value, '[^0-9.-]', '', 'g');
  
  -- Handle negative sign from both parentheses and direct negative sign
  IF is_negative AND LEFT(cleaned_value, 1) != '-' THEN
    cleaned_value := '-' || cleaned_value;
  END IF;
  
  -- Handle empty string after cleaning
  IF cleaned_value = '' OR cleaned_value = '.' OR cleaned_value = '-' THEN
    RETURN 0;
  END IF;
  
  -- Convert to numeric
  RETURN cleaned_value::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clean_numeric_value(TEXT) TO authenticated;

-- Create or replace the function to process Tradovate CSV rows with enhanced error handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
  p_user_id UUID,
  p_symbol TEXT,
  p_entry_date TIMESTAMP,
  p_exit_date TIMESTAMP,
  p_quantity TEXT,
  p_position TEXT,
  p_entry_price TEXT,
  p_buy_fill_id TEXT,
  p_sell_fill_id TEXT,
  p_exit_price TEXT,
  p_fees TEXT,
  p_bought_timestamp TIMESTAMP,
  p_sold_timestamp TIMESTAMP,
  p_duration INTERVAL,
  p_account_id UUID DEFAULT NULL,
  p_created_at TIMESTAMP DEFAULT NULL,
  p_updated_at TIMESTAMP DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_id UUID;
  v_position TEXT;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_quantity INTEGER DEFAULT 1;
  v_date DATE;
  v_fees NUMERIC;
  v_pnl NUMERIC;
BEGIN
  -- Clean all numeric values
  v_quantity := COALESCE(clean_numeric_value(p_quantity)::INTEGER, 1);
  v_entry_price := clean_numeric_value(p_entry_price);
  v_exit_price := clean_numeric_value(p_exit_price);
  v_fees := clean_numeric_value(p_fees);
  
  -- Determine position (long or short) based on input or buy/sell timestamps
  IF p_position IS NOT NULL AND p_position != '' THEN
    v_position := LOWER(p_position);
  ELSIF p_bought_timestamp IS NOT NULL AND p_sold_timestamp IS NOT NULL THEN
    IF p_bought_timestamp < p_sold_timestamp THEN
      v_position := 'long';
    ELSE
      v_position := 'short';
    END IF;
  ELSE
    v_position := 'long'; -- Default to long if we can't determine
  END IF;
  
  -- Set entry/exit dates
  v_entry_date := COALESCE(p_entry_date, p_bought_timestamp, NOW());
  v_exit_date := COALESCE(p_exit_date, p_sold_timestamp, NOW());
  
  -- Set date to the entry date (just the date part)
  v_date := DATE(v_entry_date);
  
  -- Calculate PnL based on the position type, prices, and quantity
  IF v_position = 'long' THEN
    v_pnl := (v_exit_price - v_entry_price) * v_quantity - v_fees;
  ELSE
    v_pnl := (v_entry_price - v_exit_price) * v_quantity - v_fees;
  END IF;
  
  -- Insert the trade into the trades table
  INSERT INTO trades (
    id,
    user_id,
    symbol,
    position,
    entry_date,
    exit_date,
    entry_price,
    exit_price,
    quantity,
    pnl,
    fees,
    commission,
    broker,
    date,
    buyFillId,
    sellFillId,
    buyPrice,
    sellPrice,
    boughtTimestamp,
    soldTimestamp,
    duration,
    account_id,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_symbol,
    v_position,
    v_entry_date,
    v_exit_date,
    v_entry_price,
    v_exit_price,
    v_quantity,
    v_pnl,
    v_fees,
    v_fees,
    'Tradovate',
    v_date,
    p_buy_fill_id,
    p_sell_fill_id,
    v_entry_price, -- Use entry_price as buyPrice for now
    v_exit_price,  -- Use exit_price as sellPrice for now
    p_bought_timestamp,
    p_sold_timestamp,
    p_duration,
    p_account_id,
    COALESCE(p_created_at, NOW()),
    COALESCE(p_updated_at, NOW())
  ) RETURNING id INTO v_trade_id;
  
  -- Update analytics for this user
  PERFORM update_analytics_after_trades(p_user_id);
  
  RETURN v_trade_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error processing Tradovate CSV row: %', SQLERRM;
    -- Return NULL to indicate failure
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, TIMESTAMP, INTERVAL, UUID, TIMESTAMP, TIMESTAMP) TO authenticated;

-- Create or replace the function to process Tradovate CSV batch with enhanced error handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data TEXT,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB := '[]'::JSONB;
    v_data_jsonb JSONB;
    v_row JSONB;
    v_trade_id UUID;
    v_count INTEGER := 0;
    v_error TEXT;
    v_analytics_result JSONB;
BEGIN
    -- Parse the input data as JSON
    BEGIN
        v_data_jsonb := p_data::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid JSON data: ' || SQLERRM,
            'processed', 0
        );
    END;
    
    -- Ensure we have an array to work with
    IF jsonb_typeof(v_data_jsonb) <> 'array' THEN
        v_data_jsonb := jsonb_build_array(v_data_jsonb);
    END IF;

    -- Create a temporary table to store results
    CREATE TEMP TABLE IF NOT EXISTS temp_results (
        trade_id UUID,
        success BOOLEAN,
        error_message TEXT
    ) ON COMMIT DROP;

    -- Process each row in the array
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_data_jsonb)
    LOOP
        BEGIN
            -- Process the row with the enhanced function
            v_trade_id := process_tradovate_csv_row(
                p_user_id,
                v_row->>'symbol',
                (v_row->>'entry_date')::TIMESTAMP,
                (v_row->>'exit_date')::TIMESTAMP,
                v_row->>'quantity',
                v_row->>'position',
                v_row->>'entry_price',
                v_row->>'buyFillId',
                v_row->>'sellFillId',
                v_row->>'exit_price',
                v_row->>'fees',
                (v_row->>'boughtTimestamp')::TIMESTAMP,
                (v_row->>'soldTimestamp')::TIMESTAMP,
                (v_row->>'duration')::INTERVAL,
                p_account_id
            );

            -- Store the result
            INSERT INTO temp_results (trade_id, success, error_message)
            VALUES (v_trade_id, TRUE, NULL);
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE NOTICE 'Error processing row: %', v_error;
            
            -- Store the error
            INSERT INTO temp_results (trade_id, success, error_message)
            VALUES (NULL, FALSE, v_error);
        END;
    END LOOP;

    -- Update analytics after processing all trades
    IF v_count > 0 THEN
        v_analytics_result := update_analytics_after_trades(p_user_id);
    END IF;

    -- Build the final result
    SELECT jsonb_build_object(
        'success', v_count > 0,
        'processed', v_count,
        'analytics', v_analytics_result,
        'results', jsonb_agg(
            jsonb_build_object(
                'trade_id', trade_id,
                'success', success,
                'error', error_message
            )
        )
    )
    INTO v_result
    FROM temp_results;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, TEXT, UUID) TO authenticated; 