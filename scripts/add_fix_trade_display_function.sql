/**
 * ADD FIX_TRADE_DISPLAY FUNCTION
 * 
 * This script adds a new database function that checks for and fixes trade display issues.
 * The function can be called either for a specific user or for all users.
 */

-- Helper function to check for duplicate analytics
CREATE OR REPLACE FUNCTION check_duplicate_analytics(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT user_id, metric_name, COUNT(*)
        FROM analytics
        WHERE user_id = $1
        GROUP BY user_id, metric_name
        HAVING COUNT(*) > 1
    ) as dupes;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to fix trades for a specific user
CREATE OR REPLACE FUNCTION fix_user_trades(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_account_id UUID;
    v_null_count INTEGER;
    v_updated_count INTEGER;
    v_duplicate_count INTEGER;
    v_total_trades INTEGER;
BEGIN
    -- Count total trades
    SELECT COUNT(*) INTO v_total_trades
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Count NULL account_id trades
    SELECT COUNT(*) INTO v_null_count
    FROM trades
    WHERE user_id = p_user_id
    AND account_id IS NULL;
    
    -- Count duplicate analytics
    SELECT check_duplicate_analytics(p_user_id) INTO v_duplicate_count;
    
    -- If no issues, return early
    IF v_null_count = 0 AND v_duplicate_count = 0 THEN
        RETURN jsonb_build_object(
            'user_id', p_user_id,
            'total_trades', v_total_trades,
            'null_account_count', 0,
            'duplicate_analytics', 0,
            'fixed', FALSE,
            'message', 'No issues found'
        );
    END IF;
    
    -- Find or create an account for this user
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = p_user_id
    ORDER BY created_at
    LIMIT 1;
    
    -- Create default account if needed
    IF v_account_id IS NULL THEN
        INSERT INTO accounts (
            user_id, name, broker, balance, created_at, updated_at
        ) VALUES (
            p_user_id, 'Default Account', 'Default', 0, now(), now()
        )
        RETURNING id INTO v_account_id;
    END IF;
    
    -- Fix NULL account_id values
    IF v_null_count > 0 THEN
        UPDATE trades
        SET account_id = v_account_id,
            updated_at = now()
        WHERE user_id = p_user_id
        AND account_id IS NULL;
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSE
        v_updated_count := 0;
    END IF;
    
    -- Fix duplicate analytics
    IF v_duplicate_count > 0 THEN
        WITH duplicates AS (
            SELECT a.id
            FROM analytics a
            INNER JOIN (
                SELECT user_id, metric_name, MAX(created_at) as max_created
                FROM analytics
                WHERE user_id = p_user_id
                GROUP BY user_id, metric_name
                HAVING COUNT(*) > 1
            ) AS latest
            ON a.user_id = latest.user_id 
            AND a.metric_name = latest.metric_name 
            AND a.created_at < latest.max_created
        )
        DELETE FROM analytics a
        WHERE a.id IN (SELECT id FROM duplicates);
        
        -- Refresh analytics for this user
        PERFORM refresh_user_analytics(p_user_id);
    END IF;
    
    -- Return results
    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'total_trades', v_total_trades,
        'null_account_count', v_null_count,
        'duplicate_analytics', v_duplicate_count,
        'updated_trades', v_updated_count,
        'account_id_used', v_account_id,
        'fixed', TRUE,
        'message', 'Issues fixed successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main function to fix trade display issues
CREATE OR REPLACE FUNCTION fix_trade_display(
    p_user_id UUID DEFAULT NULL,
    p_fix_all BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_user_id UUID;
    v_user_results JSONB[] := '{}';
    v_fixed_count INTEGER := 0;
    v_checked_count INTEGER := 0;
BEGIN
    -- Check if specific user or all users
    IF p_user_id IS NOT NULL THEN
        -- Fix for specific user
        v_result := fix_user_trades(p_user_id);
        RETURN v_result;
    ELSIF p_fix_all THEN
        -- Fix for all users
        FOR v_user_id IN 
            SELECT DISTINCT user_id FROM trades
        LOOP
            v_result := fix_user_trades(v_user_id);
            v_user_results := array_append(v_user_results, v_result);
            v_checked_count := v_checked_count + 1;
            
            IF (v_result->>'fixed')::BOOLEAN THEN
                v_fixed_count := v_fixed_count + 1;
            END IF;
        END LOOP;
        
        -- Return overall results
        RETURN jsonb_build_object(
            'total_users_checked', v_checked_count,
            'users_fixed', v_fixed_count,
            'details', v_user_results
        );
    ELSE
        -- If no user specified and not fixing all, use current user
        v_user_id := auth.uid();
        
        IF v_user_id IS NULL THEN
            RETURN jsonb_build_object(
                'error', 'No authenticated user and no user_id provided'
            );
        END IF;
        
        -- Fix for current user
        v_result := fix_user_trades(v_user_id);
        RETURN v_result;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to explain usage
COMMENT ON FUNCTION fix_trade_display IS 
'Fixes trade display issues by ensuring all trades have valid account IDs and
cleaning up duplicate analytics entries. Can be called for the current user,
a specific user, or all users.

Examples:
- For current user: SELECT fix_trade_display();
- For specific user: SELECT fix_trade_display(''user-id-here'');
- For all users: SELECT fix_trade_display(NULL, TRUE);';

-- Create an admin-only function to check all users
CREATE OR REPLACE FUNCTION admin_check_all_users_trade_display()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    total_trades INTEGER,
    null_account_trades INTEGER,
    duplicate_analytics INTEGER,
    needs_fixing BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT 
            t.user_id,
            COUNT(t.id) AS total_trades,
            COUNT(CASE WHEN t.account_id IS NULL THEN 1 ELSE NULL END) AS null_account_trades
        FROM trades t
        GROUP BY t.user_id
    )
    SELECT 
        u.id AS user_id,
        u.email,
        COALESCE(us.total_trades, 0) AS total_trades,
        COALESCE(us.null_account_trades, 0) AS null_account_trades,
        check_duplicate_analytics(u.id) AS duplicate_analytics,
        (COALESCE(us.null_account_trades, 0) > 0 OR check_duplicate_analytics(u.id) > 0) AS needs_fixing
    FROM auth.users u
    LEFT JOIN user_stats us ON u.id = us.user_id
    WHERE EXISTS (SELECT 1 FROM trades t WHERE t.user_id = u.id)
    ORDER BY needs_fixing DESC, total_trades DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 