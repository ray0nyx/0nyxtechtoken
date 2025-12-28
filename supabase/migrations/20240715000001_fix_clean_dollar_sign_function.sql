-- Migration: Fix clean_dollar_sign function to handle dollar amounts
-- Description: Updates the clean_dollar_sign function to properly handle dollar amounts with dollar signs

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240715000001_fix_clean_dollar_sign_function'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000001_fix_clean_dollar_sign_function', 'Updates the clean_dollar_sign function to properly handle dollar amounts with dollar signs', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240715000001_fix_clean_dollar_sign_function has already been applied.';
    RETURN;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL,
      description TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000001_fix_clean_dollar_sign_function', 'Updates the clean_dollar_sign function to properly handle dollar amounts with dollar signs', NOW());
END;
$$;

-- Drop the existing function
DROP FUNCTION IF EXISTS clean_dollar_sign(TEXT) CASCADE;

-- Create an improved version of the function
CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
RETURNS NUMERIC AS $$
DECLARE
  cleaned_value TEXT;
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN NULL;
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
    RETURN NULL;
  END IF;
  
  -- Convert to numeric
  RETURN cleaned_value::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql; 