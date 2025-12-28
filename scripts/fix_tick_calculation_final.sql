-- Final fix for tick-based PnL calculation
-- This script ensures the correct tick-based calculation is used

-- First, drop and recreate the functions to ensure they're updated
DROP FUNCTION IF EXISTS calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS get_contract_multiplier(TEXT);
DROP FUNCTION IF EXISTS calculate_contract_commission(TEXT, INTEGER);

-- Drop all existing process_tradovate_csv_batch function variants
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(JSONB) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(JSONB, TEXT) CASCADE;

-- Also try to drop any function with similar names that might exist
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Find and drop any function that starts with process_tradovate_csv
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname LIKE 'process_tradovate_csv%'
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.proname || '(' || func_record.argtypes || ') CASCADE';
            RAISE NOTICE 'Dropped function: %', func_record.proname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop function %: %', func_record.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Create the correct contract multiplier function (tick values)
CREATE OR REPLACE FUNCTION get_contract_multiplier(symbol TEXT)
RETURNS NUMERIC AS $$
BEGIN
  -- Normalize symbol to uppercase
  symbol := UPPER(TRIM(symbol));
  
  -- Futures contract multipliers (tick-based)
  CASE 
    -- E-mini contracts (tick values)
    WHEN symbol LIKE 'NQ%' OR symbol = 'NQ' THEN RETURN 5.0;   -- E-mini NASDAQ-100: $5 per tick
    WHEN symbol LIKE 'ES%' OR symbol = 'ES' THEN RETURN 12.5;  -- E-mini S&P 500: $12.50 per tick
    WHEN symbol LIKE 'RTY%' OR symbol = 'RTY' THEN RETURN 12.5; -- E-mini Russell 2000: $12.50 per tick
    WHEN symbol LIKE 'YM%' OR symbol = 'YM' THEN RETURN 5.0;   -- E-mini Dow: $5 per tick
    
    -- Micro contracts (1/10th size)
    WHEN symbol LIKE 'MNQ%' OR symbol = 'MNQ' THEN RETURN 0.5;  -- Micro NASDAQ-100: $0.50 per tick
    WHEN symbol LIKE 'MES%' OR symbol = 'MES' THEN RETURN 1.25; -- Micro S&P 500: $1.25 per tick
    WHEN symbol LIKE 'M2K%' OR symbol = 'M2K' THEN RETURN 1.25; -- Micro Russell 2000: $1.25 per tick
    WHEN symbol LIKE 'MYM%' OR symbol = 'MYM' THEN RETURN 0.5;  -- Micro Dow: $0.50 per tick
    
    -- Energy contracts
    WHEN symbol LIKE 'CL%' OR symbol = 'CL' THEN RETURN 1000.0;  -- Crude Oil
    WHEN symbol LIKE 'NG%' OR symbol = 'NG' THEN RETURN 10000.0; -- Natural Gas
    WHEN symbol LIKE 'GC%' OR symbol = 'GC' THEN RETURN 100.0;   -- Gold
    WHEN symbol LIKE 'SI%' OR symbol = 'SI' THEN RETURN 5000.0;  -- Silver
    
    -- Currency contracts
    WHEN symbol LIKE '6E%' OR symbol = '6E' THEN RETURN 1250.0;  -- Euro
    WHEN symbol LIKE '6J%' OR symbol = '6J' THEN RETURN 1250.0;  -- Japanese Yen
    WHEN symbol LIKE '6B%' OR symbol = '6B' THEN RETURN 1250.0;  -- British Pound
    WHEN symbol LIKE '6A%' OR symbol = '6A' THEN RETURN 1000.0;  -- Australian Dollar
    WHEN symbol LIKE '6C%' OR symbol = '6C' THEN RETURN 1000.0;  -- Canadian Dollar
    WHEN symbol LIKE '6S%' OR symbol = '6S' THEN RETURN 1000.0;  -- Swiss Franc
    
    -- Default case
    ELSE RETURN 1.0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the correct commission calculation function
