-- Fix TopstepX RPC function parameters to match client expectations
-- The client is sending p_user_id, p_rows and p_account_id as parameters

-- Drop the function if it exists with any parameter combination
DO $$
BEGIN
  -- Try to drop all versions of the function
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_topstepx_csv_batch(jsonb): %', SQLERRM;
  END;
END $$;

-- Create the properly parameterized function
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_account_id UUID;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_quantity NUMERIC;
  v_date TIMESTAMP;
  v_pnl NUMERIC;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
BEGIN
  -- If account_id is NULL, find or create a default account
  IF p_account_id IS NULL THEN
    -- Try to find an existing account for this user
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id
    LIMIT 1;
    
    -- If no account exists, create one
    IF v_account_id IS NULL THEN
      v_account_id := gen_random_uuid();
      
      INSERT INTO trading_accounts (id, user_id, name, created_at)
      VALUES (v_account_id, p_user_id, 'Default Trading Account', NOW());
      
      RAISE NOTICE 'Created new account ID % for user %', v_account_id, p_user_id;
    ELSE
      RAISE NOTICE 'Using existing account ID % for user %', v_account_id, p_user_id;
    END IF;
  ELSE
    v_account_id := p_account_id;
  END IF;

  -- Parse the rows array - sometimes it comes as a JSON string inside JSONB
  DECLARE
    v_parsed_rows JSONB;
  BEGIN
    -- Try to parse the rows as a JSON string first
    BEGIN
      v_parsed_rows := p_rows::TEXT::JSONB;
    EXCEPTION WHEN OTHERS THEN
      -- If that fails, assume it's already properly formatted JSONB
      v_parsed_rows := p_rows;
    END;
    
    -- Process each row in the batch
    FOR i IN 0..jsonb_array_length(v_parsed_rows) - 1 LOOP
      v_row := v_parsed_rows->i;
      
      BEGIN
        -- Extract and validate required fields
        v_symbol := COALESCE(v_row->>'contract_name', v_row->>'symbol', 'UNKNOWN');
        v_side := COALESCE(v_row->>'type', 'long');
        v_side := CASE 
                    WHEN v_side IN ('long', 'buy') THEN 'buy'
                    WHEN v_side IN ('short', 'sell') THEN 'sell'
                    ELSE 'buy' -- Default to buy if unknown
                  END;
        v_quantity := COALESCE((v_row->>'size')::NUMERIC, 1);
        
        -- Extract dates, with fallbacks
        BEGIN
          v_date := (v_row->>'entered_at')::TIMESTAMP;
        EXCEPTION WHEN OTHERS THEN
          BEGIN
            v_date := (v_row->>'trade_day')::TIMESTAMP;
          EXCEPTION WHEN OTHERS THEN
            v_date := NOW();
          END;
        END;
        
        v_pnl := COALESCE((v_row->>'pnl')::NUMERIC, 0);
        v_entry_price := COALESCE((v_row->>'entry_price')::NUMERIC, 0);
        v_exit_price := COALESCE((v_row->>'exit_price')::NUMERIC, 0);
        
        -- Insert with the validated account ID
        INSERT INTO trades (
          id,
          user_id,
          account_id,
          symbol,
          side,
          quantity,
          price,
          timestamp,
          pnl,
          created_at,
          updated_at,
          entry_price,
          exit_price,
          entry_date,
          exit_date
        )
        VALUES (
          gen_random_uuid(),
          p_user_id,
          v_account_id,
          v_symbol,
          v_side,
          v_quantity,
          v_entry_price,
          v_date,
          v_pnl,
          NOW(),
          NOW(),
          v_entry_price,
          v_exit_price,
          v_date,
          v_date
        );
        
        v_success_count := v_success_count + 1;
        
        v_result := jsonb_build_object(
          'success', TRUE,
          'row_index', i,
          'account_id', v_account_id
        );
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        
        v_error_count := v_error_count + 1;
        
        v_result := jsonb_build_object(
          'success', FALSE,
          'row_index', i,
          'error', v_error,
          'account_id_used', v_account_id
        );
      END;
      
      v_results := array_append(v_results, v_result);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Failed to parse rows: ' || v_error,
      'processed', 0,
      'errors', 1
    );
  END;
  
  -- Return detailed result
  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'account_id', v_account_id,
    'user_id', p_user_id,
    'results', to_jsonb(v_results),
    'processed_count', v_success_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(UUID, JSONB, UUID) TO authenticated; 