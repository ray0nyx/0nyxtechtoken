-- Test script to verify trade upload works for a user
-- Replace USER_ID_HERE with the actual user ID

DO $$
DECLARE
  v_user_id UUID := 'USER_ID_HERE'; -- Replace with actual user ID
  v_test_trade JSONB;
  v_result JSONB;
BEGIN
  -- Create a test trade
  v_test_trade := jsonb_build_array(
    jsonb_build_object(
      'symbol', 'NQ',
      'side', 'long',
      'position', 'long',
      'quantity', 1,
      'entry_price', 15000.0,
      'exit_price', 15050.0,
      'pnl', 50.0,
      'fees', 2.0,
      'entry_date', NOW()::text,
      'exit_date', NOW()::text,
      'date', CURRENT_DATE::text
    )
  );
  
  -- Test the function
  SELECT process_topstepx_csv_batch(v_user_id, v_test_trade, NULL) INTO v_result;
  
  -- Display results
  RAISE NOTICE 'Test Result: %', v_result;
  RAISE NOTICE 'Success: %', v_result->>'success';
  RAISE NOTICE 'Processed: %', v_result->>'processed';
  RAISE NOTICE 'Error: %', v_result->>'error';
  RAISE NOTICE 'Auth Info: %', v_result->'auth_info';
  RAISE NOTICE 'Debug Log: %', v_result->'debug_log';
  
  -- Check if trade was actually inserted
  IF (v_result->>'success')::boolean THEN
    RAISE NOTICE 'SUCCESS: Trade upload test passed!';
  ELSE
    RAISE NOTICE 'FAILED: Trade upload test failed. Error: %', v_result->>'error';
  END IF;
END $$;

