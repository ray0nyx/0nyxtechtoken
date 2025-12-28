-- Migration: fix_csv_batch_parameters
-- Description: Fix parameter names in process_tradovate_csv_batch function

-- Record the migration
INSERT INTO migration_log (migration_name, description, executed_at)
VALUES ('20240715000008_fix_csv_batch_parameters', 'Fix parameter names in process_tradovate_csv_batch function', NOW());

-- Drop the existing function
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID) CASCADE;

-- Recreate the function with correct parameter names
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_user_id UUID,
    p_data TEXT,  -- Changed from p_trades JSONB to match TypeScript call
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

            -- Process the row with cleaned numeric values
            v_trade_id := process_tradovate_csv_row(
                p_user_id,
                v_trade->>'symbol',
                v_entry_time,
                v_exit_time,
                (v_trade->>'quantity')::NUMERIC,
                v_trade->>'side',
                (v_trade->>'entry_price')::TEXT,  -- Pass as TEXT for cleaning
                v_trade->>'entry_execution_id',
                v_trade->>'exit_execution_id',
                (v_trade->>'exit_price')::TEXT,   -- Pass as TEXT for cleaning
                (v_trade->>'commission')::TEXT,   -- Pass as TEXT for cleaning
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