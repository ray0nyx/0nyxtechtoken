-- Migration to add the missing process_tradovate_csv_row function
-- This function is used by process_tradovate_csv_batch to process individual rows

-- First, create the clean_dollar_amount function if it doesn't exist
CREATE OR REPLACE FUNCTION clean_dollar_amount(p_value TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_cleaned TEXT;
    v_is_negative BOOLEAN := FALSE;
BEGIN
    -- Handle NULL values
    IF p_value IS NULL THEN
        RETURN 0;
    END IF;
    
    v_cleaned := p_value;
    
    -- Check if value is in parentheses (indicating negative)
    IF v_cleaned LIKE '%(%' OR v_cleaned LIKE '%(%)%' THEN
        v_is_negative := TRUE;
    END IF;
    
    -- Remove dollar signs
    v_cleaned := REPLACE(v_cleaned, '$', '');
    
    -- Remove commas
    v_cleaned := REPLACE(v_cleaned, ',', '');
    
    -- Remove parentheses
    v_cleaned := REPLACE(v_cleaned, '(', '');
    v_cleaned := REPLACE(v_cleaned, ')', '');
    
    -- Add negative sign if needed
    IF v_is_negative THEN
        v_cleaned := '-' || v_cleaned;
    END IF;
    
    -- Ensure it's a valid number, return 0 if not
    BEGIN
        RETURN v_cleaned::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not convert "%%" to numeric, returning 0', p_value;
        RETURN 0;
    END;
END;
$$ LANGUAGE plpgsql;

-- Add the process_tradovate_csv_row function
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
    p_user_id UUID,
    p_row JSONB,
    p_account_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_symbol TEXT;
    v_date DATE;
    v_qty INTEGER;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_fees NUMERIC;
    v_pnl NUMERIC;
    v_buy_fill_id TEXT;
    v_sell_fill_id TEXT;
    v_bought_timestamp TIMESTAMP;
    v_sold_timestamp TIMESTAMP;
    v_duration TEXT;
    v_metrics_exist BOOLEAN;
    v_trade_id UUID;
BEGIN
    -- Check if metrics exist before we start
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id
    ) INTO v_metrics_exist;
    
    IF NOT v_metrics_exist THEN
        -- Try to initialize metrics
        PERFORM calculate_user_analytics(p_user_id);
        
        -- Check again
        SELECT EXISTS(
            SELECT 1 
            FROM analytics 
            WHERE user_id = p_user_id
        ) INTO v_metrics_exist;
        
        IF NOT v_metrics_exist THEN
            RAISE WARNING 'No metrics found for user %, but continuing anyway', p_user_id;
        END IF;
    END IF;

    -- Extract trade data from the row
    v_symbol := p_row->>'symbol';
    v_date := (p_row->>'date')::DATE;
    v_qty := (p_row->>'qty')::INTEGER;
    
    -- Use the clean_dollar_amount function for all monetary values
    v_entry_price := clean_dollar_amount(p_row->>'entry_price');
    v_exit_price := clean_dollar_amount(p_row->>'exit_price');
    v_fees := clean_dollar_amount(p_row->>'fees');
    v_pnl := clean_dollar_amount(p_row->>'pnl');
    
    v_buy_fill_id := p_row->>'buyFillId';
    v_sell_fill_id := p_row->>'sellFillId';
    v_bought_timestamp := (p_row->>'boughtTimestamp')::TIMESTAMP;
    v_sold_timestamp := (p_row->>'soldTimestamp')::TIMESTAMP;
    v_duration := p_row->>'duration';
    
    -- Validate required fields
    IF v_symbol IS NULL OR v_qty IS NULL OR 
       v_entry_price IS NULL OR v_exit_price IS NULL THEN
        RAISE EXCEPTION 'Missing required fields in trade data: %', p_row;
    END IF;
    
    -- Handle missing date
    IF v_date IS NULL THEN
        v_date := COALESCE(v_bought_timestamp::DATE, v_sold_timestamp::DATE, CURRENT_DATE);
    END IF;
    
    -- Insert trade into the trades table
    INSERT INTO trades (
        user_id,
        account_id,
        symbol,
        date,
        broker,
        direction,
        quantity,
        entry_price,
        exit_price,
        pnl,
        fees,
        buy_fill_id,
        sell_fill_id,
        entry_date,
        exit_date,
        duration,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_account_id,
        v_symbol,
        v_date,
        'Tradovate',
        CASE WHEN v_qty > 0 THEN 'long' ELSE 'short' END,
        ABS(v_qty),
        v_entry_price,
        v_exit_price,
        v_pnl,
        v_fees,
        v_buy_fill_id,
        v_sell_fill_id,
        v_bought_timestamp,
        v_sold_timestamp,
        v_duration,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_trade_id;
    
    -- Return success with the trade ID
    RETURN jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Return error info
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'trade_data', p_row
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION clean_dollar_amount(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_row(UUID, JSONB, UUID) TO authenticated; 