-- Migration: fix_quantity_dollar_sign
-- Description: Ensure all numeric values are properly cleaned of dollar signs

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000009_fix_quantity_dollar_sign', 'Ensure all numeric values are properly cleaned of dollar signs', NOW());

-- Drop existing functions
DROP FUNCTION IF EXISTS process_tradovate_csv_row(UUID, TEXT, TIMESTAMP, TIMESTAMP, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP, TIMESTAMP, INTERVAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID) CASCADE;

-- Update the process_tradovate_csv_row function to handle all numeric values
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
    p_user_id UUID,
    p_symbol TEXT,
    p_entry_time TIMESTAMP,
    p_exit_time TIMESTAMP,
    p_quantity TEXT,  -- Changed to TEXT for cleaning
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

-- Update the process_tradovate_csv_batch function to pass quantity as text
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
                v_trade->>'quantity',  -- Pass as text for cleaning
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