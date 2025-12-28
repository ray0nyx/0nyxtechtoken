-- Fix Trade Upload Issues V2
-- This script fixes issues with the Tradovate and TopstepX CSV upload functions
-- to ensure trades are properly saved to the trades table and displayed correctly

-- Log the start of the script execution
DO $$
BEGIN
  RAISE NOTICE 'Starting trade upload fix script v2...';
END $$;

-- First, check if the user has accounts
DO $$
DECLARE
  account_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO account_count FROM accounts;
  
  RAISE NOTICE 'Found % accounts in the database', account_count;
  
  -- If no accounts exist, create default accounts for all users
  IF account_count = 0 THEN
    INSERT INTO accounts (id, user_id, name, platform, created_at, updated_at)
    SELECT 
      gen_random_uuid(), 
      id, 
      'Tradovate Account', 
      'tradovate', 
      NOW(), 
      NOW()
    FROM auth.users;
    
    INSERT INTO accounts (id, user_id, name, platform, created_at, updated_at)
    SELECT 
      gen_random_uuid(), 
      id, 
      'TopstepX Account', 
      'topstepx', 
      NOW(), 
      NOW()
    FROM auth.users;
    
    RAISE NOTICE 'Created default accounts for all users';
  END IF;
END $$;

-- Create a direct insert function for Tradovate trades
-- This bypasses the RPC function and inserts directly into the trades table
CREATE OR REPLACE FUNCTION insert_tradovate_trades(
  p_user_id UUID,
  p_trades JSONB,
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
  FOR i IN 0..jsonb_array_length(p_trades) - 1 LOOP
    v_trade := p_trades->i;
    
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

-- Create a direct insert function for TopstepX trades
CREATE OR REPLACE FUNCTION insert_topstepx_trades(
  p_user_id UUID,
  p_trades JSONB,
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
  v_fees NUMERIC;
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
    WHERE user_id = p_user_id AND platform = 'topstepx'
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
        'TopstepX Account',
        'topstepx',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_account_id;
      
      RAISE NOTICE 'Created new TopstepX account % for user %', v_account_id, p_user_id;
    END IF;
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..jsonb_array_length(p_trades) - 1 LOOP
    v_trade := p_trades->i;
    
    BEGIN
      -- Extract trade data with flexible field names
      v_symbol := COALESCE(
        v_trade->>'symbol', 
        v_trade->>'Symbol', 
        v_trade->>'contract_name', 
        v_trade->>'ContractName',
        v_trade->>'contract',
        v_trade->>'Contract'
      );
      
      v_side := COALESCE(
        v_trade->>'side', 
        v_trade->>'Side', 
        v_trade->>'position', 
        v_trade->>'Position',
        v_trade->>'type',
        v_trade->>'Type',
        'long'
      );
      
      -- Parse quantity
      BEGIN
        v_quantity := COALESCE(
          (v_trade->>'quantity')::INTEGER,
          (v_trade->>'Quantity')::INTEGER,
          (v_trade->>'qty')::INTEGER,
          (v_trade->>'Qty')::INTEGER,
          (v_trade->>'size')::INTEGER,
          (v_trade->>'Size')::INTEGER,
          1
        );
      EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
      END;
      
      -- Parse prices
      BEGIN
        v_entry_price := REPLACE(REPLACE(COALESCE(
          v_trade->>'entry_price', 
          v_trade->>'EntryPrice', 
          v_trade->>'entryPrice',
          v_trade->>'Entry',
          '0'
        ), ',', ''), '$', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
      END;
      
      BEGIN
        v_exit_price := REPLACE(REPLACE(COALESCE(
          v_trade->>'exit_price', 
          v_trade->>'ExitPrice', 
          v_trade->>'exitPrice',
          v_trade->>'Exit',
          '0'
        ), ',', ''), '$', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
      END;
      
      -- Parse PnL
      BEGIN
        v_pnl := REPLACE(REPLACE(REPLACE(COALESCE(
          v_trade->>'pnl', 
          v_trade->>'PnL',
          v_trade->>'P_L',
          v_trade->>'Profit',
          v_trade->>'profit',
          '0'
        ), ',', ''), '$', ''), '(', '-')::NUMERIC;
        v_pnl := REPLACE(v_pnl, ')', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_pnl := (v_exit_price - v_entry_price) * v_quantity;
      END;
      
      -- Parse fees
      BEGIN
        v_fees := REPLACE(REPLACE(COALESCE(
          v_trade->>'fees', 
          v_trade->>'Fees',
          v_trade->>'commission',
          v_trade->>'Commission',
          '0'
        ), ',', ''), '$', '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
      END;
      
      -- Parse dates
      BEGIN
        v_entry_date := COALESCE(
          (v_trade->>'entry_date')::TIMESTAMP,
          (v_trade->>'EntryDate')::TIMESTAMP,
          (v_trade->>'entryDate')::TIMESTAMP,
          (v_trade->>'EnteredAt')::TIMESTAMP,
          (v_trade->>'EntryTime')::TIMESTAMP,
          (v_trade->>'entered_at')::TIMESTAMP,
          (v_trade->>'entry_time')::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_entry_date := NOW();
      END;
      
      BEGIN
        v_exit_date := COALESCE(
          (v_trade->>'exit_date')::TIMESTAMP,
          (v_trade->>'ExitDate')::TIMESTAMP,
          (v_trade->>'exitDate')::TIMESTAMP,
          (v_trade->>'ExitedAt')::TIMESTAMP,
          (v_trade->>'ExitTime')::TIMESTAMP,
          (v_trade->>'exited_at')::TIMESTAMP,
          (v_trade->>'exit_time')::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_exit_date := NOW();
      END;
      
      -- Set date field
      BEGIN
        v_date := COALESCE(
          (v_trade->>'date')::DATE,
          (v_trade->>'trade_day')::DATE,
          (v_trade->>'TradeDay')::DATE,
          (v_trade->>'tradeDay')::DATE,
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
        fees,
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
        v_fees,
        v_date,
        v_entry_date,
        'TopstepX',
        'Imported from TopstepX CSV',
        NOW(),
        NOW(),
        v_entry_price,
        v_entry_date,
        v_exit_date,
        v_exit_price,
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

-- Create or replace the process_tradovate_csv_batch function to use our new direct insert function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Call our direct insert function
  RETURN insert_tradovate_trades(p_user_id, p_rows, p_account_id);
EXCEPTION WHEN OTHERS THEN
  -- Handle any errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error in process_tradovate_csv_batch: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Create a wrapper function with the expected parameter order
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_wrapper(
  p_account_id UUID,
  p_rows JSONB,
  p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Call our function with the correct parameter order
  RETURN process_tradovate_csv_batch(p_user_id, p_rows, p_account_id);
EXCEPTION WHEN OTHERS THEN
  -- Handle any errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error in wrapper function: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Create or replace the process_topstepx_csv_batch function to use our new direct insert function
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(
  trades_json JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
BEGIN
  -- Extract user ID and account ID from the first trade
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
  
  -- Call our direct insert function
  RETURN insert_topstepx_trades(v_user_id, trades_json, v_account_id);
EXCEPTION WHEN OTHERS THEN
  -- Handle any errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Error in process_topstepx_csv_batch: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION insert_tradovate_trades(UUID, JSONB, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION insert_topstepx_trades(UUID, JSONB, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch_wrapper(UUID, JSONB, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated';
  
  RAISE NOTICE 'Granted execute permissions to authenticated users';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$;

-- Refresh analytics for all users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT id FROM auth.users LOOP
    BEGIN
      PERFORM calculate_user_analytics(user_record.id);
      RAISE NOTICE 'Refreshed analytics for user %', user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error refreshing analytics for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Log the completion of the script
DO $$
BEGIN
  RAISE NOTICE 'Trade upload fix script v2 completed successfully';
END $$; 