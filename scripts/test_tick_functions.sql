-- Test script to verify tick-based functions work
-- Run this first to test the basic functions

-- Drop and recreate just the core functions
DROP FUNCTION IF EXISTS calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS get_contract_multiplier(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_contract_commission(TEXT, INTEGER) CASCADE;

-- Create the contract multiplier function
CREATE FUNCTION get_contract_multiplier(symbol TEXT)
RETURNS NUMERIC AS $$
BEGIN
  symbol := UPPER(TRIM(symbol));
  
  CASE 
    WHEN symbol LIKE 'NQ%' OR symbol = 'NQ' THEN RETURN 5.0;
    WHEN symbol LIKE 'ES%' OR symbol = 'ES' THEN RETURN 12.5;
    WHEN symbol LIKE 'RTY%' OR symbol = 'RTY' THEN RETURN 12.5;
    WHEN symbol LIKE 'YM%' OR symbol = 'YM' THEN RETURN 5.0;
    WHEN symbol LIKE 'MNQ%' OR symbol = 'MNQ' THEN RETURN 0.5;
    WHEN symbol LIKE 'MES%' OR symbol = 'MES' THEN RETURN 1.25;
    WHEN symbol LIKE 'M2K%' OR symbol = 'M2K' THEN RETURN 1.25;
    WHEN symbol LIKE 'MYM%' OR symbol = 'MYM' THEN RETURN 0.5;
    ELSE RETURN 1.0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the commission function
CREATE FUNCTION calculate_contract_commission(symbol TEXT, quantity INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  normalized_symbol TEXT;
  fee_per_contract NUMERIC;
BEGIN
  normalized_symbol := UPPER(TRIM(symbol));
  
  CASE 
    WHEN normalized_symbol = 'NQ' OR normalized_symbol = 'ES' OR 
         normalized_symbol = 'RTY' OR normalized_symbol = 'YM' THEN
      fee_per_contract := 1.50;
    WHEN (normalized_symbol LIKE 'M%' AND 
          (normalized_symbol = 'MNQ' OR normalized_symbol = 'MES' OR 
           normalized_symbol = 'M2K' OR normalized_symbol = 'MYM')) THEN
      fee_per_contract := 0.35;
    ELSE
      fee_per_contract := 1.50;
  END CASE;
  
  RETURN ROUND(fee_per_contract * quantity * 2, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the PnL calculation function
CREATE FUNCTION calculate_futures_pnl(
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
  multiplier := get_contract_multiplier(symbol);
  
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
  
  IF LOWER(side) = 'long' THEN
    price_diff := exit_price - entry_price;
  ELSE
    price_diff := entry_price - exit_price;
  END IF;
  
  ticks := price_diff / tick_size;
  gross_pnl := ticks * quantity * multiplier;
  
  IF fees > 0 THEN
    calculated_fees := fees;
  ELSE
    calculated_fees := calculate_contract_commission(symbol, quantity);
  END IF;
  
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
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE '=== NQ Test ===';
  RAISE NOTICE 'PnL: $%', test_pnl;
  RAISE NOTICE 'Commission: $%', test_commission;
  RAISE NOTICE 'Expected: PnL = $70.00, Commission = $30.00';
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_contract_multiplier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contract_commission(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) TO authenticated;
