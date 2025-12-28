-- Fix the parameter naming inconsistency in the TopstepX processor function
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(JSONB);

-- Recreate the function with a consistent parameter name
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  trades_json JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  -- Extract user ID from the first trade (all trades should have the same user ID)
  IF jsonb_array_length(trades_json) > 0 THEN
    v_user_id := (trades_json->0->>'user_id')::UUID;
    v_account_id := (trades_json->0->>'account_id')::UUID;
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No trades provided',
      'processed', 0
    );
  END IF;

  -- Process each trade in the batch
  FOR v_trade IN SELECT * FROM jsonb_array_elements(trades_json) LOOP
    BEGIN
      -- Process the trade
      v_trade_id := process_topstepx_trade(
        v_user_id,
        v_trade->>'contract_name',
        (v_trade->>'entered_at')::TIMESTAMP,
        (v_trade->>'exited_at')::TIMESTAMP,
        (v_trade->>'entry_price')::NUMERIC,
        (v_trade->>'exit_price')::NUMERIC,
        (v_trade->>'fees')::NUMERIC,
        (v_trade->>'pnl')::NUMERIC,
        (v_trade->>'size')::INTEGER,
        v_trade->>'type',
        (v_trade->>'trade_day')::TIMESTAMP,
        (v_trade->>'trade_duration')::INTEGER,
        v_account_id
      );
      
      -- Add result to results array
      IF v_trade_id IS NOT NULL THEN
        v_success_count := v_success_count + 1;
        v_results := v_results || jsonb_build_object(
          'trade_id', v_trade_id,
          'success', TRUE
        );
      ELSE
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', 'Failed to process trade'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Add error to results array
        v_error_count := v_error_count + 1;
        v_results := v_results || jsonb_build_object(
          'success', FALSE,
          'error', SQLERRM
        );
    END;
  END LOOP;
  
  -- Try to recalculate PnL periods after all trades are processed
  BEGIN
    PERFORM calculate_period_pnl(v_user_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating period PnL: %', SQLERRM;
  END;
  
  -- Return summary of results
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', v_results
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'processed', v_success_count
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated; 