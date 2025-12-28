-- TRADE DISPLAY DEBUG SCRIPT
-- Run this script to diagnose issues with trade display

DO $$
DECLARE
    v_user_id UUID;
    v_trade_count INTEGER;
    v_null_account_trades INTEGER;
    v_account_count INTEGER;
    v_analytics_count INTEGER;
    v_duplicate_analytics INTEGER;
    rec RECORD;
BEGIN
    -- Get current user
    SELECT auth.uid() INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found. Please log in first.';
    END IF;
    
    RAISE NOTICE '====== TRADE DISPLAY DIAGNOSTIC ======';
    RAISE NOTICE 'User ID: %', v_user_id;
    
    -- Check total trades
    SELECT COUNT(*) INTO v_trade_count
    FROM trades
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Total trades: %', v_trade_count;
    
    -- Check trades with NULL account_id
    SELECT COUNT(*) INTO v_null_account_trades
    FROM trades
    WHERE user_id = v_user_id
    AND account_id IS NULL;
    
    RAISE NOTICE 'Trades with NULL account_id: %', v_null_account_trades;
    
    -- Check accounts
    SELECT COUNT(*) INTO v_account_count
    FROM accounts
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Total accounts: %', v_account_count;
    
    -- Show account details
    RAISE NOTICE '-- Account details --';
    FOR rec IN 
        SELECT id, name, broker, balance, created_at
        FROM accounts
        WHERE user_id = v_user_id
        ORDER BY created_at
    LOOP
        RAISE NOTICE 'Account: % (%), Broker: %, Balance: %, Created: %', 
                      rec.name, rec.id, rec.broker, rec.balance, rec.created_at;
    END LOOP;
    
    -- Check analytics
    SELECT COUNT(*) INTO v_analytics_count
    FROM analytics
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Total analytics entries: %', v_analytics_count;
    
    -- Check for duplicate analytics
    SELECT COUNT(*) INTO v_duplicate_analytics
    FROM (
        SELECT metric_name, COUNT(*)
        FROM analytics
        WHERE user_id = v_user_id
        GROUP BY metric_name
        HAVING COUNT(*) > 1
    ) as dupes;
    
    RAISE NOTICE 'Metrics with duplicates: %', v_duplicate_analytics;
    
    -- Show duplicate metrics if any
    IF v_duplicate_analytics > 0 THEN
        RAISE NOTICE '-- Duplicate metrics --';
        FOR rec IN 
            SELECT metric_name, COUNT(*) as count
            FROM analytics
            WHERE user_id = v_user_id
            GROUP BY metric_name
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        LOOP
            RAISE NOTICE 'Metric: % (% entries)', rec.metric_name, rec.count;
        END LOOP;
    END IF;
    
    -- Sample trades
    RAISE NOTICE '-- Sample of recent trades --';
    FOR rec IN 
        SELECT id, symbol, side, quantity, pnl, account_id, created_at
        FROM trades
        WHERE user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        RAISE NOTICE 'Trade: %, Symbol: %, Side: %, Qty: %, PnL: %, Account: %, Created: %', 
                      rec.id, rec.symbol, rec.side, rec.quantity, rec.pnl, rec.account_id, rec.created_at;
    END LOOP;
    
    -- Diagnose issues
    RAISE NOTICE '====== DIAGNOSIS ======';
    
    IF v_trade_count = 0 THEN
        RAISE NOTICE 'ISSUE: No trades found for your user.';
    END IF;
    
    IF v_account_count = 0 THEN
        RAISE NOTICE 'ISSUE: No accounts found. This is required for trades.';
    END IF;
    
    IF v_null_account_trades > 0 THEN
        RAISE NOTICE 'ISSUE: You have trades with NULL account_id values. These need to be fixed.';
    END IF;
    
    IF v_duplicate_analytics > 0 THEN
        RAISE NOTICE 'ISSUE: You have duplicate analytics entries. These should be cleaned up.';
    END IF;
    
    IF v_trade_count > 0 AND v_null_account_trades = 0 AND v_duplicate_analytics = 0 AND v_account_count > 0 THEN
        RAISE NOTICE 'No obvious issues found. All trades should be displayed correctly.';
    ELSE
        RAISE NOTICE 'Issues found. Run the fix script to resolve them:';
        RAISE NOTICE '-- Run this in SQL console --';
        RAISE NOTICE 'SELECT * FROM fix_trade_display();';
        RAISE NOTICE '-- Or run the direct fix script --';
        RAISE NOTICE 'Copy and run the SQL from: scripts/direct_fix_trades_display.sql';
    END IF;
END $$; 