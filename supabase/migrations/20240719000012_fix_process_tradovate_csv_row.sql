-- Migration to fix process_tradovate_csv_row to handle missing metrics
-- Description: Addresses the "No metrics found for user" error

-- First, make sure our initialization function is working correctly
CREATE OR REPLACE FUNCTION initialize_user_metrics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if metrics already exist for this user
    SELECT COUNT(*) INTO v_count FROM analytics WHERE user_id = p_user_id;

    IF v_count = 0 THEN
        -- Insert empty metrics record with proper JSONB format
        INSERT INTO analytics (
            user_id,
            total_trades,
            total_pnl,
            win_rate,
            average_pnl,
            wins,
            losses,
            largest_win,
            largest_loss,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            cumulative_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            '{}'::JSONB,
            '{}'::JSONB,
            '{}'::JSONB,
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Initialized empty metrics for user %', p_user_id;
    ELSE
        RAISE NOTICE 'Metrics already exist for user % (count: %)', p_user_id, v_count;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in initialize_user_metrics: %', SQLERRM;
    -- Create record anyway even if there was an error checking
    BEGIN
        INSERT INTO analytics (
            user_id,
            total_trades,
            total_pnl,
            win_rate,
            average_pnl,
            wins,
            losses,
            largest_win,
            largest_loss,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            cumulative_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            '{}'::JSONB,
            '{}'::JSONB,
            '{}'::JSONB,
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        ) ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in fallback metrics creation: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Add function to check and force-create metrics if they don't exist
CREATE OR REPLACE FUNCTION ensure_user_metrics_exist(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Run initialization function first
    PERFORM initialize_user_metrics(p_user_id);
    
    -- Double-check metrics exist
    SELECT COUNT(*) INTO v_count FROM analytics WHERE user_id = p_user_id;
    
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Now drop the process_tradovate_csv_row function to recreate it
DO $$
BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, UUID, JSONB);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping process_tradovate_csv_row: %', SQLERRM;
END $$;

-- Recreate the process_tradovate_csv_row function with better error handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
    p_user_id UUID,
    p_account_id UUID,
    p_row JSONB
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
    -- Check metrics exist before we start
    v_metrics_exist := ensure_user_metrics_exist(p_user_id);
    
    IF NOT v_metrics_exist THEN
        RAISE EXCEPTION 'No metrics found for user % after initialization attempt', p_user_id;
    END IF;

    -- Extract trade data from the row
    v_symbol := p_row->>'symbol';
    v_date := (p_row->>'date')::DATE;
    v_qty := (p_row->>'qty')::INTEGER;
    v_entry_price := REPLACE(REPLACE(p_row->>'entry_price', ',', ''), '$', '')::NUMERIC;
    v_exit_price := REPLACE(REPLACE(p_row->>'exit_price', ',', ''), '$', '')::NUMERIC;
    v_fees := REPLACE(REPLACE(p_row->>'fees', ',', ''), '$', '')::NUMERIC;
    v_pnl := REPLACE(REPLACE(REPLACE(p_row->>'pnl', ',', ''), '$', ''), '(', '-')::NUMERIC;
    v_pnl := REPLACE(v_pnl, ')', '')::NUMERIC;
    v_buy_fill_id := p_row->>'buyFillId';
    v_sell_fill_id := p_row->>'sellFillId';
    v_bought_timestamp := (p_row->>'boughtTimestamp')::TIMESTAMP;
    v_sold_timestamp := (p_row->>'soldTimestamp')::TIMESTAMP;
    v_duration := p_row->>'duration';
    
    -- Validate required fields
    IF v_symbol IS NULL OR v_date IS NULL OR v_qty IS NULL OR 
       v_entry_price IS NULL OR v_exit_price IS NULL THEN
        RAISE EXCEPTION 'Missing required fields in trade data: %', p_row;
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
        bought_timestamp,
        sold_timestamp,
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
        'trade_id', NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Update process_tradovate_csv_batch to handle errors better
DO $$
BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping process_tradovate_csv_batch: %', SQLERRM;
END $$;

-- Recreate process_tradovate_csv_batch with better error handling
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_user_id UUID,
    p_account_id UUID,
    p_rows JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_row JSONB;
    v_result JSONB;
    v_successful_rows INT := 0;
    v_failed_rows INT := 0;
    v_results JSONB[] := '{}';
    v_error TEXT;
    v_analytics_record_exists BOOLEAN;
BEGIN
    -- Make absolutely sure metrics exist before we start
    PERFORM ensure_user_metrics_exist(p_user_id);
    
    -- Double-check analytics record exists
    SELECT EXISTS(
        SELECT 1 FROM analytics WHERE user_id = p_user_id
    ) INTO v_analytics_record_exists;
    
    IF NOT v_analytics_record_exists THEN
        -- Force create a record as a last resort
        INSERT INTO analytics (
            user_id,
            total_trades,
            total_pnl,
            win_rate,
            average_pnl,
            wins,
            losses,
            largest_win,
            largest_loss,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            cumulative_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            '{}'::JSONB,
            '{}'::JSONB,
            '{}'::JSONB,
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Verify again after forced creation
        SELECT EXISTS(
            SELECT 1 FROM analytics WHERE user_id = p_user_id
        ) INTO v_analytics_record_exists;
        
        IF NOT v_analytics_record_exists THEN
            RAISE EXCEPTION 'Failed to create metrics for user % after multiple attempts', p_user_id;
        END IF;
    END IF;
    
    -- Process each row
    IF jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'processed_count', 0,
            'successful_count', 0,
            'failed_count', 0,
            'results', '[]'::JSONB
        );
    END IF;
    
    FOR v_row IN SELECT jsonb_array_elements(p_rows)
    LOOP
        BEGIN
            -- Call the row processor function
            SELECT process_tradovate_csv_row(
                p_user_id, 
                p_account_id, 
                v_row
            ) INTO v_result;
            
            IF (v_result->>'success')::BOOLEAN THEN
                v_successful_rows := v_successful_rows + 1;
            ELSE
                v_failed_rows := v_failed_rows + 1;
            END IF;
            
            v_results := array_append(v_results, v_result);
        EXCEPTION WHEN OTHERS THEN
            v_failed_rows := v_failed_rows + 1;
            v_error := SQLERRM;
            
            v_results := array_append(v_results, jsonb_build_object(
                'success', FALSE,
                'error', v_error,
                'row', v_row
            ));
        END;
    END LOOP;
    
    -- Update analytics after processing trades
    BEGIN
        -- Calculate analytics based on the newly added trades
        PERFORM calculate_user_analytics(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calculating analytics after processing trades: %', SQLERRM;
    END;
    
    -- Return batch processing results
    RETURN jsonb_build_object(
        'success', v_failed_rows = 0,
        'processed_count', v_successful_rows + v_failed_rows,
        'successful_count', v_successful_rows,
        'failed_count', v_failed_rows,
        'results', to_jsonb(v_results)
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in batch processing: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'processed_count', 0,
        'successful_count', 0,
        'failed_count', 0,
        'results', '[]'::JSONB
    );
END;
$$ LANGUAGE plpgsql;

-- Initialize analytics for all users to ensure no gaps
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM auth.users
    LOOP
        BEGIN
            PERFORM ensure_user_metrics_exist(v_user.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to initialize metrics for user %: %', v_user.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION ensure_user_metrics_exist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_row(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, UUID, JSONB) TO authenticated; 