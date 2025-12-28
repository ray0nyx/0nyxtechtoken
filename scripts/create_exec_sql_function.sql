-- Create exec_sql function for running SQL statements via RPC
-- This should be run in the Supabase SQL Editor or migration

DO $$
DECLARE
  function_exists boolean;
BEGIN
  -- Check if function already exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'exec_sql' 
    AND n.nspname = 'public'
  ) INTO function_exists;

  IF NOT function_exists THEN
    RAISE NOTICE 'Creating exec_sql function...';
  ELSE
    RAISE NOTICE 'exec_sql function already exists';
  END IF;
END;
$$;

-- Create the function (will replace if it exists)
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  start_time timestamptz;
  end_time timestamptz;
  execution_time interval;
BEGIN
  -- Only allow superusers or service_role to execute arbitrary SQL
  IF NOT (SELECT usesuper FROM pg_user WHERE usename = current_user) 
     AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Permission denied: Only superusers or service_role can execute arbitrary SQL';
  END IF;
  
  -- Execute with timing
  start_time := clock_timestamp();
  EXECUTE sql;
  end_time := clock_timestamp();
  
  execution_time := end_time - start_time;
  
  -- Return success result with timing information
  RETURN jsonb_build_object(
    'success', true,
    'message', 'SQL executed successfully',
    'execution_time_ms', (extract(epoch from execution_time) * 1000)::numeric
  );
EXCEPTION WHEN OTHERS THEN
  -- Return error information
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Set appropriate permissions
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'exec_sql function permissions set';
END;
$$; 