-- Script to check if the functions exist after running the fix

-- Check if process_tradovate_csv_batch exists
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'process_tradovate_csv_batch'
    AND n.nspname = 'public'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE 'process_tradovate_csv_batch function exists';
    
    -- Check the parameter names
    RAISE NOTICE 'Parameter details:';
    FOR r IN (
      SELECT p.proname, pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'process_tradovate_csv_batch'
      AND n.nspname = 'public'
    ) LOOP
      RAISE NOTICE 'Function: %, Arguments: %', r.proname, r.args;
    END LOOP;
  ELSE
    RAISE NOTICE 'process_tradovate_csv_batch function does NOT exist';
  END IF;
END $$;

-- Check if process_topstepx_csv_batch exists
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'process_topstepx_csv_batch'
    AND n.nspname = 'public'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE 'process_topstepx_csv_batch function exists';
    
    -- Check the parameter names
    RAISE NOTICE 'Parameter details:';
    FOR r IN (
      SELECT p.proname, pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'process_topstepx_csv_batch'
      AND n.nspname = 'public'
    ) LOOP
      RAISE NOTICE 'Function: %, Arguments: %', r.proname, r.args;
    END LOOP;
  ELSE
    RAISE NOTICE 'process_topstepx_csv_batch function does NOT exist';
  END IF;
END $$; 