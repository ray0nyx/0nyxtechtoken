-- Migration: Add trading accounts
-- Description: Adds trading accounts table and related functions

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240715000004_add_trading_accounts'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000004_add_trading_accounts', 'Adds trading accounts table and related functions', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240715000004_add_trading_accounts has already been applied.';
    RETURN;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL,
      description TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240715000004_add_trading_accounts', 'Adds trading accounts table and related functions', NOW());
END;
$$;

-- Create trading_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker TEXT NOT NULL,
  account_number TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Add RLS policies for trading_accounts table
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Policy for users to select their own accounts
CREATE POLICY select_own_accounts ON trading_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own accounts
CREATE POLICY insert_own_accounts ON trading_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own accounts
CREATE POLICY update_own_accounts ON trading_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own accounts
CREATE POLICY delete_own_accounts ON trading_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add account_id column to trades table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE trades ADD COLUMN account_id UUID REFERENCES trading_accounts(id);
  END IF;
END;
$$;

-- Create default accounts for existing users
CREATE OR REPLACE FUNCTION create_default_accounts()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- For each user in the system
  FOR v_user_id IN SELECT id FROM auth.users LOOP
    -- Create a default Tradovate account if one doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM trading_accounts 
      WHERE user_id = v_user_id AND broker = 'Tradovate' AND name = 'Default Tradovate Account'
    ) THEN
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (v_user_id, 'Default Tradovate Account', 'Tradovate', 'DEFAULT', FALSE, TRUE);
    END IF;
    
    -- Create demo accounts
    IF NOT EXISTS (
      SELECT 1 FROM trading_accounts 
      WHERE user_id = v_user_id AND broker = 'Tradovate' AND name = 'Tradovate Demo'
    ) THEN
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (v_user_id, 'Tradovate Demo', 'Tradovate', 'DEMO', TRUE, TRUE);
    END IF;
    
    -- Create funded accounts
    IF NOT EXISTS (
      SELECT 1 FROM trading_accounts 
      WHERE user_id = v_user_id AND broker = 'Tradovate' AND name = 'Tradovate Funded 1'
    ) THEN
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (v_user_id, 'Tradovate Funded 1', 'Tradovate', 'FUNDED1', FALSE, TRUE);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM trading_accounts 
      WHERE user_id = v_user_id AND broker = 'Tradovate' AND name = 'Tradovate Funded 2'
    ) THEN
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (v_user_id, 'Tradovate Funded 2', 'Tradovate', 'FUNDED2', FALSE, TRUE);
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM trading_accounts 
      WHERE user_id = v_user_id AND broker = 'Tradovate' AND name = 'Tradovate Funded 3'
    ) THEN
      INSERT INTO trading_accounts (user_id, name, broker, account_number, is_demo, is_active)
      VALUES (v_user_id, 'Tradovate Funded 3', 'Tradovate', 'FUNDED3', FALSE, TRUE);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create default accounts
SELECT create_default_accounts();

-- Update the process_tradovate_csv_row function to include account_id
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP, TIMESTAMP, INTERVAL) CASCADE;

-- Function to process a single Tradovate CSV row with account_id
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
  p_user_id UUID,
  p_symbol TEXT,
  p_created_at TIMESTAMP DEFAULT NULL,
  p_updated_at TIMESTAMP DEFAULT NULL,
  p_pnl NUMERIC DEFAULT NULL,
  p_price_format TEXT DEFAULT NULL,
  p_tick_size NUMERIC DEFAULT NULL,
  p_buy_fill_id TEXT DEFAULT NULL,
  p_sell_fill_id TEXT DEFAULT NULL,
  p_buy_price NUMERIC DEFAULT NULL,
  p_sell_price NUMERIC DEFAULT NULL,
  p_bought_timestamp TIMESTAMP DEFAULT NULL,
  p_sold_timestamp TIMESTAMP DEFAULT NULL,
  p_duration INTERVAL DEFAULT NULL,
  p_account_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_position TEXT;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_quantity INTEGER DEFAULT 1;
  v_date DATE;
  v_account_id UUID;
