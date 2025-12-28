-- More robust solution for dollar sign handling in numeric fields
-- This handles cases where dollar signs are making it through to Supabase Studio UI

-- First, add a much more aggressive clean_dollar_amount function
CREATE OR REPLACE FUNCTION clean_dollar_amount(p_value TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_cleaned TEXT;
    v_is_negative BOOLEAN := FALSE;
BEGIN
    -- Handle NULL/empty values
    IF p_value IS NULL OR p_value = '' OR p_value = '""' OR p_value = '$' THEN
        RETURN 0;
    END IF;
    
    -- Convert to text in case we get a JSON value
    v_cleaned := p_value::TEXT;
    
    -- Check if value is in parentheses (negative)
    IF v_cleaned LIKE '%(%' OR v_cleaned LIKE '%(%)%' THEN
        v_is_negative := TRUE;
    END IF;
    
    -- Check for minus signs
    IF v_cleaned LIKE '-%' OR v_cleaned LIKE '$-%' THEN
        v_is_negative := TRUE;
    END IF;
    
    -- Remove all non-numeric characters except dots (for decimals)
    v_cleaned := regexp_replace(v_cleaned, '[^0-9.]+', '', 'g');
    
    -- Make sure we only have one decimal point
    v_cleaned := regexp_replace(v_cleaned, '(\\.[0-9]*)\\..*', '\\1', 'g');
    
    -- Add negative sign if needed
    IF v_is_negative THEN
        v_cleaned := '-' || v_cleaned;
    END IF;
    
    -- Remove leading zeros (but keep one before decimal)
    v_cleaned := regexp_replace(v_cleaned, '^(-?)0+([0-9])', '\\1\\2', 'g');
    
    -- Special case for just zero
    IF v_cleaned = '' OR v_cleaned = '.' OR v_cleaned = '-.' THEN
        RETURN 0;
    END IF;
    
    -- Ensure it's a valid number
    BEGIN
        RETURN v_cleaned::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not convert "%" to numeric, returning 0. Error: %', p_value, SQLERRM;
        RETURN 0;
    END;
END;
$$ LANGUAGE plpgsql;

-- Update the safe_numeric_from_jsonb function to be more robust
CREATE OR REPLACE FUNCTION safe_numeric_from_jsonb(p_json JSONB, p_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_result NUMERIC := 0;
BEGIN
    -- Check if the key exists
    IF p_json ? p_key THEN
        -- If the value is already numeric, use it directly
        IF jsonb_typeof(p_json->p_key) = 'number' THEN
            RETURN (p_json->p_key)::NUMERIC;
        ELSE
            -- Otherwise convert to text and clean
            RETURN clean_dollar_amount(p_json->>p_key);
        END IF;
    END IF;
    
    RETURN 0;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in safe_numeric_from_jsonb for key "%": %', p_key, SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Modify the trades table to explicitly define allowed data types
ALTER TABLE IF EXISTS trades 
  ALTER COLUMN entry_price TYPE NUMERIC(15,4) USING COALESCE(entry_price, 0),
  ALTER COLUMN exit_price TYPE NUMERIC(15,4) USING COALESCE(exit_price, 0),
  ALTER COLUMN fees TYPE NUMERIC(15,4) USING COALESCE(fees, 0),
  ALTER COLUMN pnl TYPE NUMERIC(15,4) USING COALESCE(pnl, 0);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION clean_dollar_amount(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION safe_numeric_from_jsonb(JSONB, TEXT) TO authenticated; 