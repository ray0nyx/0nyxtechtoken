-- Create the migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name TEXT NOT NULL UNIQUE
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Check if applied_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'migration_log' AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE migration_log ADD COLUMN applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- Check if created_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'migration_log' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE migration_log ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add migration tracking and create tables
DO $$ 
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000021_add_trades_staging'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name) 
    VALUES ('20240715000021_add_trades_staging');

    -- Create trades_staging table
    CREATE TABLE IF NOT EXISTS trades_staging (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        symbol TEXT,
        position TEXT CHECK (position IN ('long', 'short')),
        entry_date TIMESTAMPTZ,
        exit_date TIMESTAMPTZ,
        entry_price NUMERIC,
        exit_price NUMERIC,
        quantity NUMERIC,
        pnl NUMERIC,
        strategy TEXT,
        broker TEXT,
        notes TEXT,
        tags TEXT[],
        fees NUMERIC,
        buyFillId TEXT,
        sellFillId TEXT,
        buyPrice NUMERIC,
        sellPrice NUMERIC,
        boughtTimestamp TIMESTAMPTZ,
        soldTimestamp TIMESTAMPTZ,
        duration NUMERIC,
        priceFormat TEXT,
        priceFormatType TEXT,
        tickSize NUMERIC,
        qty NUMERIC,
        date DATE,
        import_status TEXT DEFAULT 'pending',
        error_message TEXT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create index on user_id
    CREATE INDEX IF NOT EXISTS trades_staging_user_id_idx ON trades_staging(user_id);

    -- Create index on import_status
    CREATE INDEX IF NOT EXISTS trades_staging_import_status_idx ON trades_staging(import_status);

    RAISE NOTICE 'Created trades_staging table and indexes';
  ELSE
    RAISE NOTICE 'Migration 20240715000021_add_trades_staging already applied';
  END IF;
END $$;

-- Drop all existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID);

-- Create function to process tradovate CSV batch (outside of DO block)
CREATE FUNCTION process_tradovate_csv_batch(
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
                (v_row->>'entry_price')::NUMERIC,
                (v_row->>'exit_price')::NUMERIC,
                (v_row->>'quantity')::NUMERIC,
                (v_row->>'pnl')::NUMERIC,
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
DO $$
BEGIN
  -- Grant permissions
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT ALL ON TABLE trades_staging TO authenticated;
  GRANT ALL ON TABLE migration_log TO authenticated;
  GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, TEXT, UUID) TO authenticated;

  RAISE NOTICE 'Migration 20240715000021_add_trades_staging has been applied';
END $$;