-- Migration: Fix PNL values in trades table
-- Description: Updates NULL PNL values in trades table with values from trades_staging or calculates them

-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240716000001_fix_pnl_in_trades'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description, applied_at) 
    VALUES ('20240716000001_fix_pnl_in_trades', 'Fix PNL values in trades table', NOW());
    
    -- First, ensure the clean_dollar_sign function exists
    CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
    RETURNS NUMERIC AS $$
    DECLARE
      cleaned_value TEXT;
    BEGIN
      -- Return 0 for NULL or empty values
      IF value IS NULL OR value = '' THEN
        RETURN 0;
      END IF;
      
      -- First, trim whitespace
      cleaned_value := TRIM(value);
      
      -- Handle dollar sign at the beginning
      IF LEFT(cleaned_value, 1) = '$' THEN
        cleaned_value := SUBSTRING(cleaned_value FROM 2);
      END IF;
      
      -- Remove commas and other non-numeric characters except decimal points and negative signs
      cleaned_value := REGEXP_REPLACE(cleaned_value, '[^0-9.-]', '', 'g');
      
      -- Handle empty string after cleaning
      IF cleaned_value = '' OR cleaned_value = '-' OR cleaned_value = '.' THEN
        RETURN 0;
      END IF;
      
      -- Convert to numeric with robust error handling
      BEGIN
        RETURN cleaned_value::NUMERIC;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
          RETURN 0;
      END;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error cleaning dollar sign from value "%": %', value, SQLERRM;
        RETURN 0;
    END;
    $$ LANGUAGE plpgsql;

    -- Fix NULL or zero PNL values in trades table
    -- First, update trades that have corresponding staging records with PNL values
    UPDATE trades t
    SET pnl = clean_dollar_sign(s.pnl::TEXT)
    FROM trades_staging s
    WHERE 
      t.user_id = s.user_id 
      AND t.symbol = s.symbol 
      AND t.buyfillid = s.buyfillid
      AND t.sellfillid = s.sellfillid
      AND (t.pnl IS NULL OR t.pnl = 0)
      AND s.pnl IS NOT NULL 
      AND s.pnl != 0;
      
    -- Then, calculate PNL for any remaining trades with NULL or zero PNL but valid prices and quantity
    UPDATE trades
    SET pnl = 
      CASE 
        WHEN position = 'long' THEN (exit_price - entry_price) * quantity
        ELSE (entry_price - exit_price) * quantity
      END
    WHERE 
      (pnl IS NULL OR pnl = 0) 
      AND entry_price IS NOT NULL 
      AND exit_price IS NOT NULL 
      AND quantity IS NOT NULL;
      
    -- Finally, recalculate analytics for all users
    DO $$
    DECLARE
      v_user_id UUID;
    BEGIN
      FOR v_user_id IN SELECT DISTINCT user_id FROM trades
      LOOP
        BEGIN
          PERFORM calculate_user_analytics(v_user_id);
        EXCEPTION 
          WHEN OTHERS THEN
            RAISE NOTICE 'Error calculating analytics for user %: %', v_user_id, SQLERRM;
        END;
      END LOOP;
    END $$;
    
    RAISE NOTICE 'Migration 20240716000001_fix_pnl_in_trades has been applied';
  END IF;
END $$; 