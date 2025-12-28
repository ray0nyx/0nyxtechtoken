-- Fix for the missing process_tradovate_csv_batch function
-- This script creates the function with the exact parameter names expected by the frontend

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

-- Create the process_tradovate_csv_batch function
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
  v_symbol TEXT;
  v_side TEXT;
  v_quantity INTEGER;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_pnl NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_date DATE;
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
      -- Extract trade data
      v_symbol := COALESCE(v_trade->>'symbol', v_trade->>'Symbol', v_trade->>'contract', v_trade->>'Contract');
      v_side := COALESCE(v_trade->>'side', v_trade->>'Side', v_trade->>'position', v_trade->>'Position', 'long');
      
      -- Parse quantity
      BEGIN
        v_quantity := COALESCE(
          (v_trade->>'quantity')::INTEGER,
          (v_trade->>'Quantity')::INTEGER,
          (v_trade->>'qty')::INTEGER,
          (v_trade->>'Qty')::INTEGER,
          1
        );
      EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
      END;
      
      -- Parse prices
      BEGIN
        v_entry_price := REPLACE(REPLACE(COALESCE(v_trade->>'entry_price', v_trade->>'entryPrice', '0'), ',', ''), '$', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
      END;
      
      BEGIN
        v_exit_price := REPLACE(REPLACE(COALESCE(v_trade->>'exit_price', v_trade->>'exitPrice', '0'), ',', ''), '$', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
      END;
      
      -- Parse PnL
      BEGIN
        v_pnl := REPLACE(REPLACE(REPLACE(COALESCE(v_trade->>'pnl', v_trade->>'PnL', '0'), ',', ''), '$', ''), '(', '-')::NUMERIC;
        v_pnl := REPLACE(v_pnl, ')', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_pnl := (v_exit_price - v_entry_price) * v_quantity;
      END;
      
      -- Parse dates
      BEGIN
        v_entry_date := COALESCE(
          (v_trade->>'entry_date')::TIMESTAMP,
          (v_trade->>'entryDate')::TIMESTAMP,
          (v_trade->>'boughtTimestamp')::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_entry_date := NOW();
      END;
      
      BEGIN
        v_exit_date := COALESCE(
          (v_trade->>'exit_date')::TIMESTAMP,
          (v_trade->>'exitDate')::TIMESTAMP,
          (v_trade->>'soldTimestamp')::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_exit_date := NOW();
      END;
      
      -- Set date field
      BEGIN
        v_date := COALESCE(
          (v_trade->>'date')::DATE,
          v_entry_date::DATE
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := CURRENT_DATE;
      END;
      
      -- Insert the trade
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
        notes,
        created_at,
        updated_at,
        entry_price,
        entry_date,
        exit_date,
        exit_price,
        buyFillId,
        sellFillId,
        buyPrice,
        sellPrice,
        boughtTimestamp,
        soldTimestamp,
        position
      ) VALUES (
        gen_random_uuid(),
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        ABS(v_quantity),
        v_entry_price,
        v_pnl,
        v_date,
        v_entry_date,
        'Tradovate',
        'Imported from Tradovate CSV',
        NOW(),
        NOW(),
        v_entry_price,
        v_entry_date,
        v_exit_date,
        v_exit_price,
        v_trade->>'buyFillId',
        v_trade->>'sellFillId',
        v_entry_price,
        v_exit_price,
        v_entry_date,
        v_exit_date,
        v_side
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
  
  -- Try to refresh analytics
  BEGIN
    -- First try to initialize analytics if they don't exist
    IF NOT EXISTS (SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'overall_metrics') THEN
      PERFORM calculate_user_analytics(p_user_id);
    END IF;
    
    -- Then refresh the analytics
    PERFORM refresh_analytics_for_user(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error refreshing analytics: %', SQLERRM;
  END;
  
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