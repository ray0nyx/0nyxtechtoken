-- Script to fix the entry price column issue in the trades table

-- First, check the current column names in the trades table
DO $$
BEGIN
  RAISE NOTICE 'Checking trades table columns related to price:';
  FOR r IN (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'trades'
    AND table_schema = 'public'
    AND column_name LIKE '%price%'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE 'Column: %, Type: %, Nullable: %', r.column_name, r.data_type, r.is_nullable;
  END LOOP;
END $$;

-- Create a new version of the function that handles different entry price column names
DO $$
BEGIN
  -- Drop all versions of the function
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, TEXT, UUID);
  DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping function: %', SQLERRM;
END $$;

-- Create a new version of the function that handles different entry price column names
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_account_id UUID := p_account_id;
  v_error TEXT;
  v_has_entry_price BOOLEAN;
  v_has_entryprice BOOLEAN;
  v_has_entry_price_column BOOLEAN;
  v_entry_price_column_name TEXT;
  v_exit_price_column_name TEXT;
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
  
  -- Check which entry price column exists in the trades table
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entry_price'
  ) INTO v_has_entry_price;
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'entryprice'
  ) INTO v_has_entryprice;
  
  -- Determine which column name to use
  IF v_has_entry_price THEN
    v_entry_price_column_name := 'entry_price';
    v_has_entry_price_column := TRUE;
  ELSIF v_has_entryprice THEN
    v_entry_price_column_name := 'entryprice';
    v_has_entry_price_column := TRUE;
  ELSE
    v_has_entry_price_column := FALSE;
    v_entry_price_column_name := 'price'; -- Fallback to regular price column
  END IF;
  
  -- Check which exit price column exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exit_price'
  ) INTO v_has_entry_price;
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trades' 
    AND table_schema = 'public'
    AND column_name = 'exitprice'
  ) INTO v_has_entryprice;
  
  -- Determine which exit price column name to use
  IF v_has_entry_price THEN
    v_exit_price_column_name := 'exit_price';
  ELSIF v_has_entryprice THEN
    v_exit_price_column_name := 'exitprice';
  ELSE
    v_exit_price_column_name := NULL; -- No exit price column
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..jsonb_array_length(p_rows) - 1 LOOP
    v_trade := p_rows->i;
    
    BEGIN
      -- Insert the trade with dynamic column handling
      IF v_has_entry_price_column AND v_exit_price_column_name IS NOT NULL THEN
        -- Both entry_price and exit_price columns exist
        EXECUTE format('
          INSERT INTO trades (
            id,
            user_id,
            account_id,
            symbol,
            side,
            quantity,
            price,
            pnl,
            date,
            timestamp,
            broker,
            created_at,
            updated_at,
            %I,
            %I
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW(),
            NOW(),
            $11,
            $12
          ) RETURNING id',
          v_entry_price_column_name,
          v_exit_price_column_name
        ) USING 
          p_user_id,
          v_account_id,
          v_trade->>'symbol',
          'long',
          (v_trade->>'qty')::INTEGER,
          (v_trade->>'entry_price')::NUMERIC,
          (v_trade->>'pnl')::NUMERIC,
          (v_trade->>'date')::DATE,
          NOW(),
          'Tradovate',
          (v_trade->>'entry_price')::NUMERIC,
          (v_trade->>'exit_price')::NUMERIC
        INTO v_trade_id;
      ELSIF v_has_entry_price_column THEN
        -- Only entry_price column exists
        EXECUTE format('
          INSERT INTO trades (
            id,
            user_id,
            account_id,
            symbol,
            side,
            quantity,
            price,
            pnl,
            date,
            timestamp,
            broker,
            created_at,
            updated_at,
            %I
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW(),
            NOW(),
            $11
          ) RETURNING id',
          v_entry_price_column_name
        ) USING 
          p_user_id,
          v_account_id,
          v_trade->>'symbol',
          'long',
          (v_trade->>'qty')::INTEGER,
          (v_trade->>'entry_price')::NUMERIC,
          (v_trade->>'pnl')::NUMERIC,
          (v_trade->>'date')::DATE,
          NOW(),
          'Tradovate',
          (v_trade->>'entry_price')::NUMERIC
        INTO v_trade_id;
      ELSE
        -- No special price columns, just use the regular price column
        INSERT INTO trades (
          id,
          user_id,
          account_id,
          symbol,
          side,
          quantity,
          price,
          pnl,
          date,
          timestamp,
          broker,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          p_user_id,
          v_account_id,
          v_trade->>'symbol',
          'long',
          (v_trade->>'qty')::INTEGER,
          (v_trade->>'entry_price')::NUMERIC,
          (v_trade->>'pnl')::NUMERIC,
          (v_trade->>'date')::DATE,
          NOW(),
          'Tradovate',
          NOW(),
          NOW()
        )
        RETURNING id INTO v_trade_id;
      END IF;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any errors
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      v_error_count := v_error_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'row', i,
        'data', v_trade
      );
    END;
  END LOOP;
  
  -- Return the final result
  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'processed', v_success_count,
    'errors', v_error_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated';
  RAISE NOTICE 'Granted execute permissions to authenticated users';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END $$;

-- Create a test function to verify the column names
CREATE OR REPLACE FUNCTION test_trades_columns()
RETURNS TEXT AS $$
DECLARE
  v_columns TEXT;
BEGIN
  SELECT string_agg(column_name, ', ') INTO v_columns
  FROM information_schema.columns
  WHERE table_name = 'trades'
  AND table_schema = 'public'
  ORDER BY ordinal_position;
  
  RETURN v_columns;
END;
$$ LANGUAGE plpgsql; 