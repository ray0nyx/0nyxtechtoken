-- Add is_default column to trading_accounts table
ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Update existing accounts to set is_default to true for at least one account per user
WITH ranked_accounts AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM trading_accounts
)
UPDATE trading_accounts
SET is_default = TRUE
FROM ranked_accounts
WHERE trading_accounts.id = ranked_accounts.id AND ranked_accounts.rn = 1;

-- Add an index on is_default and user_id to optimize queries in process_tradovate_csv_batch
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_default ON trading_accounts (user_id, is_default);

-- First, explicitly drop the functions to avoid parameter naming conflicts
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch_alt(UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch_alt(UUID, JSONB) CASCADE;

-- Update the process_tradovate_csv_batch function to handle null is_default values
CREATE FUNCTION process_tradovate_csv_batch(
  p_account_id UUID,
  p_data JSONB,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_successful_rows INT := 0;
  v_failed_rows INT := 0;
  v_results JSONB[] := '{}';
  v_error TEXT;
  v_analytics_record_exists BOOLEAN;
  v_account_id UUID := p_account_id;
BEGIN
  -- Validate the account ID
  IF v_account_id IS NULL THEN
    -- Try to find a default account for the user
    -- Use COALESCE to handle NULL is_default values
    SELECT id INTO v_account_id 
    FROM trading_accounts 
    WHERE user_id = p_user_id 
    ORDER BY COALESCE(is_default, FALSE) DESC, created_at ASC 
    LIMIT 1;
    
    IF v_account_id IS NULL THEN
      -- No account found, create a default account
      INSERT INTO trading_accounts (user_id, name, is_default) 
      VALUES (p_user_id, 'Default Account', TRUE)
      RETURNING id INTO v_account_id;
    END IF;
  END IF;

  -- The rest of the function implementation is unchanged
  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data) LOOP
    BEGIN
      -- Process the row
      SELECT
        process_tradovate_csv_row(p_user_id, v_row, v_account_id)
      INTO v_result;
      
      -- Add the result to our array
      v_results := v_results || v_result;
      
      -- Increment success or failure counter
      IF (v_result->>'success')::BOOLEAN THEN
        v_successful_rows := v_successful_rows + 1;
      ELSE
        v_failed_rows := v_failed_rows + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- On exception, record the error
      v_error := SQLERRM;
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', 'Error processing row: ' || v_error,
        'data', v_row
      );
      v_failed_rows := v_failed_rows + 1;
    END;
  END LOOP;
  
  -- Ensure analytics exist for this user
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM analytics WHERE user_id = p_user_id
    ) INTO v_analytics_record_exists;
    
    -- If no analytics record exists, create one
    IF NOT v_analytics_record_exists THEN
      PERFORM calculate_user_analytics(p_user_id);
    ELSE
      -- Update analytics for this user
      PERFORM update_analytics_for_user(p_user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating analytics: %', SQLERRM;
    -- Continue processing even if analytics update fails
  END;
  
  -- Return the summary
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_successful_rows,
    'failed', v_failed_rows,
    'total', v_successful_rows + v_failed_rows,
    'results', to_jsonb(v_results)
  );
EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error processing batch: ' || v_error,
    'processed', v_successful_rows,
    'failed', v_failed_rows
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Create the two-parameter version with explicit parameter names
CREATE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB
)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(NULL, p_data, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated; 