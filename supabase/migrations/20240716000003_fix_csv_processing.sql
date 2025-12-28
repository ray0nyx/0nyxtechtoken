-- Migration: Fix CSV processing to handle PNL values with dollar signs
-- Description: Updates the process_tradovate_csv_batch function to properly handle PNL values with dollar signs

-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240716000003_fix_csv_processing'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name, description, applied_at) 
    VALUES ('20240716000003_fix_csv_processing', 'Fix CSV processing to handle PNL values with dollar signs', NOW());
    
    -- Drop the existing function
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID);
    
    -- Create an improved function to process tradovate CSV batch
    CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
        p_user_id UUID,
        p_data TEXT,
        p_account_id UUID DEFAULT NULL
    ) RETURNS JSONB AS $$
    DECLARE
        v_result JSONB := '[]'::JSONB;
        v_data_jsonb JSONB;
        v_row JSONB;
        v_trade_id UUID;
        v_count INTEGER := 0;
        v_pnl NUMERIC;
        v_entry_price NUMERIC;
        v_exit_price NUMERIC;
        v_quantity NUMERIC;
    BEGIN
        -- Log for debugging
        RAISE NOTICE 'Function called with data length: %', LENGTH(p_data);
        
        -- Parse the input data as JSON
        BEGIN
            v_data_jsonb := p_data::JSONB;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to parse JSON: %', SQLERRM;
            RETURN jsonb_build_object('error', 'Invalid JSON: ' || SQLERRM);
        END;
        
        -- Check JSON type and log
        RAISE NOTICE 'JSON type: %', jsonb_typeof(v_data_jsonb);
        
        -- Ensure we have an array to work with
        IF jsonb_typeof(v_data_jsonb) <> 'array' THEN
            v_data_jsonb := jsonb_build_array(v_data_jsonb);
            RAISE NOTICE 'Converted to array: %', v_data_jsonb;
        END IF;

        -- Process each row in the array
        FOR v_row IN SELECT * FROM jsonb_array_elements(v_data_jsonb)
        LOOP
            v_count := v_count + 1;
            RAISE NOTICE 'Processing row %: %', v_count, v_row;
            
            BEGIN
                -- Clean numeric values
                BEGIN
                    -- Handle PNL with dollar sign
                    IF v_row->>'pnl' IS NOT NULL THEN
                        -- First try direct conversion
                        BEGIN
                            v_pnl := (v_row->>'pnl')::NUMERIC;
                        EXCEPTION WHEN OTHERS THEN
                            -- If that fails, clean the dollar sign
                            v_pnl := clean_dollar_sign_text(v_row->>'pnl');
                        END;
                    ELSE
                        v_pnl := NULL;
                    END IF;
                    
                    -- Handle other numeric values
                    BEGIN
                        v_entry_price := (v_row->>'entry_price')::NUMERIC;
                    EXCEPTION WHEN OTHERS THEN
                        v_entry_price := clean_dollar_sign_text(v_row->>'entry_price');
                    END;
                    
                    BEGIN
                        v_exit_price := (v_row->>'exit_price')::NUMERIC;
                    EXCEPTION WHEN OTHERS THEN
                        v_exit_price := clean_dollar_sign_text(v_row->>'exit_price');
                    END;
                    
                    BEGIN
                        v_quantity := (v_row->>'quantity')::NUMERIC;
                    EXCEPTION WHEN OTHERS THEN
                        v_quantity := clean_dollar_sign_text(v_row->>'quantity');
                    END;
                    
                    -- Calculate PNL if not provided
                    IF v_pnl IS NULL AND v_entry_price IS NOT NULL AND v_exit_price IS NOT NULL AND v_quantity IS NOT NULL THEN
                        IF v_row->>'side' = 'buy' OR v_row->>'position' = 'long' THEN
                            v_pnl := (v_exit_price - v_entry_price) * v_quantity;
                        ELSE
                            v_pnl := (v_entry_price - v_exit_price) * v_quantity;
                        END IF;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Error processing numeric values: %', SQLERRM;
                END;
                
                -- Insert the row into trades_staging table
                INSERT INTO trades_staging (
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
                    notes,
                    buyFillId,
                    sellFillId,
                    import_status,
                    date
                ) VALUES (
                    p_user_id,
                    v_row->>'symbol',
                    CASE 
                        WHEN v_row->>'side' = 'buy' THEN 'long'
                        WHEN v_row->>'side' = 'sell' THEN 'short'
                        ELSE NULL
                    END,
                    (v_row->>'entry_time')::TIMESTAMPTZ,
                    (v_row->>'exit_time')::TIMESTAMPTZ,
                    v_entry_price,
                    v_exit_price,
                    v_quantity,
                    v_pnl,
                    'Tradovate',
                    v_row->>'notes',
                    v_row->>'entry_execution_id',
                    v_row->>'exit_execution_id',
                    'pending',
                    CURRENT_DATE
                )
                RETURNING id INTO v_trade_id;
                
                -- Add success result
                v_result := v_result || jsonb_build_object(
                    'id', v_trade_id,
                    'success', TRUE
                );
                
                RAISE NOTICE 'Successfully inserted trade: %', v_trade_id;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error inserting row %: %', v_count, SQLERRM;
                v_result := v_result || jsonb_build_object(
                    'success', FALSE,
                    'error', SQLERRM,
                    'row', v_count
                );
            END;
        END LOOP;
        
        RAISE NOTICE 'Processed % rows with result: %', v_count, v_result;
        RETURN v_result;
    END;
    $$ LANGUAGE plpgsql;

    -- Grant necessary permissions
    GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, TEXT, UUID) TO authenticated;
    
    RAISE NOTICE 'Migration 20240716000003_fix_csv_processing has been applied';
  END IF;
END $$; 