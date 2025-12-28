-- Fix the CSV processing function to use tick-based calculation
-- Run this AFTER test_tick_functions.sql

-- Drop existing CSV processing functions
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(JSONB) CASCADE;

-- Create the main CSV processing function
CREATE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
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
  v_fees NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_total_rows INTEGER;
  v_detailed_errors JSONB := '[]'::JSONB;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'User ID is required', 'processed', 0);
  END IF;
  
  IF p_rows IS NULL OR jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Rows parameter must be a valid JSON array', 'processed', 0);
  END IF;
  
  v_total_rows := jsonb_array_length(p_rows);
  
  -- Process each trade
  FOR i IN 0..v_total_rows-1 LOOP
    BEGIN
      v_trade := p_rows->i;
      
      -- Extract trade data
      v_symbol := COALESCE(v_trade->>'Product', v_trade->>'Contract', '');
      v_side := CASE 
        WHEN COALESCE((v_trade->>'Bought')::INTEGER, 0) > COALESCE((v_trade->>'Sold')::INTEGER, 0) THEN 'long'
        WHEN COALESCE((v_trade->>'Sold')::INTEGER, 0) > COALESCE((v_trade->>'Bought')::INTEGER, 0) THEN 'short'
        ELSE 'long'
      END;
      
      v_quantity := COALESCE((v_trade->>'Paired Qty')::INTEGER, 
                            (v_trade->>'Bought')::INTEGER, 
                            (v_trade->>'Sold')::INTEGER, 0);
      
      v_entry_price := COALESCE((v_trade->>'Avg. Buy')::NUMERIC, 0);
      v_exit_price := COALESCE((v_trade->>'Avg. Sell')::NUMERIC, 0);
      
      v_entry_date := COALESCE(
        (v_trade->>'Bought Timestamp')::TIMESTAMP,
        (v_trade->>'Timestamp')::TIMESTAMP
      );
      v_exit_date := COALESCE(
        (v_trade->>'Sold Timestamp')::TIMESTAMP,
        (v_trade->>'Timestamp')::TIMESTAMP
      );
      
      -- Calculate PnL using tick-based calculation
      v_pnl := calculate_futures_pnl(v_symbol, v_side, v_entry_price, v_exit_price, v_quantity, 0);
      v_fees := calculate_contract_commission(v_symbol, v_quantity);
      
      -- Insert trade
      INSERT INTO trades (
        id, user_id, account_id, symbol, side, quantity, entry_price, exit_price,
        entry_date, exit_date, net_pnl, fees, platform, position, size,
        trade_date, created_at, updated_at, extended_data, analytics,
        buyFillId, sellFillId, buyPrice, sellPrice, boughtTimestamp, soldTimestamp, duration
      ) VALUES (
        gen_random_uuid(),
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        v_quantity,
        v_entry_price,
        v_exit_price,
        v_entry_date,
        v_exit_date,
        v_pnl,
        v_fees,
        'Tradovate',
        v_side,
        v_quantity,
        COALESCE(v_entry_date::DATE, CURRENT_DATE),
        NOW(),
        NOW(),
        v_trade,
        jsonb_build_object(
          'gross_pnl', v_pnl + v_fees,
          'net_pnl', v_pnl,
          'fees', v_fees,
          'calculation_method', 'tick_based'
        ),
        v_trade->>'Buy Fill ID',
        v_trade->>'Sell Fill ID',
        v_entry_price,
        v_exit_price,
        v_entry_date,
        v_exit_date,
        EXTRACT(EPOCH FROM (v_exit_date - v_entry_date))
      ) RETURNING id INTO v_trade_id;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id,
        'symbol', v_symbol,
        'pnl', v_pnl,
        'fees', v_fees
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_error := SQLERRM;
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', i,
        'error', v_error,
        'symbol', v_symbol
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'processed', v_success_count,
    'errors', v_error_count,
    'total_rows', v_total_rows,
    'results', v_results,
    'detailed_errors', v_detailed_errors
  );
END;
$$ LANGUAGE plpgsql;

-- Create wrapper function
CREATE FUNCTION process_tradovate_csv_batch(p_rows JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(auth.uid(), p_rows, NULL::UUID);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(JSONB) TO authenticated;

-- Test the function exists
DO $$
BEGIN
  RAISE NOTICE 'CSV processing function created successfully!';
  RAISE NOTICE 'Functions available:';
  RAISE NOTICE '- process_tradovate_csv_batch(UUID, JSONB, UUID)';
  RAISE NOTICE '- process_tradovate_csv_batch(JSONB)';
END $$;
