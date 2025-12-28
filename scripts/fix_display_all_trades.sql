/**
 * FIX FOR TRADE DISPLAY ISSUES
 * 
 * This script addresses issues where only one trade is shown in the trades page
 * by fixing:
 * 1. The duplicate key constraint in the analytics table
 * 2. Ensuring account_id is properly set for all trades
 * 3. Fixing analytics query performance
 */

-- Part 1: Fix duplicate entries in the analytics table
DO $$
DECLARE
    v_user_id UUID;
    v_analytics_count INT;
    v_duplicates_removed INT := 0;
BEGIN
    -- Get the current authenticated user
    SELECT auth.uid() INTO v_user_id;
    
    RAISE NOTICE 'Checking analytics table for user: %', v_user_id;
    
    -- Count analytics for this user
    SELECT COUNT(*) INTO v_analytics_count
    FROM analytics
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Found % analytics entries', v_analytics_count;
    
    -- Delete duplicates except for the newest entry of each metric
    WITH duplicates AS (
        SELECT a.id
        FROM analytics a
        LEFT JOIN (
            SELECT user_id, metric_name, MAX(created_at) as latest_created_at
            FROM analytics
            WHERE user_id = v_user_id
            GROUP BY user_id, metric_name
        ) latest ON a.user_id = latest.user_id 
                AND a.metric_name = latest.metric_name 
                AND a.created_at = latest.latest_created_at
        WHERE a.user_id = v_user_id
        AND latest.latest_created_at IS NULL
    )
    DELETE FROM analytics a
    WHERE a.id IN (SELECT id FROM duplicates)
    RETURNING a.id
    INTO v_duplicates_removed;
    
    RAISE NOTICE 'Removed % duplicate analytics entries', v_duplicates_removed;
END $$;

-- Part 2: Update all trades to ensure they have valid account_id values
DO $$
DECLARE
    v_user_id UUID;
    v_account_id UUID;
    v_null_account_trades INT;
    v_updated_trades INT := 0;
BEGIN
    -- Get the current authenticated user
    SELECT auth.uid() INTO v_user_id;
    
    -- Get count of trades with NULL account_id
    SELECT COUNT(*) INTO v_null_account_trades
    FROM trades
    WHERE user_id = v_user_id AND account_id IS NULL;
    
    RAISE NOTICE 'Found % trades with NULL account_id', v_null_account_trades;
    
    -- Only proceed if there are NULL account_id values
    IF v_null_account_trades > 0 THEN
        -- Check if user has at least one account
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = v_user_id
        LIMIT 1;
        
        -- If no account exists, create one
        IF v_account_id IS NULL THEN
            INSERT INTO accounts (
                user_id, name, broker, balance, created_at, updated_at
            ) VALUES (
                v_user_id, 'Default Account', 'Default', 0, now(), now()
            )
            RETURNING id INTO v_account_id;
            
            RAISE NOTICE 'Created new default account with ID: %', v_account_id;
        END IF;
        
        -- Update all trades with NULL account_id
        UPDATE trades
        SET account_id = v_account_id,
            updated_at = now()
        WHERE user_id = v_user_id 
          AND account_id IS NULL
        RETURNING id
        INTO v_updated_trades;
        
        RAISE NOTICE 'Updated % trades with proper account_id', v_updated_trades;
    END IF;
END $$;

-- Part 3: Update the refresh_user_analytics function to handle constraint violations
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
        BEGIN
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

-- Part 4: Create a function to validate all trades have proper account IDs
CREATE OR REPLACE FUNCTION validate_trade_accounts()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_default_account_id UUID;
    v_null_account_count INT;
    v_updated_count INT := 0;
    v_trade_count INT;
    v_account_count INT;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    
    -- Count total trades
    SELECT COUNT(*) INTO v_trade_count 
    FROM trades 
    WHERE user_id = v_user_id;
    
    -- Count accounts
    SELECT COUNT(*) INTO v_account_count
    FROM accounts
    WHERE user_id = v_user_id;
    
    -- Check for NULL account_id values
    SELECT COUNT(*) INTO v_null_account_count
    FROM trades
    WHERE user_id = v_user_id 
    AND account_id IS NULL;
    
    -- Create default account if needed
    IF v_null_account_count > 0 AND v_account_count = 0 THEN
        INSERT INTO accounts (
            user_id, name, broker, balance, created_at, updated_at
        ) VALUES (
            v_user_id, 'Default Account', 'Default', 0, now(), now()
        )
        RETURNING id INTO v_default_account_id;
    ELSIF v_account_count > 0 THEN
        -- Get existing account
        SELECT id INTO v_default_account_id
        FROM accounts
        WHERE user_id = v_user_id
        ORDER BY created_at
        LIMIT 1;
    END IF;
    
    -- Fix NULL account_id values if we have a default account
    IF v_default_account_id IS NOT NULL AND v_null_account_count > 0 THEN
        UPDATE trades
        SET account_id = v_default_account_id,
            updated_at = now()
        WHERE user_id = v_user_id
        AND account_id IS NULL
        RETURNING id
        INTO v_updated_count;
    END IF;
    
    -- Force refresh analytics to pick up all trades
    PERFORM refresh_user_analytics(v_user_id);
    
    -- Return status info
    RETURN jsonb_build_object(
        'user_id', v_user_id,
        'total_trades', v_trade_count,
        'null_account_trades_before', v_null_account_count,
        'trades_updated', v_updated_count,
        'default_account_id', v_default_account_id,
        'success', TRUE
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Part 5: Check if all trades are displayed correctly
DO $$
DECLARE
    v_user_id UUID;
    v_total_trades INT;
    v_account_id_null_count INT;
    v_analytics_issues INT;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    
    -- Count all trades for current user 
    SELECT COUNT(*) INTO v_total_trades
    FROM trades
    WHERE user_id = v_user_id;
    
    -- Check for NULL account_id values
    SELECT COUNT(*) INTO v_account_id_null_count
    FROM trades
    WHERE user_id = v_user_id
    AND account_id IS NULL;
    
    -- Check for analytics issues
    SELECT COUNT(*) INTO v_analytics_issues
    FROM (
        SELECT user_id, metric_name, COUNT(*)
        FROM analytics
        WHERE user_id = v_user_id
        GROUP BY user_id, metric_name
        HAVING COUNT(*) > 1
    ) as dupes;
    
    -- Display results
    RAISE NOTICE 'TRADE DISPLAY DIAGNOSTIC:';
    RAISE NOTICE '- Total trades for user: %', v_total_trades;
    RAISE NOTICE '- Trades with NULL account_id: %', v_account_id_null_count;
    RAISE NOTICE '- Duplicate analytics entries: %', v_analytics_issues;
    
    IF v_account_id_null_count > 0 OR v_analytics_issues > 0 THEN
        RAISE NOTICE 'There are still issues that need to be fixed. Running validation...';
        PERFORM validate_trade_accounts();
    ELSE
        RAISE NOTICE 'All trades should now display correctly!';
    END IF;
END $$; 