BEGIN
  -- If account_id is not provided, get the default account for this user
  IF p_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id AND name = 'Default Tradovate Account'
    LIMIT 1;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Determine position (long or short) based on buy/sell prices and timestamps
  IF p_bought_timestamp IS NOT NULL AND p_bought_timestamp < p_sold_timestamp THEN
    v_position := 'long';
    v_entry_date := p_bought_timestamp;
    v_exit_date := p_sold_timestamp;
    v_entry_price := p_buy_price;
    v_exit_price := p_sell_price;
  ELSE
    v_position := 'short';
    v_entry_date := p_sold_timestamp;
    v_exit_date := p_bought_timestamp;
    v_entry_price := p_sell_price;
    v_exit_price := p_buy_price;
  END IF;
  
  -- Set date to the entry date (just the date part)
  v_date := DATE(v_entry_date);
  
  -- Insert the trade into the trades table
  INSERT INTO trades (
    user_id,
    symbol,
    position,
    entry_date,
    exit_date,
    entry_price,
    exit_price,
    quantity,
    pnl,
    broker,
    date,
    "buyFillId",
    "sellFillId",
    "buyPrice",
    "sellPrice",
    "boughtTimestamp",
    "soldTimestamp",
    duration,
    "_priceFormat",
    "_tickSize",
    created_at,
    updated_at,
    account_id
  ) VALUES (
    p_user_id,
    p_symbol,
    v_position,
    v_entry_date,
    v_exit_date,
    v_entry_price,
    v_exit_price,
    v_quantity,
    p_pnl,
    'Tradovate',
    v_date,
    p_buy_fill_id,
    p_sell_fill_id,
    p_buy_price,
    p_sell_price,
    p_bought_timestamp,
    p_sold_timestamp,
    p_duration,
    p_price_format,
    p_tick_size,
    COALESCE(p_created_at, NOW()),
    COALESCE(p_updated_at, NOW()),
    v_account_id
  ) RETURNING id INTO v_trade_id;
  
  -- Update analytics for this user
  PERFORM populate_analytics_table(p_user_id);
  
  RETURN v_trade_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error processing Tradovate CSV row: %', SQLERRM;
    -- Return NULL to indicate failure
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update the process_tradovate_csv_batch function to include account_id
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB) CASCADE;

-- Function to process a batch of Tradovate CSV rows with account_id
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS TABLE(
  trade_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_row JSONB;
  v_trade_id UUID;
  v_error TEXT;
  v_account_id UUID;
BEGIN
  -- If account_id is not provided, get the default account for this user
  IF p_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM trading_accounts
    WHERE user_id = p_user_id AND name = 'Default Tradovate Account'
    LIMIT 1;
  ELSE
    v_account_id := p_account_id;
  END IF;
  
  -- Process each row in the batch
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data) LOOP
    BEGIN
      -- Handle missing Fill Time
      v_row := handle_tradovate_missing_fill_time(v_row);
      
      -- Process the row and get the trade ID
      v_trade_id := process_tradovate_csv_row(
        p_user_id,
        v_row->>'symbol',
        (v_row->>'created_at')::TIMESTAMP,
        (v_row->>'updated_at')::TIMESTAMP,
        clean_dollar_sign(v_row->>'pnl'),
        v_row->>'_priceFormat',
        clean_dollar_sign(v_row->>'_tickSize'),
        v_row->>'buyFillId',
        v_row->>'sellFillId',
        clean_dollar_sign(v_row->>'buyPrice'),
        clean_dollar_sign(v_row->>'sellPrice'),
        (v_row->>'boughtTimestamp')::TIMESTAMP,
        (v_row->>'soldTimestamp')::TIMESTAMP,
        (v_row->>'duration')::INTERVAL,
        v_account_id
      );
      
      -- Return success
      trade_id := v_trade_id;
      success := v_trade_id IS NOT NULL;
      error_message := NULL;
      RETURN NEXT;
    EXCEPTION
      WHEN OTHERS THEN
        -- Return failure with error message
        trade_id := NULL;
        success := FALSE;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get accounts for a user
CREATE OR REPLACE FUNCTION get_user_accounts(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  broker TEXT,
  account_number TEXT,
  is_demo BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.broker,
    a.account_number,
    a.is_demo,
    a.is_active,
    a.created_at,
    a.updated_at
  FROM
    trading_accounts a
  WHERE
    a.user_id = p_user_id
    AND a.is_active = TRUE
  ORDER BY
    a.is_demo ASC,
    a.name ASC;
END;
$$ LANGUAGE plpgsql; 