-- Migration to fix analytics initialization with the correct constraints
-- Description: Properly handles the user_id + metric_name unique constraint

-- Update the initialize_user_metrics function to account for the composite unique constraint
CREATE OR REPLACE FUNCTION initialize_user_metrics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_overall_exists BOOLEAN;
BEGIN
    -- Check if the overall metrics record exists for this user
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id 
        AND metric_name = 'overall_metrics'
    ) INTO v_overall_exists;

    -- Insert overall metrics if they don't exist
    IF NOT v_overall_exists THEN
        INSERT INTO analytics (
            user_id,
            metric_name,
            total_trades,
            total_pnl,
            win_rate,
            average_pnl,
            wins,
            losses,
            largest_win,
            largest_loss,
            cumulative_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, metric_name) DO NOTHING;
        
        RAISE NOTICE 'Initialized overall metrics for user %', p_user_id;
    END IF;
    
    -- Initialize an empty monthly metrics record if needed
    -- We'll create a current month record just to ensure the user has metrics
    BEGIN
        INSERT INTO analytics (
            user_id,
            metric_name,
            date,
            total_trades,
            total_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'monthly_metrics',
            DATE_TRUNC('month', CURRENT_DATE)::date,
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, metric_name) 
        WHERE date = DATE_TRUNC('month', CURRENT_DATE)::date
        DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Note: Could not create monthly metrics (non-critical): %', SQLERRM;
    END;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in initialize_user_metrics: %', SQLERRM;
    -- Create record anyway as a fallback, ignoring conflicts
    BEGIN
        INSERT INTO analytics (
            user_id,
            metric_name,
            total_trades,
            total_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, metric_name) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in fallback metrics creation: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Update the ensure_user_metrics_exist function to check correctly
CREATE OR REPLACE FUNCTION ensure_user_metrics_exist(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_metrics_exist BOOLEAN;
BEGIN
    -- Run initialization function first
    PERFORM initialize_user_metrics(p_user_id);
    
    -- Check if at least one metrics record exists for this user
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id
        AND metric_name = 'overall_metrics'
    ) INTO v_metrics_exist;
    
    RETURN v_metrics_exist;
END;
$$ LANGUAGE plpgsql;

-- Update the process_tradovate_csv_batch function
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
    v_metrics_exist BOOLEAN;
