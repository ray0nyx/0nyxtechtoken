-- Simple fix for tick-based PnL calculation
-- This script focuses on just the essential functions

-- Drop existing functions
DROP FUNCTION IF EXISTS calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS get_contract_multiplier(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_contract_commission(TEXT, INTEGER) CASCADE;

-- Create the correct contract multiplier function (tick values)
CREATE OR REPLACE FUNCTION get_contract_multiplier(symbol TEXT)
RETURNS NUMERIC AS $$
BEGIN
  symbol := UPPER(TRIM(symbol));
  
  CASE 
    -- E-mini contracts (tick values)
    WHEN symbol LIKE 'NQ%' OR symbol = 'NQ' THEN RETURN 5.0;   -- $5 per tick
    WHEN symbol LIKE 'ES%' OR symbol = 'ES' THEN RETURN 12.5;  -- $12.50 per tick
    WHEN symbol LIKE 'RTY%' OR symbol = 'RTY' THEN RETURN 12.5; -- $12.50 per tick
    WHEN symbol LIKE 'YM%' OR symbol = 'YM' THEN RETURN 5.0;   -- $5 per tick
    
    -- Micro contracts (1/10th size)
    WHEN symbol LIKE 'MNQ%' OR symbol = 'MNQ' THEN RETURN 0.5;  -- $0.50 per tick
    WHEN symbol LIKE 'MES%' OR symbol = 'MES' THEN RETURN 1.25; -- $1.25 per tick
    WHEN symbol LIKE 'M2K%' OR symbol = 'M2K' THEN RETURN 1.25; -- $1.25 per tick
    WHEN symbol LIKE 'MYM%' OR symbol = 'MYM' THEN RETURN 0.5;  -- $0.50 per tick
    
    -- Default
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
  normalized_symbol := UPPER(TRIM(symbol));
  
  CASE 
    -- E-mini contracts - $1.50 per side
    WHEN normalized_symbol = 'NQ' OR normalized_symbol = 'ES' OR 
         normalized_symbol = 'RTY' OR normalized_symbol = 'YM' THEN
      fee_per_contract := 1.50;
    
    -- Micro contracts - $0.35 per side
    WHEN (normalized_symbol LIKE 'M%' AND 
          (normalized_symbol = 'MNQ' OR normalized_symbol = 'MES' OR 
           normalized_symbol = 'M2K' OR normalized_symbol = 'MYM')) THEN
      fee_per_contract := 0.35;
    
    -- Default
    ELSE
      fee_per_contract := 1.50;
  END CASE;
  
  -- Round trip fees (entry + exit)
  RETURN ROUND(fee_per_contract * quantity * 2, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the correct futures PnL calculation function
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
  -- Get tick value
  multiplier := get_contract_multiplier(symbol);
  
  -- Get tick size
  CASE 
    WHEN UPPER(symbol) LIKE 'NQ%' OR UPPER(symbol) = 'NQ' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'ES%' OR UPPER(symbol) = 'ES' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'RTY%' OR UPPER(symbol) = 'RTY' THEN tick_size := 0.10;
    WHEN UPPER(symbol) LIKE 'YM%' OR UPPER(symbol) = 'YM' THEN tick_size := 1.0;
    WHEN UPPER(symbol) LIKE 'MNQ%' OR UPPER(symbol) = 'MNQ' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'MES%' OR UPPER(symbol) = 'MES' THEN tick_size := 0.25;
    WHEN UPPER(symbol) LIKE 'M2K%' OR UPPER(symbol) = 'M2K' THEN tick_size := 0.10;
    WHEN UPPER(symbol) LIKE 'MYM%' OR UPPER(symbol) = 'MYM' THEN tick_size := 1.0;
    ELSE tick_size := 0.25;
  END CASE;
  
  -- Calculate price difference
  IF LOWER(side) = 'long' THEN
    price_diff := exit_price - entry_price;
  ELSE
    price_diff := entry_price - exit_price;
  END IF;
  
  -- Calculate ticks
  ticks := price_diff / tick_size;
  
  -- Calculate gross PnL
  gross_pnl := ticks * quantity * multiplier;
  
  -- Calculate fees
  IF fees > 0 THEN
    calculated_fees := fees;
  ELSE
    calculated_fees := calculate_contract_commission(symbol, quantity);
  END IF;
  
  -- Calculate net PnL
  net_pnl := gross_pnl - calculated_fees;
  
  RETURN net_pnl;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the functions
DO $$
DECLARE
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  -- Test your NQ trade
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE '=== NQ E-mini Test (Your Trade) ===';
  RAISE NOTICE 'Entry: 24970.75, Exit: 24971.25, Contracts: 10';
  RAISE NOTICE 'Price Diff: 0.5 points, Tick Size: 0.25, Ticks: 2';
  RAISE NOTICE 'Tick Value: $5.00, Expected Gross: 2 * 10 * $5.00 = $100.00';
  RAISE NOTICE 'Commission: $30.00, Expected Net: $100.00 - $30.00 = $70.00';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_contract_multiplier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contract_commission(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) TO authenticated;

-- Now update the CSV processing function
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
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(p_rows JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(auth.uid(), p_rows, NULL::UUID);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(JSONB) TO authenticated;

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE 'Tick-based PnL calculation functions updated successfully!';
  RAISE NOTICE 'Your NQ trade should now calculate: 2 ticks * 10 contracts * $5.00 = $100.00 gross - $30.00 commission = $70.00 net';
END $$;