CREATE OR REPLACE FUNCTION calculate_contract_commission(symbol TEXT, quantity INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  normalized_symbol TEXT;
  fee_per_contract NUMERIC;
BEGIN
  -- Normalize symbol to uppercase
  normalized_symbol := UPPER(TRIM(symbol));
  
  -- Commission rates per side (multiply by 2 for round trip)
  CASE 
    -- E-mini contracts (full size) - higher commissions
    WHEN normalized_symbol = 'NQ' OR normalized_symbol = 'ES' OR 
         normalized_symbol = 'RTY' OR normalized_symbol = 'YM' THEN
      fee_per_contract := 1.50; -- $1.50 per side for E-mini contracts
    
    -- Micro contracts (1/10th size) - lower commissions
    WHEN (normalized_symbol LIKE 'M%' AND 
          (normalized_symbol = 'MNQ' OR normalized_symbol = 'MES' OR 
           normalized_symbol = 'M2K' OR normalized_symbol = 'MYM')) THEN
      fee_per_contract := 0.35; -- $0.35 per side for Micro contracts
    
    -- Nano contracts and Event contracts
    WHEN normalized_symbol LIKE 'N%' OR normalized_symbol LIKE 'E%' THEN
      fee_per_contract := 0.20;
    
    -- Default for other contracts
    ELSE
      fee_per_contract := 1.50; -- Default to E-mini rate
  END CASE;
  
  -- Calculate total fees (multiply by 2 for round trip - entry and exit)
  RETURN ROUND(fee_per_contract * quantity * 2, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the correct futures PnL calculation function using tick-based calculation
CREATE OR REPLACE FUNCTION calculate_futures_pnl(
  symbol TEXT,
  side TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  quantity INTEGER,
  fees NUMERIC DEFAULT 0
)
RETURNS NUMERIC AS $$
DECLARE
  multiplier NUMERIC;
  price_diff NUMERIC;
  tick_size NUMERIC;
  ticks NUMERIC;
  gross_pnl NUMERIC;
  net_pnl NUMERIC;
  calculated_fees NUMERIC;
BEGIN
  -- Get the contract multiplier (tick value)
  multiplier := get_contract_multiplier(symbol);
  
  -- Get tick size for the contract
  CASE 
    WHEN UPPER(symbol) LIKE 'NQ%' OR UPPER(symbol) = 'NQ' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'ES%' OR UPPER(symbol) = 'ES' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'RTY%' OR UPPER(symbol) = 'RTY' THEN tick_size := 0.10;
    WHEN UPPER(symbol) LIKE 'YM%' OR UPPER(symbol) = 'YM' THEN tick_size := 1.0;
    WHEN UPPER(symbol) LIKE 'MNQ%' OR UPPER(symbol) = 'MNQ' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'MES%' OR UPPER(symbol) = 'MES' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'M2K%' OR UPPER(symbol) = 'M2K' THEN tick_size := 0.10;
    WHEN UPPER(symbol) LIKE 'MYM%' OR UPPER(symbol) = 'MYM' THEN tick_size := 1.0;
    ELSE tick_size := 0.25; -- Default
  END CASE;
  
  -- Calculate price difference based on position side
  IF LOWER(side) = 'long' THEN
    price_diff := exit_price - entry_price;
  ELSE
    price_diff := entry_price - exit_price;
  END IF;
  
  -- Calculate number of ticks
  ticks := price_diff / tick_size;
  
  -- Calculate gross PnL: ticks * quantity * tick_value
  gross_pnl := ticks * quantity * multiplier;
  
  -- Use provided fees if > 0, otherwise calculate based on contract type
  IF fees > 0 THEN
    calculated_fees := fees;
  ELSE
    calculated_fees := calculate_contract_commission(symbol, quantity);
  END IF;
  
  -- Calculate net PnL: gross PnL - fees
  net_pnl := gross_pnl - calculated_fees;
  
  -- Log the calculation for debugging
  RAISE NOTICE 'PnL Calculation: Symbol=%, Side=%, Entry=%, Exit=%, Qty=%, TickSize=%, Ticks=%, TickValue=%, GrossPnL=%, Fees=%, NetPnL=%', 
    symbol, side, entry_price, exit_price, quantity, tick_size, ticks, multiplier, gross_pnl, calculated_fees, net_pnl;
  
  RETURN net_pnl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the functions with your exact trade
DO $$
DECLARE
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  -- Test NQ E-mini calculation (your exact trade)
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE '=== NQ E-mini Test (Your Trade) ===';
  RAISE NOTICE 'Entry: 24970.75, Exit: 24971.25, Contracts: 10';
  RAISE NOTICE 'Price Diff: 0.5 points, Tick Size: 0.25, Ticks: 2';
  RAISE NOTICE 'Tick Value: $5.00, Expected Gross: 2 * 10 * $5.00 = $100.00';
  RAISE NOTICE 'Commission: $30.00, Expected Net: $100.00 - $30.00 = $70.00';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
  
  -- Test ES E-mini for comparison
  test_pnl := calculate_futures_pnl('ES', 'long', 4000.00, 4000.50, 5, 0);
  test_commission := calculate_contract_commission('ES', 5);
  
  RAISE NOTICE '=== ES E-mini Test ===';
  RAISE NOTICE 'Entry: 4000.00, Exit: 4000.50, Contracts: 5';
  RAISE NOTICE 'Price Diff: 0.5 points, Tick Size: 0.25, Ticks: 2';
  RAISE NOTICE 'Tick Value: $12.50, Expected Gross: 2 * 5 * $12.50 = $125.00';
  RAISE NOTICE 'Commission: $15.00, Expected Net: $125.00 - $15.00 = $110.00';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_contract_multiplier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contract_commission(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) TO authenticated;

-- Update the process_tradovate_csv_batch function to ensure it uses the correct calculation
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
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
  v_date DATE;
  v_total_rows INTEGER;
  v_detailed_errors JSONB := '[]'::JSONB;
BEGIN
  RAISE NOTICE 'Starting process_tradovate_csv_batch with user_id: %, account_id: %, rows count: %', 
    p_user_id, 
    p_account_id, 
    CASE WHEN jsonb_typeof(p_rows) = 'array' THEN jsonb_array_length(p_rows)::text ELSE 'not an array' END;
  
  -- Validate user_id
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User ID is required',
      'processed', 0
    );
  END IF;
  
  -- Validate rows input
  IF p_rows IS NULL OR jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Rows parameter must be a valid JSON array',
      'processed', 0
    );
  END IF;
  
  -- Get total number of rows
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
        ELSE 'long' -- Default to long if unclear
      END;
      
      v_quantity := COALESCE((v_trade->>'Paired Qty')::INTEGER, 
                            (v_trade->>'Bought')::INTEGER, 
                            (v_trade->>'Sold')::INTEGER, 0);
      
      v_entry_price := COALESCE((v_trade->>'Avg. Buy')::NUMERIC, 0);
      v_exit_price := COALESCE((v_trade->>'Avg. Sell')::NUMERIC, 0);
      
      -- Parse dates
      v_entry_date := COALESCE(
        (v_trade->>'Bought Timestamp')::TIMESTAMP,
        (v_trade->>'Timestamp')::TIMESTAMP
      );
      v_exit_date := COALESCE(
        (v_trade->>'Sold Timestamp')::TIMESTAMP,
        (v_trade->>'Timestamp')::TIMESTAMP
      );
      
      -- Calculate PnL using the correct tick-based function
      v_pnl := calculate_futures_pnl(v_symbol, v_side, v_entry_price, v_exit_price, v_quantity, 0);
      
      -- Calculate fees
      v_fees := calculate_contract_commission(v_symbol, v_quantity);
      
      -- Insert trade into database
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
      
      RAISE NOTICE 'Successfully processed trade: % - PnL: $%, Fees: $%', v_symbol, v_pnl, v_fees;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_error := SQLERRM;
      
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', i,
        'error', v_error,
        'symbol', v_symbol
      );
      
      RAISE NOTICE 'Error processing trade %: %', i, v_error;
    END;
  END LOOP;
  
  -- Return results
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated;

-- Create wrapper function for backward compatibility
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(p_rows JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(auth.uid(), p_rows, NULL::UUID);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(JSONB) TO authenticated;

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE 'Tick-based PnL calculation functions updated successfully!';
  RAISE NOTICE 'Your NQ trade should now calculate: 2 ticks * 10 contracts * $5.00 = $100.00 gross - $30.00 commission = $70.00 net';
END $$;
