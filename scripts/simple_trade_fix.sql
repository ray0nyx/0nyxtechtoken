-- SIMPLE TRADE DISPLAY FIX
-- This stripped-down version fixes trade display issues without complex SQL

---- PART 1: Fix account IDs for trades ----

-- 1. First check if user has an account
DO $$
DECLARE
    v_user_id UUID;
    v_account_id UUID;
    v_null_trades INTEGER;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    
    -- Count NULL account trades
    SELECT COUNT(*) INTO v_null_trades
    FROM trades
    WHERE user_id = v_user_id
    AND account_id IS NULL;
    
    RAISE NOTICE 'Found % trades with NULL account_id', v_null_trades;
    
    -- Only continue if there are NULL account trades
    IF v_null_trades > 0 THEN
        -- Find existing account
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = v_user_id
        LIMIT 1;
        
        -- Create account if needed
        IF v_account_id IS NULL THEN
            INSERT INTO accounts (user_id, name, broker, balance, created_at, updated_at)
            VALUES (v_user_id, 'Default Account', 'Default', 0, now(), now())
            RETURNING id INTO v_account_id;
            
            RAISE NOTICE 'Created new account with ID: %', v_account_id;
        END IF;
        
        -- Update trades
        UPDATE trades
        SET account_id = v_account_id
        WHERE user_id = v_user_id
        AND account_id IS NULL;
        
        RAISE NOTICE 'Fixed NULL account_id trades';
    END IF;
END $$;

---- PART 2: Fix duplicate analytics entries ----

-- Delete older duplicate analytics
DO $$
DECLARE
    v_user_id UUID;
    v_deleted INTEGER := 0;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    
    -- Delete duplicate analytics
    WITH duplicates AS (
        SELECT a.id
        FROM analytics a
        LEFT JOIN (
            SELECT user_id, metric_name, MAX(created_at) as latest_date
            FROM analytics
            WHERE user_id = v_user_id
            GROUP BY user_id, metric_name
        ) latest ON a.user_id = latest.user_id 
                 AND a.metric_name = latest.metric_name 
                 AND a.created_at = latest.latest_date
        WHERE a.user_id = v_user_id
        AND latest.latest_date IS NULL
    )
    DELETE FROM analytics
    WHERE id IN (SELECT id FROM duplicates);
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed % duplicate analytics entries', v_deleted;
END $$;

-- Count trades to verify fix
DO $$
DECLARE
    v_user_id UUID;
    v_trade_count INTEGER;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    
    -- Count trades
    SELECT COUNT(*) INTO v_trade_count
    FROM trades
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Total trades after fix: %', v_trade_count;
    RAISE NOTICE 'Please refresh your browser to see all trades.';
END $$; 