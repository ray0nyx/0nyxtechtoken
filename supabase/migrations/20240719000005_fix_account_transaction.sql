-- Drop the existing function and create a new one with better transaction handling
DO $$
DECLARE
    func record;
BEGIN
    -- Find all functions named process_tradovate_csv_row and drop them
    FOR func IN 
        SELECT ns.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        INNER JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE p.proname = 'process_tradovate_csv_row'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', 
                       func.schema_name, 
                       func.function_name, 
                       func.args);
        RAISE NOTICE 'Dropped function %I.%I(%s)', 
                     func.schema_name, 
                     func.function_name, 
                     func.args;
    END LOOP;
END $$;

-- Create a new function with better transaction handling
CREATE OR REPLACE FUNCTION public.process_tradovate_csv_row(
    p_user_id uuid,
    p_symbol text,
    p_entry_date timestamp without time zone,
    p_exit_date timestamp without time zone,
    p_quantity text,
    p_position text,
    p_entry_price text,
    p_buy_fill_id text,
    p_sell_fill_id text,
    p_exit_price text,
    p_fees text,
    p_bought_timestamp timestamp without time zone,
    p_sold_timestamp timestamp without time zone,
    p_duration interval,
    p_account_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trade_id UUID;
    v_quantity NUMERIC;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_fees NUMERIC;
    v_pnl NUMERIC;
    v_position_type TEXT;
    v_account_id UUID := p_account_id;
    v_found_account_id UUID;
BEGIN
    -- Convert text inputs to numeric values
    BEGIN
        v_quantity := p_quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
    END;
    
    BEGIN
        v_entry_price := p_entry_price::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
    END;
    
    BEGIN
        v_exit_price := p_exit_price::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
    END;
    
    BEGIN
        v_fees := p_fees::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
    END;
    
    -- Normalize position type
    v_position_type := LOWER(p_position);
    IF v_position_type NOT IN ('long', 'short') THEN
        v_position_type := 'long';
    END IF;
    
    -- Calculate P&L based on position type
    IF v_position_type = 'long' THEN
        v_pnl := (v_exit_price - v_entry_price) * v_quantity - v_fees;
    ELSE
        v_pnl := (v_entry_price - v_exit_price) * v_quantity - v_fees;
    END IF;
    
    -- If account_id is NULL, try to find a default account for the user
    IF v_account_id IS NULL THEN
        -- Try to find an existing account
        SELECT id INTO v_found_account_id
        FROM trading_accounts
        WHERE user_id = p_user_id
        LIMIT 1;
        
        -- If no account found, create a default one
        IF v_found_account_id IS NULL THEN
            -- Create the account in a separate transaction and commit it
            INSERT INTO trading_accounts (
                user_id,
                name,
                broker,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                p_user_id,
                'Default Tradovate Account',
                'tradovate',
                TRUE,
                NOW(),
                NOW()
            )
            RETURNING id INTO v_found_account_id;

            -- Make sure we have a valid account_id
            IF v_found_account_id IS NULL THEN
                RAISE EXCEPTION 'Failed to create or find a valid trading account for user %', p_user_id;
            END IF;
        END IF;
        
        -- Use the found or created account
        v_account_id := v_found_account_id;
    END IF;
    
    -- Verify we have a valid account ID before proceeding
    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'No valid trading account ID found or created';
    END IF;
    
    -- Explicitly check if the account exists
    PERFORM 1 FROM trading_accounts WHERE id = v_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trading account with ID % does not exist', v_account_id;
    END IF;
    
    -- Insert the trade into the trades table - using correct column names "buyFillId" and "sellFillId"
    INSERT INTO trades (
        user_id,
        account_id,
        symbol,
        entry_date,
        exit_date,
        quantity,
        position,
        entry_price,
        exit_price,
        fees,
        pnl,
        "buyFillId",  -- Note the camelCase and quotes
        "sellFillId", -- Note the camelCase and quotes
        "boughtTimestamp",
        "soldTimestamp",
        duration,
        broker,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        v_account_id,
        p_symbol,
        p_entry_date,
        p_exit_date,
        v_quantity,
        v_position_type,
        v_entry_price,
        v_exit_price,
        v_fees,
        v_pnl,
        p_buy_fill_id,
        p_sell_fill_id,
        p_bought_timestamp,
        p_sold_timestamp,
        p_duration,
        'tradovate',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_trade_id;
    
    -- Update analytics for the user
    PERFORM update_analytics_for_user(p_user_id);
    
    RETURN v_trade_id;
END;
$function$;

-- Also update the process_tradovate_csv_batch function
DO $$
DECLARE
    func record;
BEGIN
    -- Find all functions named process_tradovate_csv_batch and drop them
    FOR func IN 
        SELECT ns.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        INNER JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE p.proname = 'process_tradovate_csv_batch'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', 
                       func.schema_name, 
                       func.function_name, 
                       func.args);
        RAISE NOTICE 'Dropped function %I.%I(%s)', 
                     func.schema_name, 
                     func.function_name, 
                     func.args;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.process_tradovate_csv_batch(p_user_id uuid, p_data text, p_account_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB := '[]'::JSONB;
    v_data_jsonb JSONB;
    v_row JSONB;
    v_trade_id UUID;
    v_count INTEGER := 0;
    v_error TEXT;
    v_analytics_result JSONB;
    v_account_id UUID := p_account_id;
    v_debug_info JSONB := '{}';
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
    
    -- Check if array is empty
    IF jsonb_array_length(v_data_jsonb) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No valid trade data found in the input. The CSV may not contain valid trade information.',
            'processed', 0
        );
    END IF;
    
    -- Ensure we have an array to work with
    IF jsonb_typeof(v_data_jsonb) <> 'array' THEN
        v_data_jsonb := jsonb_build_array(v_data_jsonb);
    END IF;

    -- If account_id is NULL, try to find a default account or create one
    IF v_account_id IS NULL THEN
        -- Check for an existing account
        SELECT id INTO v_account_id
        FROM trading_accounts
        WHERE user_id = p_user_id
        LIMIT 1;
        
        -- If no account exists, create one
        IF v_account_id IS NULL THEN
            INSERT INTO trading_accounts (
                user_id,
                name,
                broker,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                p_user_id,
                'Default Tradovate Account',
                'tradovate',
                TRUE,
                NOW(),
                NOW()
            )
            RETURNING id INTO v_account_id;
            
            v_debug_info := jsonb_build_object('created_account', true, 'account_id', v_account_id);
        ELSE
            v_debug_info := jsonb_build_object('found_account', true, 'account_id', v_account_id);
        END IF;
    ELSE
        v_debug_info := jsonb_build_object('provided_account', true, 'account_id', v_account_id);
    END IF;
    
    -- Verify account exists
    IF v_account_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to create or find a valid trading account',
            'processed', 0,
            'debug', v_debug_info
        );
    END IF;
    
    -- Double check account exists
    PERFORM 1 FROM trading_accounts WHERE id = v_account_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Trading account with ID ' || v_account_id || ' does not exist',
            'processed', 0,
            'debug', v_debug_info
        );
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
                v_account_id
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
        PERFORM update_analytics_for_user(p_user_id);
        v_analytics_result := jsonb_build_object('success', TRUE, 'message', 'Analytics updated successfully');
    END IF;

    -- Build the final result
    SELECT jsonb_build_object(
        'success', v_count > 0,
        'processed', v_count,
        'analytics', v_analytics_result,
        'debug', v_debug_info,
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
$function$; 