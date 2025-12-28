-- Emergency fix for dollar sign handling in CSV import
-- Run this script directly in the Supabase SQL Editor

-- Create a simple, robust function to clean dollar signs
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

-- Test the function with various inputs
SELECT 
  clean_dollar_sign('$21.00') AS test1,
  clean_dollar_sign('21.00') AS test2,
  clean_dollar_sign('$1,234.56') AS test3,
  clean_dollar_sign(NULL) AS test4,
  clean_dollar_sign('') AS test5,
  clean_dollar_sign('invalid') AS test6; 