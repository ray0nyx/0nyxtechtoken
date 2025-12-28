-- Migration to fix RAISE syntax error in clean_dollar_amount function
-- Description: Fixes the "too many parameters specified for RAISE" error

-- Fix the clean_dollar_amount function with correct RAISE syntax
CREATE OR REPLACE FUNCTION clean_dollar_amount(p_value TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_cleaned TEXT;
    v_is_negative BOOLEAN := FALSE;
BEGIN
    -- Handle NULL values
    IF p_value IS NULL THEN
        RETURN 0;
    END IF;
    
    v_cleaned := p_value;
    
    -- Check if value is in parentheses (indicating negative)
    IF v_cleaned LIKE '%(%' OR v_cleaned LIKE '%(%)%' THEN
        v_is_negative := TRUE;
    END IF;
    
    -- Remove dollar signs
    v_cleaned := REPLACE(v_cleaned, '$', '');
    
    -- Remove commas
    v_cleaned := REPLACE(v_cleaned, ',', '');
    
    -- Remove parentheses
    v_cleaned := REPLACE(v_cleaned, '(', '');
    v_cleaned := REPLACE(v_cleaned, ')', '');
    
    -- Add negative sign if needed
    IF v_is_negative THEN
        v_cleaned := '-' || v_cleaned;
    END IF;
    
    -- Ensure it's a valid number, return 0 if not
    BEGIN
        RETURN v_cleaned::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        -- Fix: Corrected RAISE syntax for displaying variable content
        RAISE WARNING 'Could not convert "%" to numeric, returning 0', p_value;
        RETURN 0;
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION clean_dollar_amount(TEXT) TO authenticated; 