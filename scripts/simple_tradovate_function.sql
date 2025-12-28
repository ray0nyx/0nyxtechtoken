-- Simple version of the Tradovate function
-- This script creates a minimal version of the function with just the essential functionality

-- First, drop the existing function if it exists
DO $$
BEGIN
  -- Drop all versions of the function
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping function: %', SQLERRM;
END $$;

-- Create a simplified version of the function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_account_id UUID := p_account_id;
  v_error TEXT;
BEGIN
  -- Validate user_id
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User ID is required',
      'processed', 0
    );
  END IF;
  
  -- If account_id is not provided, try to find a default one
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = p_user_id AND platform = 'tradovate'
    LIMIT 1;
    
    -- If still no account, create one
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (
        id,
        user_id,
        name,
        platform,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_user_id,
        'Tradovate Account',
        'tradovate',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_account_id;
      
      RAISE NOTICE 'Created new Tradovate account % for user %', v_account_id, p_user_id;
    END IF;
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_trade := p_rows->i;
    
    BEGIN
      -- Insert the trade with minimal fields
      INSERT INTO trades (
        id,
        user_id,
        account_id,
        symbol,
        side,
        quantity,
        price,
        pnl,
        date,
        timestamp,
        broker,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_user_id,
        v_account_id,
        v_trade->>'symbol',
        'long',
        (v_trade->>'qty')::INTEGER,
        (v_trade->>'entry_price')::NUMERIC,
        (v_trade->>'pnl')::NUMERIC,
        (v_trade->>'date')::DATE,
        NOW(),
        'Tradovate',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_trade_id;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any errors
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'row', i,
        'data', v_trade
      );
    END;
  END LOOP;
  
  -- Return the final result
  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated';
  RAISE NOTICE 'Granted execute permissions to authenticated users';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$; 