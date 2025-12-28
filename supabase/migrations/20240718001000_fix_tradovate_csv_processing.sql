-- Fix for the process_tradovate_csv_batch function
CREATE OR REPLACE FUNCTION public.update_analytics_after_trades(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Call the existing update_analytics_for_user function
    PERFORM update_analytics_for_user(p_user_id);
    
    -- Return a success result
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Analytics updated successfully'
    );
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$;

-- Update the existing function to call the new function
CREATE OR REPLACE FUNCTION public.process_tradovate_csv_batch(p_user_id uuid, p_data text, p_account_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB := '[]'::JSONB;
    v_data_jsonb JSONB;
    v_row JSONB;
    v_trade_id UUID;
    v_count INTEGER := 0;
    v_error TEXT;
    v_analytics_result JSONB;
BEGIN
    -- Parse the input data as JSON
    BEGIN
        v_data_jsonb := p_data::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid JSON data: ' || SQLERRM,
            'processed', 0
        );
    END;
    
    -- Ensure we have an array to work with
    IF jsonb_typeof(v_data_jsonb) <> 'array' THEN
        v_data_jsonb := jsonb_build_array(v_data_jsonb);
    END IF;

    -- Create a temporary table to store results
    CREATE TEMP TABLE IF NOT EXISTS temp_results (
        trade_id UUID,
        success BOOLEAN,
        error_message TEXT
    ) ON COMMIT DROP;

    -- Process each row in the array
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_data_jsonb)
    LOOP
        BEGIN
            -- Process the row with the enhanced function
            v_trade_id := process_tradovate_csv_row(
                p_user_id,
                v_row->>'symbol',
                (v_row->>'entry_date')::TIMESTAMP,
                (v_row->>'exit_date')::TIMESTAMP,
                v_row->>'quantity',
                v_row->>'position',
                v_row->>'entry_price',
                v_row->>'buyFillId',
                v_row->>'sellFillId',
                v_row->>'exit_price',
                v_row->>'fees',
                (v_row->>'boughtTimestamp')::TIMESTAMP,
                (v_row->>'soldTimestamp')::TIMESTAMP,
                (v_row->>'duration')::INTERVAL,
                p_account_id
            );

            -- Store the result
            INSERT INTO temp_results (trade_id, success, error_message)
            VALUES (v_trade_id, TRUE, NULL);
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            RAISE NOTICE 'Error processing row: %', v_error;
            
            -- Store the error
            INSERT INTO temp_results (trade_id, success, error_message)
            VALUES (NULL, FALSE, v_error);
        END;
    END LOOP;

    -- Update analytics after processing all trades
    IF v_count > 0 THEN
        -- Change from update_analytics_after_trades to update_analytics_for_user
        PERFORM update_analytics_for_user(p_user_id);
        v_analytics_result := jsonb_build_object('success', TRUE, 'message', 'Analytics updated successfully');
    END IF;

    -- Build the final result
    SELECT jsonb_build_object(
        'success', v_count > 0,
        'processed', v_count,
        'analytics', v_analytics_result,
        'results', jsonb_agg(
            jsonb_build_object(
                'trade_id', trade_id,
                'success', success,
                'error', error_message
            )
        )
    )
    INTO v_result
    FROM temp_results;

    RETURN v_result;
END;
$$; 