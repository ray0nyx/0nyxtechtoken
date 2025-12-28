-- Migration: Fix NULL PNL values in trades_staging table
-- Description: Updates NULL PNL values in trades_staging table by calculating them from entry/exit prices

-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240716000002_fix_pnl_in_staging'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description, applied_at) 
    VALUES ('20240716000002_fix_pnl_in_staging', 'Fix NULL PNL values in trades_staging table', NOW());
    
    -- Create a function to clean dollar signs from text values
    CREATE OR REPLACE FUNCTION clean_dollar_sign_text(value TEXT)
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

    -- Update NULL PNL values in trades_staging table
    -- First, try to calculate PNL from entry and exit prices
    UPDATE trades_staging
    SET pnl = 
      CASE 
        WHEN position = 'long' THEN (exit_price - entry_price) * quantity
        WHEN position = 'short' THEN (entry_price - exit_price) * quantity
        ELSE 0
      END
    WHERE 
      pnl IS NULL 
      AND entry_price IS NOT NULL 
      AND exit_price IS NOT NULL 
      AND quantity IS NOT NULL;
      
    -- Log the results
    RAISE NOTICE 'Fixed PNL values in trades_staging table';
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION clean_dollar_sign_text(TEXT) TO authenticated;
    
    RAISE NOTICE 'Migration 20240716000002_fix_pnl_in_staging has been applied';
  END IF;
END $$; 