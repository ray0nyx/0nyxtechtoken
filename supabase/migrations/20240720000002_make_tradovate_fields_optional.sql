-- Make entry_price and exit_price optional in the process_tradovate_csv_row function
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
    v_entry_price NUMERIC := 0;
    v_exit_price NUMERIC := 0;
    v_fees NUMERIC := 0;
    v_pnl NUMERIC := 0;
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
    v_symbol := COALESCE(
        p_row->>'symbol', 
        p_row->>'Symbol', 
        p_row->>'SYMBOL', 
        p_row->>'contract', 
        p_row->>'Contract',
        p_row->>'product',
        p_row->>'Product'
    );
    
    -- Validate the essential field is present
    IF v_symbol IS NULL THEN
        RAISE EXCEPTION 'Missing symbol/contract/product in trade data: %', p_row;
    END IF;
    
    -- Handle date fields
    BEGIN
        v_date := COALESCE(
            (p_row->>'date')::DATE,
            (p_row->>'Date')::DATE,
            (p_row->>'tradeDate')::DATE,
            (p_row->>'TradeDate')::DATE,
            CURRENT_DATE
        );
    EXCEPTION WHEN OTHERS THEN
        -- Fall back to current date if parsing fails
        v_date := CURRENT_DATE;
    END;
    
    -- Parse quantity safely
    BEGIN
        v_qty := COALESCE(
            (p_row->>'qty')::INTEGER,
            (p_row->>'Qty')::INTEGER,
            (p_row->>'quantity')::INTEGER,
            (p_row->>'Quantity')::INTEGER,
            (p_row->>'filledQty')::INTEGER,
            (p_row->>'FilledQty')::INTEGER,
            1  -- Default to 1 if not found
        );
    EXCEPTION WHEN OTHERS THEN
        v_qty := 1; -- Default to 1 if parsing fails
    END;
    
    -- Use our safe numeric parsing for monetary values (optional)
    v_entry_price := COALESCE(
        safe_numeric_from_jsonb(p_row, 'entry_price'),
        safe_numeric_from_jsonb(p_row, 'entryPrice'),
        safe_numeric_from_jsonb(p_row, 'buyPrice'),
        safe_numeric_from_jsonb(p_row, 'avgPrice'),
        0
    );
    
    v_exit_price := COALESCE(
        safe_numeric_from_jsonb(p_row, 'exit_price'),
        safe_numeric_from_jsonb(p_row, 'exitPrice'),
        safe_numeric_from_jsonb(p_row, 'sellPrice'),
        0
    );
    
    v_fees := COALESCE(
        safe_numeric_from_jsonb(p_row, 'fees'),
        safe_numeric_from_jsonb(p_row, 'commission'),
        safe_numeric_from_jsonb(p_row, 'commissions'),
        0
    );
    
    v_pnl := COALESCE(
        safe_numeric_from_jsonb(p_row, 'pnl'),
        safe_numeric_from_jsonb(p_row, 'profit'),
        safe_numeric_from_jsonb(p_row, 'profit_loss'),
        0
    );
    
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
    v_metadata := p_row;
    
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