-- Script to identify problematic rows in TopstepX CSV data
-- Use this to diagnose specific row errors like the one at row 12

/**
 * This function analyzes TopstepX batch data to find rows that might cause problems
 * during processing. It checks for common issues like missing required fields,
 * formatting problems, and data type incompatibilities.
 *
 * Example usage:
 *   SELECT * FROM find_problematic_topstepx_rows('[{"contract_name":"ES",...}]');
 */
CREATE OR REPLACE FUNCTION find_problematic_topstepx_rows(
  p_rows JSONB
) RETURNS TABLE (
  row_number INTEGER,
  is_problematic BOOLEAN,
  issue_description TEXT,
  severity TEXT,
  field_name TEXT,
  field_value TEXT,
  suggestion TEXT
) AS $$
DECLARE
  v_row JSONB;
  v_row_count INTEGER;
  v_field_value TEXT;
  v_numeric_regex TEXT := '^-?\d+(\.\d+)?$';
  v_date_iso_regex TEXT := '^\d{4}-\d{2}-\d{2}';
  v_date_mdy_regex TEXT := '^\d{1,2}/\d{1,2}/\d{4}';
  v_key TEXT;
BEGIN
  -- Check input validity
  IF jsonb_typeof(p_rows) != 'array' THEN
    RETURN QUERY
      SELECT 
        -1 AS row_number,
        TRUE AS is_problematic,
        'Input is not a JSONB array' AS issue_description,
        'ERROR' AS severity,
        'N/A' AS field_name,
        jsonb_typeof(p_rows) AS field_value,
        'Provide a valid JSON array of trade rows' AS suggestion;
    RETURN;
  END IF;
  
  -- Get total row count
  v_row_count := jsonb_array_length(p_rows);
  
  -- Check row count
  IF v_row_count = 0 THEN
    RETURN QUERY
      SELECT 
        -1 AS row_number,
        TRUE AS is_problematic,
        'Input array is empty' AS issue_description,
        'ERROR' AS severity,
        'N/A' AS field_name,
        'Empty array' AS field_value,
        'Provide at least one trade row' AS suggestion;
    RETURN;
  END IF;
  
  -- Check each row
  FOR i IN 0..(v_row_count - 1) LOOP
    v_row := p_rows->i;
    
    -- Check if row is an object
    IF jsonb_typeof(v_row) != 'object' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Row is not a JSONB object' AS issue_description,
          'ERROR' AS severity,
          'N/A' AS field_name,
          jsonb_typeof(v_row) AS field_value,
          'Provide a valid JSON object for this row' AS suggestion;
      CONTINUE;
    END IF;
    
    -- Check required fields
    -- 1. contract_name
    IF NOT (v_row ? 'contract_name') OR (v_row->>'contract_name') IS NULL OR (v_row->>'contract_name') = '' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Missing required field' AS issue_description,
          'ERROR' AS severity,
          'contract_name' AS field_name,
          COALESCE(v_row->>'contract_name', 'NULL') AS field_value,
          'Add a valid contract_name' AS suggestion;
    END IF;
    
    -- 2. entry_price
    IF NOT (v_row ? 'entry_price') OR (v_row->>'entry_price') IS NULL OR (v_row->>'entry_price') = '' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Missing required field' AS issue_description,
          'ERROR' AS severity,
          'entry_price' AS field_name,
          COALESCE(v_row->>'entry_price', 'NULL') AS field_value,
          'Add a valid entry_price' AS suggestion;
    ELSE
      v_field_value := v_row->>'entry_price';
      -- Check if entry_price is a valid number or can be converted to one
      IF NOT (v_field_value ~ v_numeric_regex) THEN
        -- Try removing currency symbols and commas
        IF NOT (REPLACE(REPLACE(v_field_value, '$', ''), ',', '') ~ v_numeric_regex) THEN
          RETURN QUERY
            SELECT 
              i AS row_number,
              TRUE AS is_problematic,
              'Invalid numeric format' AS issue_description,
              'ERROR' AS severity,
              'entry_price' AS field_name,
              v_field_value AS field_value,
              'Format as a valid number (e.g., 100.50)' AS suggestion;
        END IF;
      END IF;
    END IF;
    
    -- 3. exit_price
    IF NOT (v_row ? 'exit_price') OR (v_row->>'exit_price') IS NULL OR (v_row->>'exit_price') = '' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Missing required field' AS issue_description,
          'ERROR' AS severity,
          'exit_price' AS field_name,
          COALESCE(v_row->>'exit_price', 'NULL') AS field_value,
          'Add a valid exit_price' AS suggestion;
    ELSE
      v_field_value := v_row->>'exit_price';
      -- Check if exit_price is a valid number or can be converted to one
      IF NOT (v_field_value ~ v_numeric_regex) THEN
        -- Try removing currency symbols and commas
        IF NOT (REPLACE(REPLACE(v_field_value, '$', ''), ',', '') ~ v_numeric_regex) THEN
          RETURN QUERY
            SELECT 
              i AS row_number,
              TRUE AS is_problematic,
              'Invalid numeric format' AS issue_description,
              'ERROR' AS severity,
              'exit_price' AS field_name,
              v_field_value AS field_value,
              'Format as a valid number (e.g., 100.50)' AS suggestion;
        END IF;
      END IF;
    END IF;
    
    -- 4. entered_at
    IF NOT (v_row ? 'entered_at') OR (v_row->>'entered_at') IS NULL OR (v_row->>'entered_at') = '' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Missing required field' AS issue_description,
          'ERROR' AS severity,
          'entered_at' AS field_name,
          COALESCE(v_row->>'entered_at', 'NULL') AS field_value,
          'Add a valid entered_at date (YYYY-MM-DD or MM/DD/YYYY)' AS suggestion;
    ELSE
      v_field_value := v_row->>'entered_at';
      -- Check if entered_at is a valid date format
      IF NOT (v_field_value ~ v_date_iso_regex) AND NOT (v_field_value ~ v_date_mdy_regex) THEN
        RETURN QUERY
          SELECT 
            i AS row_number,
            TRUE AS is_problematic,
            'Invalid date format' AS issue_description,
            'ERROR' AS severity,
            'entered_at' AS field_name,
            v_field_value AS field_value,
            'Format as YYYY-MM-DD or MM/DD/YYYY' AS suggestion;
      END IF;
    END IF;
    
    -- 5. exited_at
    IF NOT (v_row ? 'exited_at') OR (v_row->>'exited_at') IS NULL OR (v_row->>'exited_at') = '' THEN
      RETURN QUERY
        SELECT 
          i AS row_number,
          TRUE AS is_problematic,
          'Missing required field' AS issue_description,
          'ERROR' AS severity,
          'exited_at' AS field_name,
          COALESCE(v_row->>'exited_at', 'NULL') AS field_value,
          'Add a valid exited_at date (YYYY-MM-DD or MM/DD/YYYY)' AS suggestion;
    ELSE
      v_field_value := v_row->>'exited_at';
      -- Check if exited_at is a valid date format
      IF NOT (v_field_value ~ v_date_iso_regex) AND NOT (v_field_value ~ v_date_mdy_regex) THEN
        RETURN QUERY
          SELECT 
            i AS row_number,
            TRUE AS is_problematic,
            'Invalid date format' AS issue_description,
            'ERROR' AS severity,
            'exited_at' AS field_name,
            v_field_value AS field_value,
            'Format as YYYY-MM-DD or MM/DD/YYYY' AS suggestion;
      END IF;
    END IF;
    
    -- Check optional fields with validation
    -- 6. size (if present)
    IF (v_row ? 'size') AND (v_row->>'size') IS NOT NULL AND (v_row->>'size') != '' THEN
      v_field_value := v_row->>'size';
      -- Check if size is a valid number or can be converted to one
      IF NOT (v_field_value ~ v_numeric_regex) THEN
        -- Try removing commas
        IF NOT (REPLACE(v_field_value, ',', '') ~ v_numeric_regex) THEN
          RETURN QUERY
            SELECT 
              i AS row_number,
              TRUE AS is_problematic,
              'Invalid numeric format' AS issue_description,
              'WARNING' AS severity,
              'size' AS field_name,
              v_field_value AS field_value,
              'Format as a valid number or remove this field' AS suggestion;
        END IF;
      END IF;
    END IF;
    
    -- 7. pnl (if present)
    IF (v_row ? 'pnl') AND (v_row->>'pnl') IS NOT NULL AND (v_row->>'pnl') != '' THEN
      v_field_value := v_row->>'pnl';
      -- Check if pnl is a valid number or can be converted to one
      IF NOT (v_field_value ~ v_numeric_regex) THEN
        -- Try removing currency symbols and commas
        IF NOT (REPLACE(REPLACE(v_field_value, '$', ''), ',', '') ~ v_numeric_regex) THEN
          RETURN QUERY
            SELECT 
              i AS row_number,
              TRUE AS is_problematic,
              'Invalid numeric format' AS issue_description,
              'WARNING' AS severity,
              'pnl' AS field_name,
              v_field_value AS field_value,
              'Format as a valid number or remove this field' AS suggestion;
        END IF;
      END IF;
    END IF;
    
    -- 8. fees (if present)
    IF (v_row ? 'fees') AND (v_row->>'fees') IS NOT NULL AND (v_row->>'fees') != '' THEN
      v_field_value := v_row->>'fees';
      -- Check if fees is a valid number or can be converted to one
      IF NOT (v_field_value ~ v_numeric_regex) THEN
        -- Try removing currency symbols and commas
        IF NOT (REPLACE(REPLACE(v_field_value, '$', ''), ',', '') ~ v_numeric_regex) THEN
          RETURN QUERY
            SELECT 
              i AS row_number,
              TRUE AS is_problematic,
              'Invalid numeric format' AS issue_description,
              'WARNING' AS severity,
              'fees' AS field_name,
              v_field_value AS field_value,
              'Format as a valid number or remove this field' AS suggestion;
        END IF;
      END IF;
    END IF;
    
    -- Check for extra fields that might cause issues
    FOR v_key IN SELECT jsonb_object_keys(v_row) LOOP
      IF v_key NOT IN ('contract_name', 'entry_price', 'exit_price', 'entered_at', 'exited_at', 
                     'size', 'pnl', 'fees', 'side', 'type', 'note', 'user_id', 'account_id') THEN
        RETURN QUERY
          SELECT 
            i AS row_number,
            FALSE AS is_problematic,  -- Not critical but worth noting
            'Unknown field' AS issue_description,
            'INFO' AS severity,
            v_key AS field_name,
            v_row->>v_key AS field_value,
            'This field will be ignored' AS suggestion;
      END IF;
    END LOOP;
  END LOOP;
  
  -- If we get here with no results, all rows are fine
  IF NOT EXISTS (SELECT 1 FROM find_problematic_topstepx_rows WHERE find_problematic_topstepx_rows.p_rows = p_rows) THEN
    RETURN QUERY
      SELECT 
        -1 AS row_number,
        FALSE AS is_problematic,
        'All rows appear valid' AS issue_description,
        'INFO' AS severity,
        'N/A' AS field_name,
        v_row_count::TEXT AS field_value,
        'No corrections needed' AS suggestion;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION find_problematic_topstepx_rows(JSONB) TO authenticated;

-- Helper function to extract specifically row 12 (index 11)
CREATE OR REPLACE FUNCTION extract_row_12(
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  IF jsonb_array_length(p_rows) >= 12 THEN
    RETURN p_rows->11;  -- Index 11 = Row 12
  ELSE
    RETURN jsonb_build_object('error', 'Batch has fewer than 12 rows');
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION extract_row_12(JSONB) TO authenticated;

-- Example usage comment (not executed)
COMMENT ON FUNCTION find_problematic_topstepx_rows(JSONB) IS 
$comment$
Example usage:

1. To analyze all rows in a batch:
SELECT * FROM find_problematic_topstepx_rows('[{"contract_name":"ES",...}]');

2. To focus on row 12 specifically:
SELECT * FROM find_problematic_topstepx_rows('[{"contract_name":"ES",...}]')
WHERE row_number = 11;  -- Remember, arrays are 0-indexed

3. To extract row 12 for detailed inspection:
SELECT extract_row_12('[{"contract_name":"ES",...}]');

Note: Replace the JSON array with your actual data from the client.
$comment$; 