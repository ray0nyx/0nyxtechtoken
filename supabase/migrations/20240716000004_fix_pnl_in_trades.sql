-- Migration: Fix NULL PNL values in trades table
-- Description: Updates NULL PNL values in trades table by calculating them from entry/exit prices or copying from trades_staging

-- Check if migration has already been applied
DO $$ 
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240716000004_fix_pnl_in_trades'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description, applied_at) 
    VALUES ('20240716000004_fix_pnl_in_trades', 'Fix NULL PNL values in trades table', NOW());
    
    -- First, update trades that have corresponding staging records with PNL values
    UPDATE trades t
    SET pnl = s.pnl
    FROM trades_staging s
    WHERE 
      t.user_id = s.user_id 
      AND t.symbol = s.symbol 
      AND t."buyFillId" = s.buyfillid
      AND t."sellFillId" = s.sellfillid
      AND (t.pnl IS NULL OR t.pnl = 0)
      AND s.pnl IS NOT NULL 
      AND s.pnl != 0;
      
    -- Then, calculate PNL for any remaining trades with NULL or zero PNL but valid prices and quantity
    UPDATE trades
    SET pnl = 
      CASE 
        WHEN position = 'long' THEN (exit_price - entry_price) * quantity
        WHEN position = 'short' THEN (entry_price - exit_price) * quantity
        ELSE 0
      END
    WHERE 
      (pnl IS NULL OR pnl = 0) 
      AND entry_price IS NOT NULL 
      AND exit_price IS NOT NULL 
      AND quantity IS NOT NULL;
      
    -- Update user_id for trades that have NULL user_id
    -- This assumes all trades belong to the same user shown in staging
    UPDATE trades t
    SET user_id = s.user_id
    FROM trades_staging s
    WHERE 
      t.user_id IS NULL AND
      t."buyFillId" = s.buyfillid AND
      t."sellFillId" = s.sellfillid AND
      s.user_id IS NOT NULL;
      
    -- For any remaining trades with NULL user_id, use the first user_id from staging
    UPDATE trades
    SET user_id = (SELECT user_id FROM trades_staging WHERE user_id IS NOT NULL LIMIT 1)
    WHERE user_id IS NULL;
      
    -- Finally, recalculate analytics for all users
    -- Use a safer approach that doesn't rely on specific function names
    -- First, disable triggers temporarily to avoid cascading updates
    ALTER TABLE trades DISABLE TRIGGER ALL;
    
    -- Then update analytics for each user
    FOR v_user_id IN SELECT DISTINCT user_id FROM trades WHERE user_id IS NOT NULL
    LOOP
      BEGIN
        -- First, delete any existing analytics for this user
        DELETE FROM "analytics" WHERE "user_id" = v_user_id;
        
        -- Then insert new analytics data
        INSERT INTO "analytics" (
            "user_id",
            "total_trades",
            "total_pnl",
            "win_rate",
            "average_pnl",
            "wins",
            "losses",
            "largest_win",
            "largest_loss",
            "daily_pnl",
            "weekly_pnl",
            "monthly_pnl",
            "cumulative_pnl",
            "updated_at"
        )
        SELECT
            v_user_id,
            COUNT(*),
            COALESCE(SUM(pnl), 0),
            CASE WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE pnl > 0))::NUMERIC / COUNT(*) * 100, 2)
            ELSE 0 END,
            CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(pnl) / COUNT(*), 2) ELSE 0 END,
            COUNT(*) FILTER (WHERE pnl > 0),
            COUNT(*) FILTER (WHERE pnl < 0),
            COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0),
            COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0),
            '{}',
            '{}',
            '{}',
            COALESCE(SUM(pnl), 0),
            NOW()
        FROM trades
        WHERE user_id = v_user_id;
      EXCEPTION 
        WHEN OTHERS THEN
          RAISE NOTICE 'Error calculating analytics for user %: %', v_user_id, SQLERRM;
      END;
    END LOOP;
    
    -- Re-enable triggers
    ALTER TABLE trades ENABLE TRIGGER ALL;
    
    RAISE NOTICE 'Migration 20240716000004_fix_pnl_in_trades has been applied';
  END IF;
END $$; 