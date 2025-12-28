-- Final fix for the Tradovate function - ensures all columns are compatible with the trades table

-- Drop all existing related functions
DO $$
BEGIN
  -- Drop existing functions
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb, uuid): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS process_tradovate_csv_batch(uuid, jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop process_tradovate_csv_batch(uuid, jsonb): %', SQLERRM;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS upload_tradovate_trades(uuid, jsonb, uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop upload_tradovate_trades(uuid, jsonb, uuid): %', SQLERRM;
  END;
END $$;

-- Create a new fixed function with correct column names
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
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_date DATE;
  v_total_rows INTEGER;
  v_detailed_errors JSONB := '[]'::JSONB;
BEGIN
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
    WHERE user_id = p_user_id AND platform = 'tradovate'
    LIMIT 1;
    
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
      -- Extract trade data with improved error handling
      -- Extract symbol with fallbacks
      BEGIN
        v_symbol := COALESCE(
          v_trade->>'symbol', 
          v_trade->>'Symbol', 
          v_trade->>'contract', 
          v_trade->>'Contract',
          v_trade->>'contract_name',
          'Unknown'
        );
        
        IF v_symbol IS NULL OR v_symbol = '' THEN
          v_symbol := 'Unknown';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_symbol := 'Unknown';
      END;
      
      -- Extract side with fallbacks
      BEGIN
        v_side := LOWER(COALESCE(
          v_trade->>'side', 
          v_trade->>'Side', 
          v_trade->>'position', 
          v_trade->>'Position',
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
      EXCEPTION WHEN OTHERS THEN
        v_side := 'long';
      END;
      
      -- Parse quantity with extensive cleanup
      BEGIN
        v_quantity := COALESCE(
          (NULLIF(TRIM(v_trade->>'quantity'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'Quantity'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'qty'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'Qty'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'size'), ''))::INTEGER,
          (NULLIF(TRIM(v_trade->>'Size'), ''))::INTEGER,
          1
        );
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try removing commas and parsing again
          v_quantity := COALESCE(
            (REPLACE(NULLIF(TRIM(v_trade->>'quantity'), ''), ',', ''))::INTEGER,
            (REPLACE(NULLIF(TRIM(v_trade->>'Quantity'), ''), ',', ''))::INTEGER,
            (REPLACE(NULLIF(TRIM(v_trade->>'qty'), ''), ',', ''))::INTEGER,
            (REPLACE(NULLIF(TRIM(v_trade->>'Qty'), ''), ',', ''))::INTEGER,
            (REPLACE(NULLIF(TRIM(v_trade->>'size'), ''), ',', ''))::INTEGER,
            (REPLACE(NULLIF(TRIM(v_trade->>'Size'), ''), ',', ''))::INTEGER,
            1
          );
        EXCEPTION WHEN OTHERS THEN
          v_quantity := 1;
        END;
      END;
      
      -- Ensure quantity is positive
      v_quantity := ABS(v_quantity);
      
      -- Parse entry price with extensive cleanup
      BEGIN
        v_entry_price := NULLIF(TRIM(REPLACE(REPLACE(REPLACE(
          COALESCE(
            v_trade->>'entry_price', 
            v_trade->>'entryPrice',
            v_trade->>'Entry Price',
            v_trade->>'buyPrice',
            v_trade->>'BuyPrice',
            '0'
          ), 
          ',', ''), '$', ''), '₹', '')
        ), '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try parsing with additional cleanup for parentheses (negative numbers)
          v_entry_price := REPLACE(REPLACE(REPLACE(REPLACE(
            COALESCE(
              v_trade->>'entry_price', 
              v_trade->>'entryPrice',
              v_trade->>'Entry Price',
              v_trade->>'buyPrice',
              v_trade->>'BuyPrice',
              '0'
            ),
            ',', ''), '$', ''), '₹', ''), '(', '-'
          );
          v_entry_price := REPLACE(v_entry_price, ')', '')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          v_entry_price := 0;
        END;
      END;
      
      -- Parse exit price with extensive cleanup
      BEGIN
        v_exit_price := NULLIF(TRIM(REPLACE(REPLACE(REPLACE(
          COALESCE(
            v_trade->>'exit_price', 
            v_trade->>'exitPrice',
            v_trade->>'Exit Price',
            v_trade->>'sellPrice',
            v_trade->>'SellPrice',
            '0'
          ), 
          ',', ''), '$', ''), '₹', '')
        ), '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try parsing with additional cleanup for parentheses (negative numbers)
          v_exit_price := REPLACE(REPLACE(REPLACE(REPLACE(
            COALESCE(
              v_trade->>'exit_price', 
              v_trade->>'exitPrice',
              v_trade->>'Exit Price',
              v_trade->>'sellPrice',
              v_trade->>'SellPrice',
              '0'
            ),
            ',', ''), '$', ''), '₹', ''), '(', '-'
          );
          v_exit_price := REPLACE(v_exit_price, ')', '')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          v_exit_price := 0;
        END;
      END;
      
      -- Parse PnL with extensive cleanup
      BEGIN
        v_pnl := NULLIF(TRIM(REPLACE(REPLACE(REPLACE(
          COALESCE(
            v_trade->>'pnl', 
            v_trade->>'PnL',
            v_trade->>'P&L',
            v_trade->>'profit',
            v_trade->>'Profit',
            '0'
          ), 
          ',', ''), '$', ''), '₹', '')
        ), '')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          -- Try parsing with additional cleanup for parentheses (negative numbers)
          v_pnl := REPLACE(REPLACE(REPLACE(REPLACE(
            COALESCE(
              v_trade->>'pnl', 
              v_trade->>'PnL',
              v_trade->>'P&L',
              v_trade->>'profit',
              v_trade->>'Profit',
              '0'
            ),
            ',', ''), '$', ''), '₹', ''), '(', '-'
          );
          v_pnl := REPLACE(v_pnl, ')', '')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
          -- Calculate from prices if parsing fails
          v_pnl := (v_exit_price - v_entry_price) * v_quantity;
        END;
      END;
      
      -- Parse entry date with support for multiple formats
      BEGIN
        -- Try standard formats first
        v_entry_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'entry_date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'entryDate'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'Entry Date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'boughtTimestamp'), ''))::TIMESTAMP
        );
        
        -- If still NULL, try additional formats
        IF v_entry_date IS NULL THEN
          -- Try MM/DD/YYYY format
          IF v_trade->>'entry_date' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
            IF LENGTH(v_trade->>'entry_date') > 10 THEN
              v_entry_date := TO_TIMESTAMP(v_trade->>'entry_date', 'MM/DD/YYYY HH24:MI:SS');
            ELSE
              v_entry_date := TO_TIMESTAMP(v_trade->>'entry_date', 'MM/DD/YYYY');
            END IF;
          -- Try YYYY-MM-DD format
          ELSIF v_trade->>'entry_date' ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_entry_date := (v_trade->>'entry_date')::TIMESTAMP;
          ELSE
            v_entry_date := NOW();
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_entry_date := NOW();
      END;
      
      -- Parse exit date with support for multiple formats
      BEGIN
        -- Try standard formats first
        v_exit_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'exit_date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'exitDate'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'Exit Date'), ''))::TIMESTAMP,
          (NULLIF(TRIM(v_trade->>'soldTimestamp'), ''))::TIMESTAMP
        );
        
        -- If still NULL, try additional formats
        IF v_exit_date IS NULL THEN
          -- Try MM/DD/YYYY format
          IF v_trade->>'exit_date' ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
            IF LENGTH(v_trade->>'exit_date') > 10 THEN
              v_exit_date := TO_TIMESTAMP(v_trade->>'exit_date', 'MM/DD/YYYY HH24:MI:SS');
            ELSE
              v_exit_date := TO_TIMESTAMP(v_trade->>'exit_date', 'MM/DD/YYYY');
            END IF;
          -- Try YYYY-MM-DD format
          ELSIF v_trade->>'exit_date' ~ '^\d{4}-\d{2}-\d{2}' THEN
            v_exit_date := (v_trade->>'exit_date')::TIMESTAMP;
          ELSE
            v_exit_date := NOW();
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_exit_date := NOW();
      END;
      
      -- Set date field (trade date)
      BEGIN
        v_date := COALESCE(
          (NULLIF(TRIM(v_trade->>'date'), ''))::DATE,
          (NULLIF(TRIM(v_trade->>'Date'), ''))::DATE,
          v_entry_date::DATE
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := v_entry_date::DATE;
      END;
      
      -- Insert the trade with matching column names based on schema
      INSERT INTO trades (
        user_id,
        account_id,
        symbol,              -- Mapped from contract/symbol
        side,                -- Direction of trade
        position,            -- Same as side for compatibility
        quantity,            -- Number of contracts
        size,                -- Same as quantity
        price,               -- Using entry_price for compatibility
        entry_price,         -- Buy/entry price
        exit_price,          -- Sell/exit price
        pnl,                 -- Profit/loss
        fees,                -- Commission/fees
        entry_date,          -- When trade was entered
        exit_date,           -- When trade was exited
        date,                -- Trade date (date part of entry)
        timestamp,           -- Using entry_date for timestamp
        broker,              -- Set to Tradovate
        source,              -- Source platform
        created_at,
        updated_at,
        notes,               -- Optional notes
        buyFillId,           -- Tradovate-specific fields
        sellFillId,
        buyPrice,            -- Same as entry_price
        sellPrice,           -- Same as exit_price
        boughtTimestamp,     -- Same as entry_date
        soldTimestamp        -- Same as exit_date
      ) VALUES (
        p_user_id,
        v_account_id,
        v_symbol,
        v_side,
        v_side,                              -- Match position to side
        v_quantity,                          
        v_quantity,                          -- Size = quantity
        v_entry_price,                       -- Price = entry_price
        v_entry_price,
        v_exit_price,
        v_pnl,
        COALESCE(                           -- Get fees if available
          (NULLIF(TRIM(REPLACE(REPLACE(v_trade->>'fees', '$', ''), ',', '')), ''))::NUMERIC, 
          0
        ),
        v_entry_date,
        v_exit_date,
        v_date,
        v_entry_date,                       -- Use entry date as timestamp
        'Tradovate',
        'tradovate',
        NOW(),
        NOW(),
        'Imported from Tradovate CSV',
        COALESCE(v_trade->>'buyFillId', NULL),
        COALESCE(v_trade->>'sellFillId', NULL),
        v_entry_price,                      -- buyPrice = entry_price
        v_exit_price,                       -- sellPrice = exit_price
        v_entry_date,                       -- boughtTimestamp = entry_date
        v_exit_date                         -- soldTimestamp = exit_date
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
  
  -- Try to update analytics manually without using ON CONFLICT
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
    'processed', v_success_count,
    'errors', v_error_count,
    'user_id', p_user_id,
    'account_id', v_account_id,
    'results', v_results,
    'detailed_errors', CASE WHEN v_error_count > 0 THEN v_detailed_errors ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, JSONB, UUID) TO authenticated; 