-- Add a JSONB metadata column to store flexible data
ALTER TABLE trades ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comment on the column to explain its purpose
COMMENT ON COLUMN trades.metadata IS 'Flexible JSONB column for storing additional trade data that does not fit into the standard schema';

-- Create an index on the metadata column for better query performance
CREATE INDEX IF NOT EXISTS idx_trades_metadata ON trades USING gin(metadata);

-- Update process_tradovate_csv_row to include any additional fields in metadata
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
    v_metadata JSONB;
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

    -- Extract trade data from the row with safer parsing
    v_symbol := p_row->>'symbol';
    
    -- Handle date fields
    BEGIN
        v_date := (p_row->>'date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        -- Fall back to current date if parsing fails
        v_date := CURRENT_DATE;
    END;
    
    -- Parse quantity safely
    BEGIN
        v_qty := (p_row->>'qty')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_qty := 1; -- Default to 1 if parsing fails
    END;
    
    -- Use our safe numeric parsing for monetary values
    v_entry_price := safe_numeric_from_jsonb(p_row, 'entry_price');
    v_exit_price := safe_numeric_from_jsonb(p_row, 'exit_price');
    v_fees := safe_numeric_from_jsonb(p_row, 'fees');
    v_pnl := safe_numeric_from_jsonb(p_row, 'pnl');
    
    v_buy_fill_id := p_row->>'buyFillId';
    v_sell_fill_id := p_row->>'sellFillId';
    
    -- Handle timestamp fields safely
    BEGIN
        v_bought_timestamp := (p_row->>'boughtTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_bought_timestamp := NULL;
    END;
    
    BEGIN
        v_sold_timestamp := (p_row->>'soldTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_sold_timestamp := NULL;
    END;
    
    v_duration := p_row->>'duration';
    
    -- Store everything else in the metadata column
    v_metadata := p_row - '{symbol,date,qty,entry_price,exit_price,fees,pnl,buyFillId,sellFillId,boughtTimestamp,soldTimestamp,duration}'::text[];
    
    -- Validate required fields
    IF v_symbol IS NULL OR v_qty IS NULL OR 
       v_entry_price IS NULL OR v_exit_price IS NULL THEN
        RAISE EXCEPTION 'Missing required fields in trade data: %', p_row;
    END IF;
    
    -- Handle missing date
    IF v_date IS NULL THEN
        v_date := COALESCE(v_bought_timestamp::DATE, v_sold_timestamp::DATE, CURRENT_DATE);
    END IF;
    
    -- Insert trade into the trades table with robust error handling
    BEGIN
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
            metadata,
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
            v_metadata,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_trade_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error inserting trade: %', SQLERRM;
    END;
    
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