BEGIN
    -- Make absolutely sure metrics exist before we start
    v_metrics_exist := ensure_user_metrics_exist(p_user_id);
    
    IF NOT v_metrics_exist THEN
        -- Final attempt to create metrics
        INSERT INTO analytics (
            user_id,
            metric_name,
            total_trades,
            total_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, metric_name) DO NOTHING;
        
        -- Check again
        SELECT EXISTS(
            SELECT 1 
            FROM analytics 
            WHERE user_id = p_user_id
            AND metric_name = 'overall_metrics'
        ) INTO v_metrics_exist;
        
        IF NOT v_metrics_exist THEN
            -- Return error if still no metrics
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Could not create metrics for user: ' || p_user_id,
                'processed_count', 0,
                'successful_count', 0,
                'failed_count', 0,
                'results', '[]'::JSONB
            );
        END IF;
    END IF;
    
    -- Handle empty rows array
    IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'processed_count', 0,
            'successful_count', 0,
            'failed_count', 0,
            'results', '[]'::JSONB
        );
    END IF;
    
    -- Process each row
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
    
    -- Attempt to update analytics after processing 
    BEGIN
        IF v_successful_rows > 0 THEN
            -- Try to calculate analytics for successful trades
            PERFORM calculate_user_analytics(p_user_id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calculating analytics after processing trades: %', SQLERRM;
        -- Non-blocking error - continue processing
    END;
    
    -- Return batch processing results
    RETURN jsonb_build_object(
        'success', v_failed_rows = 0 AND v_successful_rows > 0,
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

-- Update the process_tradovate_csv_row function
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
    -- Check if metrics exist before we start
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = p_user_id
        AND metric_name = 'overall_metrics'
    ) INTO v_metrics_exist;
    
    IF NOT v_metrics_exist THEN
        -- Try to initialize metrics
        PERFORM initialize_user_metrics(p_user_id);
        
        -- Check again
        SELECT EXISTS(
            SELECT 1 
            FROM analytics 
            WHERE user_id = p_user_id
            AND metric_name = 'overall_metrics'
        ) INTO v_metrics_exist;
        
        IF NOT v_metrics_exist THEN
            RAISE EXCEPTION 'No metrics found for user %', p_user_id;
        END IF;
    END IF;

    -- Extract trade data from the row
    v_symbol := p_row->>'symbol';
    v_date := (p_row->>'date')::DATE;
    v_qty := (p_row->>'qty')::INTEGER;
    v_entry_price := REPLACE(REPLACE(p_row->>'entry_price', ',', ''), '$', '')::NUMERIC;
    v_exit_price := REPLACE(REPLACE(p_row->>'exit_price', ',', ''), '$', '')::NUMERIC;
    v_fees := REPLACE(REPLACE(p_row->>'fees', ',', ''), '$', '')::NUMERIC;
    
    -- Handle parentheses for negative values (like "(244.00)")
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

-- Fix the calculate_user_analytics function
CREATE OR REPLACE FUNCTION calculate_user_analytics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_trades_count INTEGER;
    v_total_pnl NUMERIC;
    v_wins INTEGER;
    v_losses INTEGER;
    v_win_rate NUMERIC;
    v_avg_pnl NUMERIC;
    v_largest_win NUMERIC;
    v_largest_loss NUMERIC;
    v_daily_pnl JSONB;
    v_weekly_pnl JSONB;
    v_monthly_pnl JSONB;
BEGIN
    -- Get basic stats
    SELECT 
        COUNT(*),
        COALESCE(SUM(pnl), 0),
        COUNT(*) FILTER (WHERE pnl > 0),
        COUNT(*) FILTER (WHERE pnl < 0)
    INTO 
        v_trades_count, 
        v_total_pnl,
        v_wins,
        v_losses
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate derived stats
    IF v_trades_count > 0 THEN
        v_win_rate := (v_wins::NUMERIC / v_trades_count) * 100;
        v_avg_pnl := v_total_pnl / v_trades_count;
    ELSE
        v_win_rate := 0;
        v_avg_pnl := 0;
    END IF;
    
    -- Get largest win and loss
    SELECT 
        COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0),
        COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0)
    INTO
        v_largest_win,
        v_largest_loss
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate daily PNL
    SELECT jsonb_object_agg(
        date::TEXT, 
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_daily_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date;
    
    -- Calculate weekly PNL
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_weekly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY date_trunc('week', date);
    
    -- Calculate monthly PNL
    SELECT jsonb_object_agg(
        TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
        ROUND(SUM(pnl)::NUMERIC, 2)
    )
    INTO v_monthly_pnl
    FROM trades
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY date_trunc('month', date);
    
    -- Handle NULL values
    v_daily_pnl := COALESCE(v_daily_pnl, '{}'::JSONB);
    v_weekly_pnl := COALESCE(v_weekly_pnl, '{}'::JSONB);
    v_monthly_pnl := COALESCE(v_monthly_pnl, '{}'::JSONB);
    
    -- Update overall metrics for this user
    INSERT INTO analytics (
        user_id,
        metric_name,
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
        'overall_metrics',
        jsonb_build_object('value', v_trades_count),
        jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        jsonb_build_object('value', ROUND(v_win_rate, 2)),
        jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
        jsonb_build_object('value', v_wins),
        jsonb_build_object('value', v_losses),
        jsonb_build_object('value', ROUND(v_largest_win, 2)),
        jsonb_build_object('value', ROUND(v_largest_loss, 2)),
        v_daily_pnl,
        v_weekly_pnl,
        v_monthly_pnl,
        jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, metric_name) 
    WHERE metric_name = 'overall_metrics'
    DO UPDATE SET
        total_trades = jsonb_build_object('value', v_trades_count),
        total_pnl = jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        win_rate = jsonb_build_object('value', ROUND(v_win_rate, 2)),
        average_pnl = jsonb_build_object('value', ROUND(v_avg_pnl, 2)),
        wins = jsonb_build_object('value', v_wins),
        losses = jsonb_build_object('value', v_losses),
        largest_win = jsonb_build_object('value', ROUND(v_largest_win, 2)),
        largest_loss = jsonb_build_object('value', ROUND(v_largest_loss, 2)),
        daily_pnl = v_daily_pnl,
        weekly_pnl = v_weekly_pnl,
        monthly_pnl = v_monthly_pnl,
        cumulative_pnl = jsonb_build_object('value', ROUND(v_total_pnl, 2)),
        updated_at = NOW();

    -- Update monthly metrics
    FOR v_monthly_pnl IN 
    SELECT 
        DATE_TRUNC('month', date)::date AS month_date,
        COUNT(*) AS month_trades,
        SUM(pnl) AS month_pnl,
        COUNT(*) FILTER (WHERE pnl > 0) AS month_wins,
        COUNT(*) FILTER (WHERE pnl < 0) AS month_losses
    FROM trades 
    WHERE user_id = p_user_id
    GROUP BY DATE_TRUNC('month', date)
    LOOP
        -- Calculate win rate for this month
        IF v_monthly_pnl.month_trades > 0 THEN
            v_win_rate := (v_monthly_pnl.month_wins::NUMERIC / v_monthly_pnl.month_trades) * 100;
        ELSE
            v_win_rate := 0;
        END IF;
        
        -- Insert/update monthly record
        INSERT INTO analytics (
            user_id,
            metric_name,
            date,
            total_trades,
            total_pnl,
            win_rate,
            wins,
            losses,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'monthly_metrics',
            v_monthly_pnl.month_date,
            jsonb_build_object('value', v_monthly_pnl.month_trades),
            jsonb_build_object('value', ROUND(v_monthly_pnl.month_pnl, 2)),
            jsonb_build_object('value', ROUND(v_win_rate, 2)),
            jsonb_build_object('value', v_monthly_pnl.month_wins),
            jsonb_build_object('value', v_monthly_pnl.month_losses),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, metric_name) 
        WHERE date = v_monthly_pnl.month_date
        DO UPDATE SET
            total_trades = jsonb_build_object('value', v_monthly_pnl.month_trades),
            total_pnl = jsonb_build_object('value', ROUND(v_monthly_pnl.month_pnl, 2)),
            win_rate = jsonb_build_object('value', ROUND(v_win_rate, 2)),
            wins = jsonb_build_object('value', v_monthly_pnl.month_wins),
            losses = jsonb_build_object('value', v_monthly_pnl.month_losses),
            updated_at = NOW();
    END LOOP;

    RAISE NOTICE 'Analytics calculated for user %', p_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error calculating analytics for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Initialize analytics for existing users
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
GRANT EXECUTE ON FUNCTION initialize_user_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_metrics_exist(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_row(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_analytics(UUID) TO authenticated;
