-- Migration: Fix Case Sensitivity Issues in Database Migrations
-- Description: Creates a migration script to fix case sensitivity issues with column names

-- Log migration start in a DO block
DO $$
BEGIN
  RAISE NOTICE 'Starting case sensitivity fix migration';

  -- Fix migration 20240716000001_fix_pnl_in_trades.sql which uses lowercase column names
  -- We'll create a function that performs the same PNL updates but with correctly cased column names

  -- First, update trades that have corresponding staging records with PNL values
  UPDATE trades t
  SET pnl = clean_dollar_sign(s.pnl::TEXT)
  FROM trades_staging s
  WHERE 
    t.user_id = s.user_id 
    AND t.symbol = s.symbol 
    AND t."buyFillId" = s.buyfillid  -- Fixed case sensitivity issue
    AND t."sellFillId" = s.sellfillid  -- Fixed case sensitivity issue
    AND (t.pnl IS NULL OR t.pnl = 0)
    AND s.pnl IS NOT NULL 
    AND s.pnl != 0;

  -- Update any missing values in the trades_staging table to use the proper case
  UPDATE trades_staging s
  SET 
    "buyFillId" = s.buyfillid,
    "sellFillId" = s.sellfillid
  WHERE 
    s."buyFillId" IS NULL AND s.buyfillid IS NOT NULL
    OR s."sellFillId" IS NULL AND s.sellfillid IS NOT NULL;

  -- Log success message
  RAISE NOTICE 'Case sensitivity migration fixes completed';
END $$;

-- Check for any other migrations with case issues and fix them
-- Migration 20240716000004_fix_pnl_in_trades.sql has case-sensitive joins
DO $$ 
DECLARE
  v_user_id UUID; -- Added declaration for v_user_id
BEGIN
  EXECUTE '
    -- Fix trades with PNL issues
    UPDATE trades t
    SET pnl = s.calculated_pnl
    FROM (
      SELECT 
        user_id,
        symbol,
        "buyFillId", -- Use properly-cased column names
        "sellFillId",
        CASE 
          WHEN position = ''long'' THEN (exit_price - entry_price) * quantity
          ELSE (entry_price - exit_price) * quantity
        END AS calculated_pnl
      FROM trades
      WHERE entry_price IS NOT NULL 
      AND exit_price IS NOT NULL 
      AND quantity IS NOT NULL
    ) s
    WHERE 
      t.user_id = s.user_id
      AND t.symbol = s.symbol
      AND t."buyFillId" = s."buyFillId"  -- Properly cased columns
      AND t."sellFillId" = s."sellFillId"
      AND (t.pnl IS NULL OR t.pnl = 0)
      AND s.calculated_pnl IS NOT NULL
      AND s.calculated_pnl != 0;
  ';

  -- Recalculate analytics after the fixes
  FOR v_user_id IN SELECT DISTINCT user_id FROM trades LOOP
    BEGIN
      PERFORM calculate_user_analytics(v_user_id);
    EXCEPTION 
      WHEN OTHERS THEN
        RAISE NOTICE 'Error calculating analytics for user %: %', v_user_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Additional case sensitivity fixes and analytics recalculation completed';
END $$; 