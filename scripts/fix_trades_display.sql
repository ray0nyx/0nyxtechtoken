-- Fix trades display issue by ensuring proper column mapping
-- This script fixes the process_tradovate_csv_batch function to use the correct column names

-- First, let's check what columns actually exist in the trades table
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE 'Current trades table columns:';
    FOR col_record IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'trades' AND table_schema = 'public'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE 'Column: % (Type: %)', col_record.column_name, col_record.data_type;
    END LOOP;
END $$;

-- Create a simplified version of the process_tradovate_csv_batch function
-- that only uses the essential columns that exist
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
  v_quantity NUMERIC;
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
      
      -- Extract quantity
      BEGIN
        v_quantity := COALESCE(
          (NULLIF(TRIM(v_trade->>'qty'), ''))::NUMERIC,
          (NULLIF(TRIM(v_trade->>'quantity'), ''))::NUMERIC,
          (NULLIF(TRIM(v_trade->>'size'), ''))::NUMERIC,
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
      
      -- Extract fees
      BEGIN
        v_fees := COALESCE(
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'fees', '$', ''), ',', '')), ''))::NUMERIC,
          0
        );
      EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
      END;
      
      -- Extract side/position
      v_side := LOWER(COALESCE(
        v_trade->>'side',
        v_trade->>'position',
        'long'
      ));
      
      -- Normalize side values
      IF v_side LIKE '%buy%' OR v_side LIKE '%long%' THEN
        v_side := 'long';
      ELSIF v_side LIKE '%sell%' OR v_side LIKE '%short%' THEN
        v_side := 'short';
      ELSE
        v_side := 'long';  -- Default to long if unclear
      END IF;
      
      -- Calculate PnL using the proper futures calculation
      v_pnl := calculate_futures_pnl(v_symbol, v_side, v_entry_price, v_exit_price, v_quantity::INTEGER, v_fees);
      
      -- Extract dates - try multiple date formats
      BEGIN
        -- Try various formats for entry_date
        v_entry_date := NULL;
        
        -- First try direct timestamp conversion
        BEGIN
          v_entry_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'entry_date'), ''))::TIMESTAMP,
            (NULLIF(TRIM(v_trade->>'boughtTimestamp'), ''))::TIMESTAMP
          );
        EXCEPTION WHEN OTHERS THEN
          -- If that fails, try parsing as different formats
          IF v_trade->>'entry_date' ~ '^\d{4}-\d{2}-\d{2}' THEN
            -- ISO format (YYYY-MM-DD)
            BEGIN
              v_entry_date := (v_trade->>'entry_date')::TIMESTAMP;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          ELSIF v_trade->>'entry_date' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
            -- MM/DD/YYYY format
            BEGIN
              IF LENGTH(v_trade->>'entry_date') > 10 THEN
                v_entry_date := TO_TIMESTAMP(v_trade->>'entry_date', 'MM/DD/YYYY HH24:MI:SS');
              ELSE
                v_entry_date := TO_TIMESTAMP(v_trade->>'entry_date', 'MM/DD/YYYY');
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
          
          -- Try similar parsing for boughtTimestamp if needed
          IF v_entry_date IS NULL AND v_trade->>'boughtTimestamp' IS NOT NULL THEN
            BEGIN
              IF v_trade->>'boughtTimestamp' ~ '^\d{4}-\d{2}-\d{2}' THEN
                v_entry_date := (v_trade->>'boughtTimestamp')::TIMESTAMP;
              ELSIF v_trade->>'boughtTimestamp' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
                IF LENGTH(v_trade->>'boughtTimestamp') > 10 THEN
                  v_entry_date := TO_TIMESTAMP(v_trade->>'boughtTimestamp', 'MM/DD/YYYY HH24:MI:SS');
                ELSE
                  v_entry_date := TO_TIMESTAMP(v_trade->>'boughtTimestamp', 'MM/DD/YYYY');
                END IF;
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END;
        
        -- If all parsing failed, use current timestamp
        IF v_entry_date IS NULL THEN
          v_entry_date := CURRENT_TIMESTAMP;
        END IF;
        
        -- Similar logic for exit_date
        v_exit_date := NULL;
        
        -- First try direct timestamp conversion
        BEGIN
          v_exit_date := COALESCE(
            (NULLIF(TRIM(v_trade->>'exit_date'), ''))::TIMESTAMP,
            (NULLIF(TRIM(v_trade->>'soldTimestamp'), ''))::TIMESTAMP
          );
        EXCEPTION WHEN OTHERS THEN
          -- If that fails, try parsing as different formats
          IF v_trade->>'exit_date' ~ '^\d{4}-\d{2}-\d{2}' THEN
            -- ISO format (YYYY-MM-DD)
            BEGIN
              v_exit_date := (v_trade->>'exit_date')::TIMESTAMP;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          ELSIF v_trade->>'exit_date' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
            -- MM/DD/YYYY format
            BEGIN
              IF LENGTH(v_trade->>'exit_date') > 10 THEN
                v_exit_date := TO_TIMESTAMP(v_trade->>'exit_date', 'MM/DD/YYYY HH24:MI:SS');
              ELSE
                v_exit_date := TO_TIMESTAMP(v_trade->>'exit_date', 'MM/DD/YYYY');
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
          
          -- Try similar parsing for soldTimestamp if needed
          IF v_exit_date IS NULL AND v_trade->>'soldTimestamp' IS NOT NULL THEN
            BEGIN
              IF v_trade->>'soldTimestamp' ~ '^\d{4}-\d{2}-\d{2}' THEN
                v_exit_date := (v_trade->>'soldTimestamp')::TIMESTAMP;
              ELSIF v_trade->>'soldTimestamp' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
                IF LENGTH(v_trade->>'soldTimestamp') > 10 THEN
                  v_exit_date := TO_TIMESTAMP(v_trade->>'soldTimestamp', 'MM/DD/YYYY HH24:MI:SS');
                ELSE
                  v_exit_date := TO_TIMESTAMP(v_trade->>'soldTimestamp', 'MM/DD/YYYY');
                END IF;
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END;
        
        -- If all parsing failed, use entry_date or current timestamp
        IF v_exit_date IS NULL THEN
          v_exit_date := COALESCE(v_entry_date, CURRENT_TIMESTAMP);
        END IF;
        
        -- Extract or derive the date field
        v_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'date'), ''))::DATE,
          v_entry_date::DATE
        );
      EXCEPTION WHEN OTHERS THEN
        -- If all date parsing fails, use current date
        v_entry_date := CURRENT_TIMESTAMP;
        v_exit_date := CURRENT_TIMESTAMP;
        v_date := CURRENT_DATE;
      END;
      
      -- Insert the trade using ONLY the columns that definitely exist
      -- Based on the schema, we'll use the basic columns
      INSERT INTO trades (
        user_id,
        symbol,
        side,
        quantity,
        price,
        timestamp,
        broker,
        notes,
        created_at,
        updated_at,
        entry_date,
        pnl
      ) VALUES (
        p_user_id,
        v_symbol,
        v_side,
        v_quantity,
        v_entry_price,  -- Using entry_price for the price field
        v_entry_date,   -- Using entry_date for timestamp
        'Tradovate',
        'Imported from Tradovate CSV - PnL: $' || v_pnl::TEXT,
        NOW(),
        NOW(),
        v_entry_date,
        v_pnl
      )
      RETURNING id INTO v_trade_id;
      
      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object(
        'success', TRUE,
        'trade_id', v_trade_id,
        'row_index', i,
        'account_id_used', v_account_id,
        'pnl_calculated', v_pnl,
        'symbol', v_symbol,
        'multiplier', get_contract_multiplier(v_symbol)
      );
      
      RAISE NOTICE 'Successfully inserted trade: ID=%, Symbol=%, PnL=%, Entry=%, Exit=%', 
        v_trade_id, v_symbol, v_pnl, v_entry_price, v_exit_price;
      
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
  
  -- Try to update analytics if any trades were processed successfully
  IF v_success_count > 0 THEN
    BEGIN
      -- Update analytics manually (basic version)
      DECLARE
        v_metric_names TEXT[] := ARRAY[
          'winning_days', 'win_rate', 'total_trades', 'total_pnl', 
          'avg_pnl_per_contract', 'avg_win', 'avg_loss', 'profit_factor', 
          'expectancy', 'sharpe_ratio', 'largest_win', 'largest_loss',
          'win_loss_ratio', 'consecutive_wins', 'consecutive_losses'
        ];
        v_metric TEXT;
        v_value NUMERIC;
        v_metric_id UUID;
      BEGIN
        -- For each metric, calculate and update
        FOREACH v_metric IN ARRAY v_metric_names
        LOOP
          BEGIN
            -- Calculate the metric value
            EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;

            -- Check if metric exists
            SELECT id INTO v_metric_id 
            FROM analytics 
            WHERE user_id = p_user_id AND metric_name = v_metric
            LIMIT 1;

            IF v_metric_id IS NOT NULL THEN
              -- Update existing metric
              UPDATE analytics 
              SET value = v_value, updated_at = NOW()
              WHERE id = v_metric_id;
            ELSE
              -- Insert new metric
              INSERT INTO analytics (user_id, metric_name, value)
              VALUES (p_user_id, v_metric, v_value);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- Just log and continue
            RAISE NOTICE 'Error updating metric %: %', v_metric, SQLERRM;
          END;
        END LOOP;
      END;
    EXCEPTION WHEN OTHERS THEN
      -- Just log the error but don't fail the whole operation
      RAISE WARNING 'Error updating analytics: %', SQLERRM;
    END;
  END IF;
  
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated;

-- Create backward compatibility versions
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_rows JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN process_tradovate_csv_batch(p_user_id, p_rows, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB) TO authenticated;
