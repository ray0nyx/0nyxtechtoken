-- Fix E-mini futures commission calculation
-- This script corrects the commission rates for E-mini vs Micro contracts

-- Update the contract multiplier function with correct values
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
    
    -- Currency futures
    WHEN symbol LIKE '6E%' OR symbol = '6E' THEN RETURN 125000.0; -- Euro
    WHEN symbol LIKE '6J%' OR symbol = '6J' THEN RETURN 12500000.0; -- Japanese Yen
    WHEN symbol LIKE '6B%' OR symbol = '6B' THEN RETURN 62500.0; -- British Pound
    
    -- Default multiplier for unknown contracts
    ELSE RETURN 1.0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to calculate proper E-mini vs Micro commissions
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

-- Update the futures PnL calculation function to use tick-based calculation
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

-- Test the functions with your example
DO $$
DECLARE
  test_pnl NUMERIC;
  test_commission NUMERIC;
BEGIN
  -- Test NQ E-mini calculation (10 contracts, 2 ticks = 0.5 points)
  test_pnl := calculate_futures_pnl('NQ', 'long', 24970.75, 24971.25, 10, 0);
  test_commission := calculate_contract_commission('NQ', 10);
  
  RAISE NOTICE 'NQ E-mini Test: 10 contracts, 2 ticks (0.5 points)';
  RAISE NOTICE 'Expected: 10 * 2 * $5 = $100 gross - $30 commission = $70 net';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
  
  -- Test MNQ Micro calculation for comparison
  test_pnl := calculate_futures_pnl('MNQ', 'long', 15000, 15005, 10, 0);
  test_commission := calculate_contract_commission('MNQ', 10);
  
  RAISE NOTICE 'MNQ Micro Test: 10 contracts, 5 points';
  RAISE NOTICE 'Expected: 10 * 5 * $2 = $100 gross - $7 commission = $93 net';
  RAISE NOTICE 'Calculated PnL: $%', test_pnl;
  RAISE NOTICE 'Calculated Commission: $%', test_commission;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_contract_multiplier(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_contract_commission(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_futures_pnl(TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, NUMERIC) TO authenticated;
