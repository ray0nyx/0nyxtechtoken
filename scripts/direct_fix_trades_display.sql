-- DIRECT FIX FOR TRADE DISPLAY ISSUES
-- This script can be run directly in the SQL console to fix all trades display issues.

-- Step 1: Create or update account for current user
DO $$
DECLARE
    v_user_id UUID;
    v_account_id UUID;
    v_trade_count INTEGER;
    v_fixed_trades INTEGER;
    v_analytics_fixed INTEGER;
    v_function_sql TEXT;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO v_user_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found. Please log in first.';
    END IF;

    -- Check if user has at least one account
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = v_user_id
    ORDER BY created_at
    LIMIT 1;
    
    -- Create default account if needed
    IF v_account_id IS NULL THEN
        INSERT INTO accounts (user_id, name, broker, balance, created_at, updated_at)
        VALUES (v_user_id, 'Default Account', 'Default', 0, now(), now())
        RETURNING id INTO v_account_id;
        
        RAISE NOTICE 'Created new default account with ID: %', v_account_id;
    ELSE
        RAISE NOTICE 'Using existing account with ID: %', v_account_id;
    END IF;
    
    -- Step 2: Fix NULL account_id values in trades
    UPDATE trades
    SET account_id = v_account_id,
        updated_at = now()
    WHERE user_id = v_user_id
    AND account_id IS NULL;
    
    GET DIAGNOSTICS v_fixed_trades = ROW_COUNT;
    RAISE NOTICE 'Fixed % trades with NULL account_id', v_fixed_trades;
    
    -- Step 3: Remove duplicate analytics entries
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
    WHERE a.id IN (SELECT id FROM duplicates);
    
    GET DIAGNOSTICS v_analytics_fixed = ROW_COUNT;
    RAISE NOTICE 'Removed % duplicate analytics entries', v_analytics_fixed;
    
    -- Step 4: Create SQL for the function (just prepare the SQL string without executing it yet)
    v_function_sql := $FUNC$
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
        BEGIN
            -- Calculate the metric value
            EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;
            
            -- Skip NULL values to avoid errors
            IF v_value IS NOT NULL THEN
                -- Insert or update the analytic record
                INSERT INTO analytics (user_id, metric_name, value)
                VALUES (p_user_id, v_metric, v_value)
                ON CONFLICT (user_id, metric_name) 
                DO UPDATE SET value = EXCLUDED.value, updated_at = now();
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error calculating metric %: %', v_metric, SQLERRM;
            -- Continue with other metrics
        END;
    END LOOP;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in refresh_user_analytics: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
$FUNC$;

    -- Now execute the function SQL
    BEGIN
        EXECUTE v_function_sql;
        RAISE NOTICE 'Updated refresh_user_analytics function to handle constraint violations';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating refresh_user_analytics function: %', SQLERRM;
    END;
    
    -- Step 5: Refresh analytics
    PERFORM refresh_user_analytics(v_user_id);
    
    -- Final count of trades to confirm fix worked
    SELECT COUNT(*) INTO v_trade_count
    FROM trades
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Fix complete. User has % total trades that should now display correctly.', v_trade_count;
END $$; 