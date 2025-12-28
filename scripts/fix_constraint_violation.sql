/**
 * FIX FOR ANALYTICS CONSTRAINT VIOLATION
 * 
 * This script addresses the "duplicate key value violates unique constraint 
 * analytics_user_id_metric_name_unique" error by:
 * 
 * 1. Updating the analytics processing functions to use ON CONFLICT DO UPDATE
 * 2. Fixing any existing duplicates in the analytics table
 * 3. Ensuring trade processing functions handle analytics correctly
 */

-- PART 1: Fix existing duplicates in analytics table
DO $$
DECLARE
    duplicate_count INT;
    total_count INT;
BEGIN
    -- Count total analytics records
    SELECT COUNT(*) INTO total_count FROM analytics;
    
    -- Count potential duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, metric_name, COUNT(*) 
        FROM analytics
        GROUP BY user_id, metric_name
        HAVING COUNT(*) > 1
    ) AS dupes;
    
    RAISE NOTICE 'Total analytics records: %, Duplicate sets: %', total_count, duplicate_count;
    
    -- Process each user with duplicates
    IF duplicate_count > 0 THEN
        -- Keep only the newest record for each user_id + metric_name combination
        WITH duplicates AS (
            SELECT a.id
            FROM analytics a
            INNER JOIN (
                SELECT user_id, metric_name, MAX(created_at) as max_created
                FROM analytics
                GROUP BY user_id, metric_name
                HAVING COUNT(*) > 1
            ) AS latest
            ON a.user_id = latest.user_id 
            AND a.metric_name = latest.metric_name 
            AND a.created_at < latest.max_created
        )
        DELETE FROM analytics a
        WHERE a.id IN (SELECT id FROM duplicates);
        
        RAISE NOTICE 'Cleaned up duplicate analytics records. Remaining records: %', 
            (SELECT COUNT(*) FROM analytics);
    ELSE
        RAISE NOTICE 'No duplicates found in analytics table.';
    END IF;
END $$;

