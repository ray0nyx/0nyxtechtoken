-- Fix for tradovate upload function to handle duration type properly
DO $$
BEGIN
  RAISE NOTICE 'Starting Tradovate function duration type fix...';
  
  -- Drop the existing function
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB, UUID);
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, JSONB);
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(JSONB);
    RAISE NOTICE 'Dropped existing process_tradovate_csv_batch functions';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping functions: %', SQLERRM;
  END;
END;
$$;

-- Create the fixed function
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB,
  p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_trade_id UUID;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
  v_account_id UUID := p_account_id;
  v_error TEXT;
  v_symbol TEXT;
  v_side TEXT;
  v_quantity INTEGER;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_pnl NUMERIC;
  v_fees NUMERIC;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_date DATE;
  v_total_rows INTEGER;
  v_detailed_errors JSONB := '[]'::JSONB;
BEGIN
  RAISE NOTICE 'Starting process_tradovate_csv_batch with user_id: %, account_id: %, rows count: %', 
    p_user_id, 
    p_account_id, 
    CASE WHEN jsonb_typeof(p_rows) = 'array' THEN jsonb_array_length(p_rows)::text ELSE 'not an array' END;
  
  -- Validate user_id
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User ID is required',
      'processed', 0
    );
  END IF;
  
  -- Validate rows input
  IF p_rows IS NULL OR jsonb_typeof(p_rows) != 'array' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Rows parameter must be a valid JSON array',
      'processed', 0
    );
  END IF;
  
  -- Get total rows count
  v_total_rows := jsonb_array_length(p_rows);
  
  IF v_total_rows = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No rows to process',
      'processed', 0
    );
  END IF;
  
  -- If account_id is not provided, try to find a default one
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM accounts
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    RAISE NOTICE 'Using account ID % for user %', v_account_id, p_user_id;
    
    -- If still no account, create one
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (
        user_id,
        name,
        platform,
        balance,
        created_at,
        updated_at
      ) VALUES (
        p_user_id,
        'Tradovate Account',
        'tradovate',
        0,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_account_id;
      
      RAISE NOTICE 'Created new Tradovate account % for user %', v_account_id, p_user_id;
    END IF;
  END IF;
  
  -- Process each trade in the batch
  FOR i IN 0..v_total_rows - 1 LOOP
    v_trade := p_rows->i;
    
    BEGIN
      -- Extract and log each field for debugging
      RAISE NOTICE 'Processing row %: %', i, v_trade;
      
      -- Extract symbol with fallbacks
      v_symbol := COALESCE(
        v_trade->>'symbol',
        v_trade->>'Symbol',
        v_trade->>'contract',
        v_trade->>'Contract',
        'Unknown'
      );
      
      -- Extract side/position
      v_side := CASE 
        WHEN LOWER(v_trade->>'side') = 'buy' OR LOWER(v_trade->>'side') = 'long' THEN 'long'
        WHEN LOWER(v_trade->>'side') = 'sell' OR LOWER(v_trade->>'side') = 'short' THEN 'short'
        ELSE 'long' -- Default to long if not specified
      END;
      
      -- Extract quantity
      BEGIN
        v_quantity := COALESCE(
          (NULLIF(TRIM(v_trade->>'qty'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'quantity'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'size'), ''))::INTEGER,
          1
        );
      EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
      END;
      
      -- Extract entry price
      BEGIN
        v_entry_price := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'entry_price', '$', ''), ',', '')), ''))::NUMERIC,
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'buyPrice', '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
      END;
      
      -- Extract exit price
      BEGIN
        v_exit_price := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'exit_price', '$', ''), ',', '')), ''))::NUMERIC,
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'sellPrice', '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
      END;
      
      -- Extract PnL
      BEGIN
        v_pnl := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'pnl', '$', ''), ',', '')), ''))::NUMERIC,
          (v_exit_price - v_entry_price) * v_quantity
        );
      EXCEPTION WHEN OTHERS THEN
        v_pnl := (v_exit_price - v_entry_price) * v_quantity;
      END;
      
      -- Extract fees
      BEGIN
        v_fees := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'fees', '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
      END;
      
      -- Extract entry_date
      BEGIN
        v_entry_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'entry_date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'boughtTimestamp'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'timestamp'), ''))::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_entry_date := NOW();
      END;
      
      -- Extract exit_date
      BEGIN
        v_exit_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'exit_date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'soldTimestamp'), ''))::TIMESTAMP,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        v_exit_date := NOW();
      END;
      
      -- Set date field
      BEGIN
        v_date := COALESCE(
          (v_trade->>'date')::DATE,
          v_entry_date::DATE
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := CURRENT_DATE;
      END;
      
      -- Insert the trade
      INSERT INTO trades (
        user_id,
        account_id,
        symbol,          -- Symbol/contract name
        side,            -- Direction of trade
        position,        -- Same as side for compatibility
        quantity,        -- Number of contracts
        size,            -- Same as quantity
        price,           -- Using entry_price for price
        entry_price,     -- Buy/entry price
        exit_price,      -- Sell/exit price
        pnl,             -- Profit/loss
        fees,            -- Fees/commissions
        entry_date,      -- When trade was entered
        exit_date,       -- When trade was exited
        date,            -- Trade date (date part of entry)
        timestamp,       -- Using entry_date for timestamp
        broker,          -- Set to Tradovate
        created_at,
        updated_at,
        notes,           -- Add notes indicating import source
        "buyFillId",     -- Tradovate specific fields - note the case and quotes!
        "sellFillId",
        "buyPrice",
        "sellPrice",
        "boughtTimestamp",
        "soldTimestamp",
        duration
      ) VALUES (
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        v_side,
        v_quantity,
        v_quantity,
        v_entry_price,
        v_entry_price,
        v_exit_price,
        v_pnl,
        v_fees,
        v_entry_date,
        v_exit_date,
        v_date,
        v_entry_date,
        'Tradovate',
        NOW(),
        NOW(),
        'Imported from Tradovate CSV',
        v_trade->>'buyFillId',
        v_trade->>'sellFillId',
        COALESCE((NULLIF(TRIM(v_trade->>'buyPrice'), ''))::NUMERIC, v_entry_price),
        COALESCE((NULLIF(TRIM(v_trade->>'sellPrice'), ''))::NUMERIC, v_exit_price),
        COALESCE(
          (NULLIF(TRIM(v_trade->>'boughtTimestamp'), ''))::TIMESTAMP,
          v_entry_date
        ),
        COALESCE(
          (NULLIF(TRIM(v_trade->>'soldTimestamp'), ''))::TIMESTAMP,
          v_exit_date
        ),
        -- Always return an interval type for consistency
        CASE
          WHEN v_trade->>'duration' IS NOT NULL THEN
            CASE
              -- Parse "1min 10sec" format
              WHEN v_trade->>'duration' ~ '^[0-9]+min [0-9]+sec$' THEN
                (SPLIT_PART(v_trade->>'duration', 'min', 1)::int * INTERVAL '1 minute') + 
                (REGEXP_REPLACE(SPLIT_PART(v_trade->>'duration', 'min ', 2), 'sec.*', '')::int * INTERVAL '1 second')
              -- Parse "15sec" format  
              WHEN v_trade->>'duration' ~ '^[0-9]+sec$' THEN
                (REGEXP_REPLACE(v_trade->>'duration', 'sec.*', '')::int * INTERVAL '1 second')
              -- Try to parse as an integer number of seconds
              WHEN v_trade->>'duration' ~ '^[0-9]+$' THEN
                ((v_trade->>'duration')::int * INTERVAL '1 second')
              -- Calculate from timestamps if duration can't be parsed and timestamps exist
              WHEN v_exit_date IS NOT NULL AND v_entry_date IS NOT NULL THEN
                v_exit_date - v_entry_date
              -- Default to a small interval if all else fails
              ELSE
                INTERVAL '1 second'
            END
          -- If no duration provided, calculate from timestamps
          WHEN v_exit_date IS NOT NULL AND v_entry_date IS NOT NULL THEN
            v_exit_date - v_entry_date
          -- Fallback default
          ELSE
            INTERVAL '1 second'
        END
      )
      RETURNING id INTO v_trade_id;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id,
        'row_index', i,
        'account_id_used', v_account_id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Handle any errors
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      
      RAISE NOTICE 'Error in row %: %', i, v_error;
      
      v_error_count := v_error_count + 1;
      v_detailed_errors := v_detailed_errors || jsonb_build_object(
        'row', i,
        'error', v_error,
        'data', v_trade
      );
      
      v_results := v_results || jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'row_index', i,
        'account_id_used', v_account_id
      );
    END;
  END LOOP;
  
  -- Return the final result
  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'message', format('Processed %s rows with %s errors', v_total_rows, v_error_count),
    'total_rows', v_total_rows,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'user_id', p_user_id,
    'account_id', v_account_id,
    'results', v_results,
    'detailed_errors', CASE WHEN v_error_count > 0 THEN v_detailed_errors ELSE NULL END
  );
EXCEPTION WHEN OTHERS THEN
  -- Catch any unexpected errors
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Unexpected error: ' || SQLERRM,
    'processed', v_success_count,
    'errors', v_error_count + 1,
    'user_id', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create 2-parameter version for backward compatibility
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create JSONB version for backward compatibility
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_rows JSONB;
  v_account_id UUID := NULL;
BEGIN
  -- Extract parameters with validation
  IF p_data ? 'user_id' AND p_data->>'user_id' IS NOT NULL THEN
    v_user_id := (p_data->>'user_id')::UUID;
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Missing required parameter: user_id'
    );
  END IF;
  
  IF p_data ? 'rows' AND p_data->'rows' IS NOT NULL THEN
    v_rows := p_data->'rows';
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Missing required parameter: rows'
    );
  END IF;
  
  IF p_data ? 'account_id' AND p_data->>'account_id' IS NOT NULL THEN
    v_account_id := (p_data->>'account_id')::UUID;
  END IF;
  
  -- Call the main function
  RETURN process_tradovate_csv_batch(v_user_id, v_rows, v_account_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE 'Tradovate function updated with proper duration type handling';
END;
$$; 