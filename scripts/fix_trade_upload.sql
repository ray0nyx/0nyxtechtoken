-- Fix Trade Upload Issues
-- This script fixes issues with the Tradovate and TopstepX CSV upload functions
-- to ensure trades are properly saved to the trades table

-- Log the start of the script execution
DO $$
BEGIN
  RAISE NOTICE 'Starting trade upload fix script...';
END $$;

-- First, check if the user has accounts
DO $$
DECLARE
  account_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO account_count FROM accounts;
  
  RAISE NOTICE 'Found % accounts in the database', account_count;
  
  -- If no accounts exist, create default accounts for all users
  IF account_count = 0 THEN
    INSERT INTO accounts (id, user_id, name, platform, created_at, updated_at)
    SELECT 
      gen_random_uuid(), 
      id, 
      'Tradovate Account', 
      'tradovate', 
      NOW(), 
      NOW()
    FROM auth.users;
    
    INSERT INTO accounts (id, user_id, name, platform, created_at, updated_at)
    SELECT 
      gen_random_uuid(), 
      id, 
      'TopstepX Account', 
      'topstepx', 
      NOW(), 
      NOW()
    FROM auth.users;
    
    RAISE NOTICE 'Created default accounts for all users';
  END IF;
END $$;

-- Fix the process_tradovate_csv_row_fixed function to ensure it saves trades correctly
DROP FUNCTION IF EXISTS process_tradovate_csv_row_fixed(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION process_tradovate_csv_row_fixed(p_user_id uuid, p_account_id uuid, p_row jsonb)
RETURNS jsonb AS $$
DECLARE
    v_symbol TEXT;
    v_date DATE;
    v_qty INTEGER;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_fees NUMERIC;
    v_pnl NUMERIC;
    v_buy_fill_id TEXT;
    v_sell_fill_id TEXT;
    v_bought_timestamp TIMESTAMP;
    v_sold_timestamp TIMESTAMP;
    v_duration TEXT;
    v_trade_id UUID;
    v_side TEXT;
    v_debug_info TEXT;
BEGIN
    -- Log the input data for debugging
    v_debug_info := format('Processing row: %s', p_row);
    RAISE NOTICE '%', v_debug_info;

    -- Extract trade data from the row
    v_symbol := COALESCE(p_row->>'symbol', p_row->>'Symbol', p_row->>'contract', p_row->>'Contract');
    
    -- Try to parse the date
    BEGIN
        v_date := (p_row->>'date')::DATE;
    EXCEPTION WHEN OTHERS THEN
        -- Try alternative date formats
        BEGIN
            v_date := TO_DATE(p_row->>'date', 'MM/DD/YYYY');
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_date := TO_DATE(p_row->>'date', 'YYYY-MM-DD');
            EXCEPTION WHEN OTHERS THEN
                -- Default to current date if all parsing fails
                v_date := CURRENT_DATE;
            END;
        END;
    END;
    
    -- Parse quantity
    BEGIN
        v_qty := COALESCE(
            (p_row->>'qty')::INTEGER,
            (p_row->>'Qty')::INTEGER,
            (p_row->>'quantity')::INTEGER,
            (p_row->>'Quantity')::INTEGER,
            1  -- Default to 1 if not found
        );
    EXCEPTION WHEN OTHERS THEN
        v_qty := 1; -- Default to 1 if parsing fails
    END;
    
    -- Parse prices
    BEGIN
        v_entry_price := REPLACE(REPLACE(p_row->>'entry_price', ',', ''), '$', '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
    END;
    
    BEGIN
        v_exit_price := REPLACE(REPLACE(p_row->>'exit_price', ',', ''), '$', '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
    END;
    
    BEGIN
        v_fees := REPLACE(REPLACE(p_row->>'fees', ',', ''), '$', '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
    END;
    
    -- Parse PnL
    BEGIN
        -- Handle parentheses for negative values (like "(244.00)")
        v_pnl := REPLACE(REPLACE(REPLACE(p_row->>'pnl', ',', ''), '$', ''), '(', '-')::NUMERIC;
        v_pnl := REPLACE(v_pnl, ')', '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        -- Calculate PnL if not provided
        v_pnl := (v_exit_price - v_entry_price) * v_qty;
    END;
    
    -- Parse other fields
    v_buy_fill_id := p_row->>'buyFillId';
    v_sell_fill_id := p_row->>'sellFillId';
    
    BEGIN
        v_bought_timestamp := (p_row->>'boughtTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_bought_timestamp := NOW();
    END;
    
    BEGIN
        v_sold_timestamp := (p_row->>'soldTimestamp')::TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        v_sold_timestamp := NOW();
    END;
    
    v_duration := p_row->>'duration';
    
    -- Determine side/direction
    v_side := CASE WHEN v_qty > 0 THEN 'long' ELSE 'short' END;
    
    -- Insert trade into the trades table with all required fields
    INSERT INTO trades (
        id,
        user_id,
        account_id,
        symbol,
        side,
        quantity,
        price,
        pnl,
        fees,
        date,
        timestamp,
        broker,
        notes,
        created_at,
        updated_at,
        entry_price,
        entry_date,
        exit_date,
        exit_price,
        buyFillId,
        sellFillId,
        buyPrice,
        sellPrice,
        boughtTimestamp,
        soldTimestamp,
        position
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        p_account_id,
        v_symbol,
        v_side,
        ABS(v_qty),
        v_entry_price,
        v_pnl,
        v_fees,
        v_date,
        COALESCE(v_bought_timestamp, NOW()),
        'Tradovate',
        'Imported from Tradovate CSV',
        NOW(),
        NOW(),
        v_entry_price,
        v_bought_timestamp,
        v_sold_timestamp,
        v_exit_price,
        v_buy_fill_id,
        v_sell_fill_id,
        v_entry_price,
        v_exit_price,
        v_bought_timestamp,
        v_sold_timestamp,
        v_side
    )
    RETURNING id INTO v_trade_id;
    
    -- Log the successful insertion
    RAISE NOTICE 'Successfully inserted trade with ID: %', v_trade_id;
    
    -- Return success with the trade ID
    RETURN jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error inserting trade: %', SQLERRM;
    
    -- Return error info
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'data', p_row
    );
END;
$$ LANGUAGE plpgsql;

-- Fix the process_tradovate_csv_batch function to break the circular reference
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(p_user_id uuid, p_data jsonb, p_account_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_row JSONB;
    v_result JSONB;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_results JSONB := '[]'::JSONB;
    v_account_id UUID := p_account_id;
    v_error TEXT;
BEGIN
    -- Validate user_id
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'User ID is required',
            'processed', 0
        );
    END IF;
    
    -- If account_id is not provided, try to find a default one
    IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = p_user_id AND platform = 'tradovate'
        LIMIT 1;
        
        -- If still no account, create one
        IF v_account_id IS NULL THEN
            INSERT INTO accounts (
                id,
                user_id,
                name,
                platform,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                p_user_id,
                'Tradovate Account',
                'tradovate',
                NOW(),
                NOW()
            )
            RETURNING id INTO v_account_id;
            
            RAISE NOTICE 'Created new Tradovate account % for user %', v_account_id, p_user_id;
        END IF;
    END IF;
    
    -- Process each row in the data
    FOR i IN 0..jsonb_array_length(p_data) - 1 LOOP
        v_row := p_data->i;
        
        BEGIN
            -- Process the row using our fixed function
            SELECT * FROM process_tradovate_csv_row_fixed(p_user_id, v_account_id, v_row) INTO v_result;
            
            -- Check if the processing was successful
            IF (v_result->>'success')::BOOLEAN THEN
                v_success_count := v_success_count + 1;
            ELSE
                v_error_count := v_error_count + 1;
            END IF;
            
            -- Add the result to the results array
            v_results := v_results || v_result;
        EXCEPTION WHEN OTHERS THEN
            -- Handle any errors
            GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
            
            v_error_count := v_error_count + 1;
            v_results := v_results || jsonb_build_object(
                'success', FALSE,
                'error', v_error,
                'row', i,
                'data', v_row
            );
        END;
    END LOOP;
    
    -- Try to refresh analytics
    BEGIN
        -- First try to initialize analytics if they don't exist
        IF NOT EXISTS (SELECT 1 FROM analytics WHERE user_id = p_user_id AND metric_name = 'overall_metrics') THEN
            PERFORM calculate_user_analytics(p_user_id);
        END IF;
        
        -- Then refresh the analytics
        PERFORM refresh_analytics_for_user(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error refreshing analytics: %', SQLERRM;
    END;
    
    -- Return the final result
    RETURN jsonb_build_object(
        'success', v_success_count > 0,
        'processed', v_success_count,
        'errors', v_error_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- Create a client-facing function with the expected parameter order
DROP FUNCTION IF EXISTS process_tradovate_csv_batch_wrapper(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION process_tradovate_csv_batch_wrapper(p_account_id uuid, p_rows jsonb, p_user_id uuid)
RETURNS jsonb AS $$
BEGIN
    -- Call our fixed function with the correct parameter order
    RETURN process_tradovate_csv_batch(p_user_id, p_rows, p_account_id);
EXCEPTION WHEN OTHERS THEN
    -- Handle any errors
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Error in wrapper function: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Fix the TopstepX functions as well
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);

CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(trades_json jsonb)
RETURNS jsonb AS $$
DECLARE
    v_trade JSONB;
    v_trade_id UUID;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_result JSONB;
    v_errors TEXT[] := '{}';
    v_trade_ids UUID[] := '{}';
    v_first_trade JSONB;
    v_user_id UUID;
    v_account_id UUID;
    v_trade_dates DATE[] := '{}';
    v_error_details JSONB := '[]'::jsonb;
    v_current_error JSONB;
    v_debug_info TEXT;
BEGIN
    -- Initialize result
    v_result = jsonb_build_object(
        'success', true, -- Default to true, will be set to false if no trades are processed
        'processed_count', 0,
        'error_count', 0,
        'message', 'No trades processed',
        'trade_ids', v_trade_ids
    );
    
    -- Check if we have trades to process
    IF jsonb_array_length(trades_json) = 0 THEN
        v_result = jsonb_set(v_result, '{message}', '"No trades provided"');
        v_result = jsonb_set(v_result, '{success}', 'false');
        RETURN v_result;
    END IF;
    
    -- Get the first trade to extract user_id and account_id
    v_first_trade = trades_json->0;
    v_user_id = (v_first_trade->>'user_id')::UUID;
    v_account_id = (v_first_trade->>'account_id')::UUID;
    
    -- Basic validation
    IF v_user_id IS NULL THEN
        v_result = jsonb_set(v_result, '{message}', '"User ID is required"');
        v_result = jsonb_set(v_result, '{success}', 'false');
        RETURN v_result;
    END IF;
    
    -- If account_id is not provided, try to find a default one
    IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = v_user_id AND platform = 'topstepx'
        LIMIT 1;
        
        -- If still no account, create one
        IF v_account_id IS NULL THEN
            INSERT INTO accounts (
                id,
                user_id,
                name,
                platform,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_user_id,
                'TopstepX Account',
                'topstepx',
                NOW(),
                NOW()
            )
            RETURNING id INTO v_account_id;
            
            RAISE NOTICE 'Created new TopstepX account % for user %', v_account_id, v_user_id;
        END IF;
    END IF;
    
    -- Process each trade
    FOR i IN 0..jsonb_array_length(trades_json)-1 LOOP
        v_trade = trades_json->i;
        v_debug_info = format('Processing trade %s: %s', i, v_trade);
        RAISE NOTICE '%', v_debug_info;
        
        BEGIN
            -- Insert the trade directly into the trades table
            INSERT INTO trades (
                id,
                user_id,
                account_id,
                symbol,
                side,
                quantity,
                price,
                pnl,
                fees,
                date,
                timestamp,
                broker,
                notes,
                created_at,
                updated_at,
                entry_price,
                entry_date,
                exit_date,
                exit_price,
                position
            ) VALUES (
                gen_random_uuid(),
                v_user_id,
                v_account_id,
                v_trade->>'contract_name',
                v_trade->>'type',
                (v_trade->>'size')::INTEGER,
                (v_trade->>'entry_price')::NUMERIC,
                (v_trade->>'pnl')::NUMERIC,
                (v_trade->>'fees')::NUMERIC,
                (v_trade->>'trade_day')::DATE,
                (v_trade->>'entered_at')::TIMESTAMP,
                'TopstepX',
                'Imported from TopstepX CSV',
                NOW(),
                NOW(),
                (v_trade->>'entry_price')::NUMERIC,
                (v_trade->>'entered_at')::TIMESTAMP,
                (v_trade->>'exited_at')::TIMESTAMP,
                (v_trade->>'exit_price')::NUMERIC,
                v_trade->>'type'
            )
            RETURNING id INTO v_trade_id;
            
            IF v_trade_id IS NOT NULL THEN
                v_success_count = v_success_count + 1;
                v_trade_ids = array_append(v_trade_ids, v_trade_id);
                
                -- Track dates to recalculate daily summaries
                IF v_trade ? 'trade_day' THEN
                    v_trade_dates = array_append(v_trade_dates, (v_trade->>'trade_day')::DATE);
                ELSIF v_trade ? 'entered_at' THEN
                    v_trade_dates = array_append(v_trade_dates, ((v_trade->>'entered_at')::TIMESTAMPTZ)::DATE);
                END IF;
            ELSE
                v_error_count = v_error_count + 1;
                v_errors = array_append(v_errors, format('Failed to process trade at index %s', i));
                
                -- Add more detailed error information
                v_current_error = jsonb_build_object(
                    'index', i,
                    'message', 'Failed to process trade',
                    'data', v_trade
                );
                v_error_details = v_error_details || v_current_error;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count = v_error_count + 1;
                v_errors = array_append(v_errors, format('Error at index %s: %s', i, SQLERRM));
                
                -- Add more detailed error information
                v_current_error = jsonb_build_object(
                    'index', i,
                    'message', SQLERRM,
                    'code', SQLSTATE,
                    'data', v_trade
                );
                v_error_details = v_error_details || v_current_error;
        END;
    END LOOP;
    
    -- Try to recalculate daily P&L for affected dates
    IF array_length(v_trade_dates, 1) > 0 THEN
        BEGIN
            -- Try to call the update_user_analytics function if it exists
            BEGIN
                PERFORM update_user_analytics(v_user_id);
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Error updating user analytics: %', SQLERRM;
            END;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error recalculating daily summaries: %', SQLERRM;
        END;
    END IF;
    
    -- Prepare the final result
    IF v_success_count > 0 THEN
        v_result = jsonb_build_object(
            'success', true,
            'processed_count', v_success_count,
            'error_count', v_error_count,
            'message', format('Successfully processed %s trades', v_success_count),
            'trade_ids', v_trade_ids
        );
        
        -- Add errors if any, but keep success true if at least one trade was processed
        IF v_error_count > 0 THEN
            v_result = jsonb_set(v_result, '{message}', 
                to_jsonb(format('Processed %s trades with %s errors', v_success_count, v_error_count)));
            v_result = jsonb_set(v_result, '{errors}', to_jsonb(v_errors));
            v_result = jsonb_set(v_result, '{error_details}', v_error_details);
        END IF;
    ELSE
        -- All trades failed
        v_result = jsonb_build_object(
            'success', false,
            'processed_count', 0,
            'error_count', v_error_count,
            'message', 'Failed to process any trades. Errors: ' || array_to_string(v_errors, '; '),
            'errors', v_errors,
            'error_details', v_error_details
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Refresh analytics for all users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT id FROM auth.users LOOP
    BEGIN
      PERFORM calculate_user_analytics(user_record.id);
      RAISE NOTICE 'Refreshed analytics for user %', user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error refreshing analytics for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Log the completion of the script
DO $$
BEGIN
  RAISE NOTICE 'Trade upload fix script completed successfully';
END $$; 