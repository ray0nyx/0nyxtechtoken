-- Script to fix the process_tradovate_csv_batch function issue
-- This script creates a new function with the expected signature

-- Step 1: Drop the existing functions if they exist
DO $$
BEGIN
    -- Try to drop the functions if they exist
    BEGIN
        -- First drop the client-facing function if it exists
        DROP FUNCTION IF EXISTS public.process_tradovate_csv_batch(UUID, JSONB, UUID);
        RAISE NOTICE 'Dropped client-facing function';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop client-facing function: %', SQLERRM;
    END;
    
    BEGIN
        -- Then drop the wrapper function if it exists
        DROP FUNCTION IF EXISTS public.process_tradovate_csv_batch_wrapper(UUID, JSONB, UUID);
        RAISE NOTICE 'Dropped wrapper function';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop wrapper function: %', SQLERRM;
    END;
END $$;

-- Step 2: Create a new wrapper function with a different name
CREATE OR REPLACE FUNCTION public.process_tradovate_csv_batch_wrapper(
    p_account_id UUID,
    p_rows JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Call the existing function with the correct parameter order
    -- The original function expects (p_user_id, p_data, p_account_id)
    SELECT public.process_tradovate_csv_batch(p_user_id, p_rows, p_account_id) INTO result;
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Error in wrapper function: ' || SQLERRM,
        'hint', 'The parameter order may have changed. Expected: (p_user_id, p_data, p_account_id)'
    );
END;
$$;

-- Step 3: Create a client-facing function with the expected signature
CREATE OR REPLACE FUNCTION public.process_tradovate_csv_batch(
    p_account_id UUID,
    p_rows JSONB,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call our wrapper function
    RETURN public.process_tradovate_csv_batch_wrapper(p_account_id, p_rows, p_user_id);
EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Error in client-facing function: ' || SQLERRM
    );
END;
$$;

-- Step 4: Log the creation of the functions
DO $$
BEGIN
    RAISE NOTICE 'Created wrapper and client-facing functions for process_tradovate_csv_batch with signature (p_account_id, p_rows, p_user_id)';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in final step: %', SQLERRM;
END $$; 