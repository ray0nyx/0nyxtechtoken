-- Migration: drop_and_recreate_csv_functions
-- Description: Drop all versions of CSV processing functions and recreate them

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000010_drop_and_recreate_csv_functions', 'Drop all versions of CSV processing functions and recreate them', NOW());

-- Drop ALL versions of the functions
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP, TIMESTAMP, INTERVAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, TIMESTAMP, INTERVAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP, TIMESTAMP, INTERVAL) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;

-- First ensure the clean_dollar_sign function exists
CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
RETURNS NUMERIC AS $$
DECLARE
  cleaned_value TEXT;
BEGIN
  -- Return 0 for NULL or empty values
  IF value IS NULL OR value = '' THEN
    RETURN 0;
  END IF;
  
  -- First, trim whitespace
  cleaned_value := TRIM(value);
  
  -- Handle dollar sign at the beginning
  IF LEFT(cleaned_value, 1) = '$' THEN
    cleaned_value := SUBSTRING(cleaned_value FROM 2);
  END IF;
  
  -- Remove commas and other non-numeric characters except decimal points and negative signs
  cleaned_value := REGEXP_REPLACE(cleaned_value, '[^0-9.-]', '', 'g');
  
  -- Handle empty string after cleaning
  IF cleaned_value = '' OR cleaned_value = '-' OR cleaned_value = '.' THEN
    RETURN 0;
  END IF;
  
  -- Convert to numeric with robust error handling
  BEGIN
    RETURN cleaned_value::NUMERIC;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error converting value "%": %', value, SQLERRM;
      RETURN 0;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error cleaning dollar sign from value "%": %', value, SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Recreate the process_tradovate_csv_row function
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
    p_user_id UUID,
    p_symbol TEXT,
    p_entry_time TIMESTAMP,
    p_exit_time TIMESTAMP,
    p_quantity TEXT,
    p_side TEXT,
    p_entry_price TEXT,
    p_entry_execution_id TEXT,
    p_exit_execution_id TEXT,
    p_exit_price TEXT,
    p_commission TEXT,
    p_fill_time TIMESTAMP,
    p_order_time TIMESTAMP,
    p_duration INTERVAL,
    p_account_id UUID
) RETURNS UUID AS $$
DECLARE
    v_trade_id UUID;
    v_cleaned_quantity NUMERIC;
    v_cleaned_entry_price NUMERIC;
    v_cleaned_exit_price NUMERIC;
    v_cleaned_commission NUMERIC;
BEGIN
    -- Clean all numeric values
    v_cleaned_quantity := clean_dollar_sign(p_quantity);
    v_cleaned_entry_price := clean_dollar_sign(p_entry_price);
    v_cleaned_exit_price := clean_dollar_sign(p_exit_price);
    v_cleaned_commission := clean_dollar_sign(p_commission);

    INSERT INTO trades (
        user_id,
        symbol,
        entry_time,
        exit_time,
        quantity,
        side,
        entry_price,
        entry_execution_id,
        exit_execution_id,
        exit_price,
        commission,
        fill_time,
        order_time,
        duration,
        account_id
    ) VALUES (
        p_user_id,
        p_symbol,
        p_entry_time,
        p_exit_time,
        v_cleaned_quantity,
        p_side,
        v_cleaned_entry_price,
        p_entry_execution_id,
        p_exit_execution_id,
        v_cleaned_exit_price,
        v_cleaned_commission,
        p_fill_time,
        p_order_time,
        p_duration,
        p_account_id
    )
    RETURNING id INTO v_trade_id;

    RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;

-- Recreate the process_tradovate_csv_batch function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_user_id UUID,
    p_data TEXT,
    p_account_id UUID
) RETURNS TABLE (
    trade_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_trade JSONB;
    v_trade_id UUID;
    v_error TEXT;
    v_entry_time TIMESTAMP;
    v_exit_time TIMESTAMP;
    v_fill_time TIMESTAMP;
    v_order_time TIMESTAMP;
    v_duration INTERVAL;
    v_trades JSONB;
BEGIN
    -- Parse the JSON data
    BEGIN
        v_trades := p_data::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid JSON data provided';
        RETURN;
    END;

    -- Process each trade
    FOR v_trade IN SELECT * FROM jsonb_array_elements(v_trades)
    LOOP
        BEGIN
            -- Parse timestamps
            v_entry_time := (v_trade->>'entry_time')::TIMESTAMP;
            v_exit_time := (v_trade->>'exit_time')::TIMESTAMP;
            v_fill_time := handle_tradovate_missing_fill_time(
                (v_trade->>'fill_time')::TIMESTAMP,
                v_entry_time,
                v_exit_time
            );
            v_order_time := (v_trade->>'order_time')::TIMESTAMP;
            v_duration := (v_trade->>'duration')::INTERVAL;

            -- Process the row with all numeric values as text for cleaning
            v_trade_id := process_tradovate_csv_row(
                p_user_id,
                v_trade->>'symbol',
                v_entry_time,
                v_exit_time,
                v_trade->>'quantity',
                v_trade->>'side',
                v_trade->>'entry_price',
                v_trade->>'entry_execution_id',
                v_trade->>'exit_execution_id',
                v_trade->>'exit_price',
                v_trade->>'commission',
                v_fill_time,
                v_order_time,
                v_duration,
                p_account_id
            );

            RETURN QUERY SELECT v_trade_id, TRUE, NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RETURN QUERY SELECT NULL::UUID, FALSE, v_error;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql; 