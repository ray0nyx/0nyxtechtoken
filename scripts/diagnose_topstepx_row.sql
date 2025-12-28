-- Diagnostic function to examine specific rows in TopstepX CSV data
-- Run this function in SQL console to diagnose issues with specific rows

CREATE OR REPLACE FUNCTION diagnose_topstepx_row(
  p_rows JSONB,
  p_row_number INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_diagnostics JSONB;
  v_field_names TEXT[];
  v_field_types JSONB := '{}'::JSONB;
  v_field_values JSONB := '{}'::JSONB;
  v_row_count INTEGER;
  v_current_row INTEGER;
  v_field TEXT;
  v_value TEXT;
  v_field_type TEXT;
BEGIN
  -- Check input validity
  IF jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object(
      'error', 'Input is not a JSONB array',
      'input_type', jsonb_typeof(p_rows)
    );
  END IF;
  
  -- Get total row count
  v_row_count := jsonb_array_length(p_rows);
  
  -- Check row count
  IF v_row_count = 0 THEN
    RETURN jsonb_build_object(
      'error', 'Input array is empty'
    );
  END IF;
  
  -- If specific row number requested, validate it
  IF p_row_number IS NOT NULL THEN
    IF p_row_number < 0 OR p_row_number >= v_row_count THEN
      RETURN jsonb_build_object(
        'error', format('Row number %s is out of bounds (0-%s)', p_row_number, v_row_count - 1),
        'row_count', v_row_count
      );
    END IF;
    
    -- Get the specific row
    v_row := p_rows->p_row_number;
    v_current_row := p_row_number;
  ELSE
    -- Default to first row
    v_row := p_rows->0;
    v_current_row := 0;
  END IF;
  
  -- Get field names from the row
  SELECT array_agg(key) INTO v_field_names
  FROM jsonb_object_keys(v_row) AS key;
  
  -- Analyze each field's type and value
  FOREACH v_field IN ARRAY v_field_names LOOP
    v_value := v_row->>v_field;
    
    -- Try to determine field type
    IF v_value IS NULL THEN
      v_field_type := 'null';
    ELSIF v_value ~ '^-?\d+(\.\d+)?$' THEN
      BEGIN
        -- Try numeric conversion
        PERFORM v_value::NUMERIC;
        v_field_type := 'numeric';
      EXCEPTION WHEN OTHERS THEN
        v_field_type := 'text';
      END;
    ELSIF v_value ~ '^\d{4}-\d{2}-\d{2}' THEN
      BEGIN
        -- Try timestamp conversion
        PERFORM v_value::TIMESTAMP;
        v_field_type := 'timestamp';
      EXCEPTION WHEN OTHERS THEN
        v_field_type := 'text';
      END;
    ELSIF v_value ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
      BEGIN
        -- Try alternative date format (MM/DD/YYYY)
        PERFORM TO_TIMESTAMP(v_value, 'MM/DD/YYYY HH24:MI:SS');
        v_field_type := 'date_mdy';
      EXCEPTION WHEN OTHERS THEN
        v_field_type := 'text';
      END;
    ELSE
      v_field_type := 'text';
    END IF;
    
    -- Store the field type and value
    v_field_types := jsonb_set(v_field_types, ARRAY[v_field], to_jsonb(v_field_type));
    v_field_values := jsonb_set(v_field_values, ARRAY[v_field], to_jsonb(v_value));
  END LOOP;
  
  -- Build up diagnostics
  v_diagnostics := jsonb_build_object(
    'row_number', v_current_row,
    'row_count', v_row_count,
    'field_count', array_length(v_field_names, 1),
    'fields', v_field_names,
    'types', v_field_types,
    'values', v_field_values
  );
  
  -- Add critical field diagnostics
  v_diagnostics := jsonb_set(v_diagnostics, ARRAY['critical_fields'], jsonb_build_object(
    'contract_name', jsonb_build_object(
      'value', v_row->>'contract_name',
      'type', v_field_types->>'contract_name',
      'present', v_row ? 'contract_name'
    ),
    'entry_price', jsonb_build_object(
      'value', v_row->>'entry_price',
      'type', v_field_types->>'entry_price',
      'present', v_row ? 'entry_price',
      'numeric_test', CASE 
        WHEN v_row ? 'entry_price' THEN
          CASE 
            WHEN v_row->>'entry_price' ~ '^-?\d+(\.\d+)?$' THEN 'valid' 
            ELSE 'invalid'
          END
        ELSE 'missing'
      END
    ),
    'exit_price', jsonb_build_object(
      'value', v_row->>'exit_price',
      'type', v_field_types->>'exit_price',
      'present', v_row ? 'exit_price',
      'numeric_test', CASE 
        WHEN v_row ? 'exit_price' THEN
          CASE 
            WHEN v_row->>'exit_price' ~ '^-?\d+(\.\d+)?$' THEN 'valid' 
            ELSE 'invalid'
          END
        ELSE 'missing'
      END
    ),
    'entered_at', jsonb_build_object(
      'value', v_row->>'entered_at',
      'type', v_field_types->>'entered_at',
      'present', v_row ? 'entered_at',
      'timestamp_test', CASE 
        WHEN v_row ? 'entered_at' THEN
          CASE WHEN 
            v_row->>'entered_at' ~ '^\d{4}-\d{2}-\d{2}' OR 
            v_row->>'entered_at' ~ '^\d{1,2}/\d{1,2}/\d{4}'
          THEN 'valid' 
          ELSE 'invalid' 
          END
        ELSE 'missing'
      END
    ),
    'exited_at', jsonb_build_object(
      'value', v_row->>'exited_at',
      'type', v_field_types->>'exited_at',
      'present', v_row ? 'exited_at',
      'timestamp_test', CASE 
        WHEN v_row ? 'exited_at' THEN
          CASE WHEN 
            v_row->>'exited_at' ~ '^\d{4}-\d{2}-\d{2}' OR 
            v_row->>'exited_at' ~ '^\d{1,2}/\d{1,2}/\d{4}'
          THEN 'valid' 
          ELSE 'invalid' 
          END
        ELSE 'missing'
      END
    )
  ));
  
  -- Try CSV conversions on problematic fields
  v_diagnostics := jsonb_set(v_diagnostics, ARRAY['field_conversion_tests'], jsonb_build_object(
    'entry_price', jsonb_build_object(
      'remove_dollar_and_comma', CASE 
        WHEN v_row ? 'entry_price' THEN
          REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '')
        ELSE NULL
      END,
      'as_numeric', CASE 
        WHEN v_row ? 'entry_price' THEN
          CASE WHEN REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$'
          THEN 'would convert' ELSE 'would fail' END
        ELSE 'missing'
      END
    ),
    'exit_price', jsonb_build_object(
      'remove_dollar_and_comma', CASE 
        WHEN v_row ? 'exit_price' THEN
          REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '')
        ELSE NULL
      END,
      'as_numeric', CASE 
        WHEN v_row ? 'exit_price' THEN
          CASE WHEN REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$'
          THEN 'would convert' ELSE 'would fail' END
        ELSE 'missing'
      END
    ),
    'date_formats', jsonb_build_object(
      'entered_at_as_iso', CASE
        WHEN v_row ? 'entered_at' AND v_row->>'entered_at' ~ '^\d{4}-\d{2}-\d{2}' THEN 'already ISO'
        WHEN v_row ? 'entered_at' AND v_row->>'entered_at' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN 'needs conversion from MM/DD/YYYY'
        WHEN v_row ? 'entered_at' THEN 'unknown format'
        ELSE 'missing'
      END,
      'exited_at_as_iso', CASE
        WHEN v_row ? 'exited_at' AND v_row->>'exited_at' ~ '^\d{4}-\d{2}-\d{2}' THEN 'already ISO'
        WHEN v_row ? 'exited_at' AND v_row->>'exited_at' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN 'needs conversion from MM/DD/YYYY'
        WHEN v_row ? 'exited_at' THEN 'unknown format'
        ELSE 'missing'
      END
    )
  ));
  
  -- Add overall assessment
  v_diagnostics := jsonb_set(v_diagnostics, ARRAY['assessment'], jsonb_build_object(
    'has_required_fields', 
      v_row ? 'contract_name' AND 
      v_row ? 'entry_price' AND 
      v_row ? 'exit_price' AND 
      v_row ? 'entered_at' AND 
      v_row ? 'exited_at',
    'likely_issues', (
      SELECT jsonb_agg(issue)
      FROM (
        SELECT 'Missing contract_name' AS issue WHERE NOT (v_row ? 'contract_name')
        UNION ALL
        SELECT 'Missing entry_price' WHERE NOT (v_row ? 'entry_price')
        UNION ALL
        SELECT 'Missing exit_price' WHERE NOT (v_row ? 'exit_price')
        UNION ALL
        SELECT 'Missing entered_at' WHERE NOT (v_row ? 'entered_at')
        UNION ALL
        SELECT 'Missing exited_at' WHERE NOT (v_row ? 'exited_at')
        UNION ALL
        SELECT 'Invalid entry_price format' WHERE 
          v_row ? 'entry_price' AND 
          NOT (v_row->>'entry_price' ~ '^-?\d+(\.\d+)?$') AND
          NOT (REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$')
        UNION ALL
        SELECT 'Invalid exit_price format' WHERE 
          v_row ? 'exit_price' AND 
          NOT (v_row->>'exit_price' ~ '^-?\d+(\.\d+)?$') AND
          NOT (REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$')
        UNION ALL
        SELECT 'Invalid entered_at date format' WHERE 
          v_row ? 'entered_at' AND 
          NOT (v_row->>'entered_at' ~ '^\d{4}-\d{2}-\d{2}') AND
          NOT (v_row->>'entered_at' ~ '^\d{1,2}/\d{1,2}/\d{4}')
        UNION ALL
        SELECT 'Invalid exited_at date format' WHERE 
          v_row ? 'exited_at' AND 
          NOT (v_row->>'exited_at' ~ '^\d{4}-\d{2}-\d{2}') AND
          NOT (v_row->>'exited_at' ~ '^\d{1,2}/\d{1,2}/\d{4}')
      ) issues
    ),
    'fix_recommendation', (
      CASE 
        WHEN NOT (v_row ? 'contract_name') THEN 'Add missing contract_name field'
        WHEN NOT (v_row ? 'entry_price') THEN 'Add missing entry_price field'
        WHEN NOT (v_row ? 'exit_price') THEN 'Add missing exit_price field'
        WHEN NOT (v_row ? 'entered_at') THEN 'Add missing entered_at field'
        WHEN NOT (v_row ? 'exited_at') THEN 'Add missing exited_at field'
        WHEN v_row ? 'entry_price' AND 
             NOT (v_row->>'entry_price' ~ '^-?\d+(\.\d+)?$') AND
             NOT (REPLACE(REPLACE(v_row->>'entry_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$')
          THEN 'Fix entry_price format to be a valid number'
        WHEN v_row ? 'exit_price' AND 
             NOT (v_row->>'exit_price' ~ '^-?\d+(\.\d+)?$') AND
             NOT (REPLACE(REPLACE(v_row->>'exit_price', '$', ''), ',', '') ~ '^-?\d+(\.\d+)?$')
          THEN 'Fix exit_price format to be a valid number'
        WHEN v_row ? 'entered_at' AND 
             NOT (v_row->>'entered_at' ~ '^\d{4}-\d{2}-\d{2}') AND
             NOT (v_row->>'entered_at' ~ '^\d{1,2}/\d{1,2}/\d{4}')
          THEN 'Fix entered_at format to be a valid date (YYYY-MM-DD HH:MM:SS)'
        WHEN v_row ? 'exited_at' AND 
             NOT (v_row->>'exited_at' ~ '^\d{4}-\d{2}-\d{2}') AND
             NOT (v_row->>'exited_at' ~ '^\d{1,2}/\d{1,2}/\d{4}')
          THEN 'Fix exited_at format to be a valid date (YYYY-MM-DD HH:MM:SS)'
        ELSE 'No obvious issues detected. Consider running the new fix_topstepx_row_processing.sql script.'
      END
    )
  ));

  RETURN v_diagnostics;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION diagnose_topstepx_row(JSONB, INTEGER) TO authenticated;

-- Example usage comment (not executed):
/*
-- To diagnose row 12 (which is index 11 since arrays are 0-indexed):
SELECT diagnose_topstepx_row(p_rows, 11) FROM (
  -- Your p_rows parameter from the failing request:
  SELECT '[{"contract_name":"ES",...}]'::jsonb AS p_rows
) AS data;
*/

-- Helper function to extract a specific row from the failing request
-- Use this in your browser console to get the specific row data:
/*
CREATE OR REPLACE FUNCTION extract_topstepx_row(
  p_rows JSONB,
  p_row_number INTEGER
) RETURNS JSONB AS $$
BEGIN
  IF jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object('error', 'Input is not a JSONB array');
  END IF;
  
  IF p_row_number >= 0 AND p_row_number < jsonb_array_length(p_rows) THEN
    RETURN p_rows->p_row_number;
  ELSE
    RETURN jsonb_build_object('error', format('Row index %s out of bounds (0-%s)', 
                                              p_row_number, jsonb_array_length(p_rows) - 1));
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION extract_topstepx_row(JSONB, INTEGER) TO authenticated;
*/ 