-- PART 2: Update the refresh_user_analytics function to handle constraint violations
CREATE OR REPLACE FUNCTION refresh_user_analytics(p_user_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_metric_names TEXT[] := ARRAY[
        'winning_days', 'win_rate', 'total_trades', 'total_pnl', 
        'avg_pnl_per_contract', 'avg_win', 'avg_loss', 'profit_factor', 
        'expectancy', 'sharpe_ratio', 'largest_win', 'largest_loss',
        'win_loss_ratio', 'consecutive_wins', 'consecutive_losses'
    ];
    v_metric TEXT;
    v_value NUMERIC;
BEGIN
    -- For each metric, calculate and update
    FOREACH v_metric IN ARRAY v_metric_names
    LOOP
        -- Calculate the metric value
        EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;
        
        -- Insert or update the analytic record - THIS PART HANDLES THE CONSTRAINT
        INSERT INTO analytics (user_id, metric_name, value)
        VALUES (p_user_id, v_metric, v_value)
        ON CONFLICT (user_id, metric_name) 
        DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    END LOOP;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in refresh_user_analytics: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 3: Update process_topstepx_csv_batch to handle analytics properly
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
    p_rows text[][],
    p_is_test boolean DEFAULT false
) RETURNS json[] AS $$
DECLARE
    v_result json[];
    v_row text[];
    v_symbol text;
    v_date date;
    v_qty numeric;
    v_entry_price numeric;
    v_exit_price numeric;
    v_side text;
    v_pnl numeric;
    v_user_id uuid;
    v_account_id uuid;
    v_trade_id uuid;
    v_row_result json;
    v_account_count integer;
    v_error text;
    i integer;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO v_user_id;
    
    -- Ensure user has at least one account
    SELECT COUNT(*) INTO v_account_count FROM accounts WHERE user_id = v_user_id;
    
    IF v_account_count = 0 THEN
        -- Create a default account for the user if none exists
        INSERT INTO accounts (user_id, name, broker, balance, created_at, updated_at)
        VALUES (v_user_id, 'Default Account', 'TopstepX', 0, now(), now())
        RETURNING id INTO v_account_id;
    ELSE
        -- Get the first account for the user (or create one if needed)
        SELECT id INTO v_account_id FROM accounts WHERE user_id = v_user_id ORDER BY created_at LIMIT 1;
    END IF;
    
    -- Process each row
    FOR i IN 1..array_length(p_rows, 1) LOOP
        BEGIN
            v_row := p_rows[i];
            
            -- Parse input values
            v_date := to_date(v_row[1], 'MM/DD/YYYY');
            v_symbol := v_row[6];
            v_qty := v_row[11]::numeric;
            v_entry_price := v_row[8]::numeric;
            v_exit_price := v_row[9]::numeric;
            v_pnl := v_row[15]::numeric;
            
            -- Determine trade side from quantity
            IF v_row[11]::numeric > 0 THEN
                v_side := 'long';
            ELSE
                v_side := 'short';
                -- Make qty positive for database storage
                v_qty := ABS(v_qty);
            END IF;
            
            -- For test mode, just return success without inserting
            IF p_is_test THEN
                v_row_result := json_build_object(
                    'success', true,
                    'row_index', i - 1,
                    'account_id_used', v_account_id
                );
                v_result := array_append(v_result, v_row_result);
                CONTINUE;
            END IF;
            
            -- Insert trade
            INSERT INTO trades (
                user_id, account_id, symbol, date, side, quantity, 
                entry_price, exit_price, pnl, created_at, updated_at
            )
            VALUES (
                v_user_id, v_account_id, v_symbol, v_date, v_side, v_qty,
                v_entry_price, v_exit_price, v_pnl, now(), now()
            )
            RETURNING id INTO v_trade_id;
            
            -- Build success result
            v_row_result := json_build_object(
                'success', true,
                'trade_id', v_trade_id,
                'row_index', i - 1,
                'account_id_used', v_account_id
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- Build error result
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            v_row_result := json_build_object(
                'success', false,
                'error', v_error,
                'row_index', i - 1,
                'account_id_used', v_account_id
            );
        END;
        
        -- Add to result array
        v_result := array_append(v_result, v_row_result);
    END LOOP;
    
    -- Refresh analytics with ON CONFLICT handling
    BEGIN
        PERFORM refresh_user_analytics(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error refreshing analytics: %', SQLERRM;
    END;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 4: Update process_tradovate_csv_batch to handle analytics properly
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_rows text[][],
    p_is_test boolean DEFAULT false
) RETURNS json[] AS $$
DECLARE
    v_result json[];
    v_row text[];
    v_symbol text;
    v_date date;
    v_qty numeric;
    v_entry_price numeric;
    v_exit_price numeric;
    v_side text;
    v_pnl numeric;
    v_user_id uuid;
    v_account_id uuid;
    v_trade_id uuid;
    v_row_result json;
    v_account_count integer;
    v_error text;
    i integer;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO v_user_id;
    
    -- Ensure user has at least one account
    SELECT COUNT(*) INTO v_account_count FROM accounts WHERE user_id = v_user_id;
    
    IF v_account_count = 0 THEN
        -- Create a default account for the user if none exists
        INSERT INTO accounts (user_id, name, broker, balance, created_at, updated_at)
        VALUES (v_user_id, 'Default Account', 'Tradovate', 0, now(), now())
        RETURNING id INTO v_account_id;
    ELSE
        -- Get the first account for the user (or create one if needed)
        SELECT id INTO v_account_id FROM accounts WHERE user_id = v_user_id ORDER BY created_at LIMIT 1;
    END IF;
    
    -- Process each row
    FOR i IN 1..array_length(p_rows, 1) LOOP
        BEGIN
            v_row := p_rows[i];
            
            -- Parse input values
            v_symbol := v_row[1];
            v_date := to_date(v_row[2], 'YYYY-MM-DD');
            v_qty := v_row[3]::numeric;
            v_entry_price := v_row[4]::numeric;
            v_exit_price := v_row[5]::numeric;
            v_side := lower(v_row[6]);
            v_pnl := v_row[7]::numeric;
            
            -- For test mode, just return success without inserting
            IF p_is_test THEN
                v_row_result := json_build_object(
                    'success', true,
                    'row_index', i - 1,
                    'account_id_used', v_account_id
                );
                v_result := array_append(v_result, v_row_result);
                CONTINUE;
            END IF;
            
            -- Insert trade
            INSERT INTO trades (
                user_id, account_id, symbol, date, side, quantity, 
                entry_price, exit_price, pnl, created_at, updated_at
            )
            VALUES (
                v_user_id, v_account_id, v_symbol, v_date, v_side, v_qty,
                v_entry_price, v_exit_price, v_pnl, now(), now()
            )
            RETURNING id INTO v_trade_id;
            
            -- Build success result
            v_row_result := json_build_object(
                'success', true,
                'trade_id', v_trade_id,
                'row_index', i - 1,
                'account_id_used', v_account_id
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- Build error result
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            v_row_result := json_build_object(
                'success', false,
                'error', v_error,
                'row_index', i - 1,
                'account_id_used', v_account_id
            );
        END;
        
        -- Add to result array
        v_result := array_append(v_result, v_row_result);
    END LOOP;
    
    -- Refresh analytics with ON CONFLICT handling
    BEGIN
        PERFORM refresh_user_analytics(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error refreshing analytics: %', SQLERRM;
    END;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 5: Create an explicit fix for the analytics_user_id_metric_name_unique constraint
DO $$
DECLARE
    v_user_id uuid;
    v_metrics_fixed int := 0;
BEGIN
    -- Get current user's ID
    SELECT auth.uid() INTO v_user_id;
    
    -- First delete any duplicates in analytics
    WITH duplicates AS (
        SELECT a.id
        FROM analytics a
        INNER JOIN (
            SELECT user_id, metric_name, MAX(created_at) as max_created
            FROM analytics
            WHERE user_id = v_user_id
            GROUP BY user_id, metric_name
            HAVING COUNT(*) > 1
        ) AS latest
        ON a.user_id = latest.user_id 
        AND a.metric_name = latest.metric_name 
        AND a.created_at < latest.max_created
    )
    DELETE FROM analytics a
    WHERE a.id IN (SELECT id FROM duplicates)
    RETURNING a.id
    INTO v_metrics_fixed;
    
    RAISE NOTICE 'Fixed % duplicate metrics for user %', v_metrics_fixed, v_user_id;
    
    -- Force refresh analytics for the user
    PERFORM refresh_user_analytics(v_user_id);
    
    RAISE NOTICE 'Successfully refreshed analytics for user %', v_user_id;
END $$; 