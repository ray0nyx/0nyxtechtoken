-- Migration to fix TopstepX trade processing
-- This migration adds an extended_data JSONB column to the trades table
-- and updates the processing functions with improved error handling

-- 1. First, add extended_data column to trades if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'extended_data'
    ) THEN
        ALTER TABLE trades
        ADD COLUMN extended_data JSONB DEFAULT '{}'::jsonb;
        
        COMMENT ON COLUMN trades.extended_data IS 'Store additional trade data that does not fit in the fixed schema';
    END IF;
END $$;

-- 2. Drop existing functions to recreate them with improved implementation
DROP FUNCTION IF EXISTS process_topstepx_csv_batch(jsonb);
DROP FUNCTION IF EXISTS process_topstepx_trade(uuid, text, timestamp with time zone, timestamp with time zone, numeric, numeric, numeric, numeric, integer, text, timestamp with time zone, integer, uuid, text);

-- 3. Create an improved process_topstepx_trade function with extended_data support
CREATE OR REPLACE FUNCTION process_topstepx_trade(
    p_user_id UUID,
    p_contract_name TEXT,
    p_entered_at TIMESTAMPTZ,
    p_exited_at TIMESTAMPTZ,
    p_entry_price NUMERIC,
    p_exit_price NUMERIC,
    p_fees NUMERIC,
    p_pnl NUMERIC,
    p_size INTEGER,
    p_type TEXT,
    p_trade_day TIMESTAMPTZ,
    p_trade_duration INTEGER,
    p_account_id UUID,
    p_platform TEXT DEFAULT 'topstepx',
    p_extended_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_trade_id UUID;
    v_position_type TEXT;
    v_trade_date DATE;
    v_symbol TEXT;
    v_price_precision INTEGER;
    v_debug_info JSONB;
    v_calculated_pnl NUMERIC;
    v_net_pnl NUMERIC;
BEGIN
    -- Improved input validation
    v_debug_info = jsonb_build_object(
        'user_id', p_user_id,
        'contract_name', p_contract_name,
        'entered_at', p_entered_at,
        'exited_at', p_exited_at,
        'entry_price', p_entry_price,
        'exit_price', p_exit_price,
        'fees', p_fees,
        'pnl', p_pnl,
        'size', p_size,
        'type', p_type,
        'account_id', p_account_id
    );
    
    -- Log processing attempt for debugging
    RAISE NOTICE 'Processing trade: %', v_debug_info;
    
    -- Basic validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;
    
    IF p_contract_name IS NULL OR p_contract_name = '' THEN
        RAISE EXCEPTION 'Contract name cannot be null or empty';
    END IF;
    
    IF p_entered_at IS NULL THEN
        RAISE EXCEPTION 'Entry time cannot be null';
    END IF;
    
    IF p_exited_at IS NULL THEN
        RAISE EXCEPTION 'Exit time cannot be null';
    END IF;
    
    IF p_entry_price IS NULL OR p_entry_price <= 0 THEN
        RAISE EXCEPTION 'Entry price must be a positive number, got %', p_entry_price;
    END IF;
    
    IF p_exit_price IS NULL OR p_exit_price <= 0 THEN
        RAISE EXCEPTION 'Exit price must be a positive number, got %', p_exit_price;
    END IF;
    
    -- Determine position type (long or short)
    v_position_type = LOWER(p_type);
    IF v_position_type IS NULL OR v_position_type = '' THEN
        v_position_type = 'long';
    END IF;
    
    -- Normalize position type
    IF v_position_type LIKE '%short%' THEN
        v_position_type = 'short';
    ELSE
        v_position_type = 'long';
    END IF;
    
    -- Extract trade date
    v_trade_date = COALESCE(p_trade_day::DATE, p_entered_at::DATE);
    
    -- Handle account ID (find or create default if not provided)
    IF p_account_id IS NULL THEN
        -- Check if user has any account
        SELECT id INTO p_account_id
        FROM accounts
        WHERE user_id = p_user_id
        ORDER BY created_at
        LIMIT 1;
        
        -- If no account found, create a default one
        IF p_account_id IS NULL THEN
            INSERT INTO accounts (
                user_id,
                name,
                platform,
                starting_balance,
                current_balance
            )
            VALUES (
                p_user_id,
                'Default TopstepX Account',
                'topstepx',
                0,
                0
            )
            RETURNING id INTO p_account_id;
        END IF;
    END IF;
    
    -- Extract just the symbol part if contract name includes expiration
    -- E.g., "ESH24" becomes "ES", "MNQ" stays "MNQ"
    v_symbol = regexp_replace(p_contract_name, '[0-9]', '', 'g');
    -- In case we end up with suffixes like 'H' (for March), remove them too
    v_symbol = regexp_replace(v_symbol, '[HFMJKNOUVXZ]$', '', 'g');
    
    -- Calculate P&L based on trade type if not provided or seems incorrect
    IF v_position_type = 'long' THEN
        v_calculated_pnl = (p_exit_price - p_entry_price) * p_size;
    ELSE
        v_calculated_pnl = (p_entry_price - p_exit_price) * p_size;
    END IF;
    
    -- For futures, adjust based on tick sizes (simplified approach)
    -- This is a simplification and may need adjustment for specific futures contracts
    v_price_precision = 2; -- Default to 2 decimal places
    
    -- Common futures tick sizes
    IF v_symbol IN ('ES', 'MES') THEN
        -- E-mini S&P and Micro E-mini S&P
        v_price_precision = 2;
        IF v_symbol = 'ES' THEN
            v_calculated_pnl = v_calculated_pnl * 50; -- $50 per point for ES
        ELSE
            v_calculated_pnl = v_calculated_pnl * 5; -- $5 per point for MES
        END IF;
    ELSIF v_symbol IN ('NQ', 'MNQ') THEN
        -- E-mini NASDAQ and Micro E-mini NASDAQ
        v_price_precision = 2;
        IF v_symbol = 'NQ' THEN
            v_calculated_pnl = v_calculated_pnl * 20; -- $20 per point for NQ
        ELSE
            v_calculated_pnl = v_calculated_pnl * 2; -- $2 per point for MNQ
        END IF;
    ELSIF v_symbol IN ('CL', 'MCL') THEN
        -- Crude Oil
        v_price_precision = 2;
        IF v_symbol = 'CL' THEN
            v_calculated_pnl = v_calculated_pnl * 1000; -- $1000 per point for CL
        ELSE
            v_calculated_pnl = v_calculated_pnl * 100; -- $100 per point for MCL
        END IF;
    ELSIF v_symbol IN ('GC', 'MGC') THEN
        -- Gold
        v_price_precision = 2;
        IF v_symbol = 'GC' THEN
            v_calculated_pnl = v_calculated_pnl * 100; -- $100 per point for GC
        ELSE
            v_calculated_pnl = v_calculated_pnl * 10; -- $10 per point for MGC
        END IF;
    END IF;
    
    -- Decide which P&L to use (provided or calculated)
    -- Use the provided P&L if it's reasonable, otherwise use calculated
    IF p_pnl IS NOT NULL AND p_pnl != 0 THEN
        -- If the provided P&L is within 20% of calculated or the difference is small (<$10),
        -- use the provided value as it's likely correct
        IF ABS(p_pnl - v_calculated_pnl) < 10 OR 
           ABS(p_pnl - v_calculated_pnl) / GREATEST(ABS(v_calculated_pnl), 1) < 0.2 THEN
            v_calculated_pnl = p_pnl;
        END IF;
    END IF;
    
    -- Calculate net P&L (after fees)
    v_net_pnl = v_calculated_pnl - COALESCE(p_fees, 0);
    
    -- Insert trade with all available information
    INSERT INTO trades (
        user_id,
        account_id,
        symbol,
        side,
        quantity,
        price,
        exit_price,
        timestamp,
        exit_time,
        pnl,
        net_pnl,
        fees,
        trade_date,
        platform,
        notes,
        analytics,
        duration_seconds,
        extended_data
    )
    VALUES (
        p_user_id,
        p_account_id,
        p_contract_name,
        v_position_type,
        p_size,
        ROUND(p_entry_price, v_price_precision),
        ROUND(p_exit_price, v_price_precision),
        p_entered_at,
        p_exited_at,
        ROUND(v_calculated_pnl, 2),
        ROUND(v_net_pnl, 2),
        COALESCE(p_fees, 0),
        v_trade_date,
        p_platform,
        'Imported from TopstepX',
        jsonb_build_object(
            'symbol_base', v_symbol,
            'duration_minutes', COALESCE(p_trade_duration, 
                                        EXTRACT(EPOCH FROM (p_exited_at - p_entered_at))/60),
            'price_precision', v_price_precision,
            'calculated_pnl', v_calculated_pnl,
            'provided_pnl', p_pnl
        ),
        EXTRACT(EPOCH FROM (p_exited_at - p_entered_at)),
        COALESCE(p_extended_data, '{}'::jsonb)
    )
    RETURNING id INTO v_trade_id;
    
    -- Update user analytics
    BEGIN
        PERFORM update_user_analytics(p_user_id);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error updating analytics: %', SQLERRM;
    END;
    
    RETURN v_trade_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error with detailed context
        RAISE NOTICE 'Error processing trade: % - %, Details: %', 
                     SQLERRM, SQLSTATE, v_debug_info;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create an improved process_topstepx_csv_batch function
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(trades_json JSONB)
RETURNS JSONB AS $$
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
BEGIN
    -- Initialize result
    v_result = jsonb_build_object(
        'success', false,
        'processed_count', 0,
        'error_count', 0,
        'message', 'No trades processed',
        'trade_ids', v_trade_ids
    );
    
    -- Check if we have trades to process
    IF jsonb_array_length(trades_json) = 0 THEN
        v_result = jsonb_set(v_result, '{message}', '"No trades provided"');
        RETURN v_result;
    END IF;
    
    -- Get the first trade to extract user_id and account_id
    v_first_trade = trades_json->0;
    v_user_id = (v_first_trade->>'user_id')::UUID;
    v_account_id = (v_first_trade->>'account_id')::UUID;
    
    -- Basic validation
    IF v_user_id IS NULL THEN
        v_result = jsonb_set(v_result, '{message}', '"User ID is required"');
        RETURN v_result;
    END IF;
    
    -- Process each trade
    FOR i IN 0..jsonb_array_length(trades_json)-1 LOOP
        v_trade = trades_json->i;
        
        BEGIN
            -- Call the process_topstepx_trade function with all fields from JSON
            v_trade_id = process_topstepx_trade(
                (v_trade->>'user_id')::UUID,
                v_trade->>'contract_name',
                (v_trade->>'entered_at')::TIMESTAMPTZ,
                (v_trade->>'exited_at')::TIMESTAMPTZ,
                (v_trade->>'entry_price')::NUMERIC,
                (v_trade->>'exit_price')::NUMERIC,
                (v_trade->>'fees')::NUMERIC,
                (v_trade->>'pnl')::NUMERIC,
                (v_trade->>'size')::INTEGER,
                v_trade->>'type',
                (v_trade->>'trade_day')::TIMESTAMPTZ,
                (v_trade->>'trade_duration')::INTEGER,
                (v_trade->>'account_id')::UUID,
                v_trade->>'platform',
                CASE 
                    WHEN v_trade ? 'original_data' THEN 
                        jsonb_build_object('original_data', v_trade->'original_data')
                    ELSE '{}'::jsonb
                END
            );
            
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
            -- Recalculate daily summaries for the affected dates
            -- This is just a placeholder - replace with your actual daily summary recalculation logic
            RAISE NOTICE 'Would recalculate daily summaries for dates: %', v_trade_dates;
            
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
        
        -- Add errors if any
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

-- 5. Grant permissions on the new functions
GRANT EXECUTE ON FUNCTION process_topstepx_trade(uuid, text, timestamptz, timestamptz, numeric, numeric, numeric, numeric, integer, text, timestamptz, integer, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(jsonb) TO authenticated; 