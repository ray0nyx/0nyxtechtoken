-- Add missing function signature for process_tradovate_csv_batch with only two parameters
-- This is needed because somewhere in the application, the function is being called with only user_id and rows

-- Create the two-parameter version of the function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB
)
RETURNS JSONB AS $$
BEGIN
  -- Call the three-parameter version with a NULL account_id
  RETURN process_tradovate_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also add the same for the alternate function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_alt(
  p_account_id UUID,
  p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to extract user_id from the first row if possible
  BEGIN
    SELECT (p_data->0->>'user_id')::UUID INTO v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  -- Call the three-parameter version
  IF v_user_id IS NOT NULL THEN
    RETURN process_tradovate_csv_batch_alt(p_account_id, p_data, v_user_id);
  ELSE
    -- If we can't determine the user_id, return an error
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User ID is required but not provided',
      'processed', 0,
      'failed', jsonb_array_length(p_data)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch_alt(UUID, JSONB) TO authenticated; 