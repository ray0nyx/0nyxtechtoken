-- Migration to handle missing date fields in CSV imports
-- This ensures that trades with missing date fields are still processed correctly

-- Create a function to derive missing date values from other fields
CREATE OR REPLACE FUNCTION derive_missing_date(
  p_row JSONB,
  p_fallback_date DATE DEFAULT CURRENT_DATE
) RETURNS DATE AS $$
DECLARE
  v_date DATE;
  v_timestamp TIMESTAMP;
BEGIN
  -- Try to extract date from various date fields
  BEGIN
    v_date := COALESCE(
      (p_row->>'date')::DATE,
      (p_row->>'Date')::DATE,
      (p_row->>'tradeDate')::DATE,
      (p_row->>'TradeDate')::DATE,
      (p_row->>'trade_date')::DATE,
      (p_row->>'Day')::DATE,
      (p_row->>'day')::DATE,
      (p_row->>'fillDate')::DATE,
      (p_row->>'FillDate')::DATE
    );
    
    -- Return immediately if we found a valid date
    IF v_date IS NOT NULL THEN
      RETURN v_date;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore date parsing errors and continue
    NULL;
  END;
  
  -- If we don't have a date, try to extract it from timestamp fields
  BEGIN
    v_timestamp := COALESCE(
      (p_row->>'boughtTimestamp')::TIMESTAMP,
      (p_row->>'soldTimestamp')::TIMESTAMP,
      (p_row->>'BoughtTimestamp')::TIMESTAMP,
      (p_row->>'SoldTimestamp')::TIMESTAMP,
      (p_row->>'bought_timestamp')::TIMESTAMP,
      (p_row->>'sold_timestamp')::TIMESTAMP,
      (p_row->>'timestamp')::TIMESTAMP,
      (p_row->>'Timestamp')::TIMESTAMP,
      (p_row->>'fill_time')::TIMESTAMP,
      (p_row->>'Fill Time')::TIMESTAMP,
      (p_row->>'fillTime')::TIMESTAMP,
      (p_row->>'FillTime')::TIMESTAMP
    );
    
    -- If we found a timestamp, convert it to date
    IF v_timestamp IS NOT NULL THEN
      RETURN v_timestamp::DATE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore timestamp parsing errors and continue
    NULL;
  END;
  
  -- If all else fails, use the fallback date
  RETURN p_fallback_date;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure a date is present in Tradovate CSV rows
CREATE OR REPLACE FUNCTION ensure_date_in_row(
  p_row JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB := p_row;
  v_date DATE;
BEGIN
  -- Check if we already have a date field in any format
  IF (p_row->>'date') IS NOT NULL OR 
     (p_row->>'Date') IS NOT NULL OR
     (p_row->>'tradeDate') IS NOT NULL OR
     (p_row->>'TradeDate') IS NOT NULL THEN
    -- Date already exists, return unchanged
    RETURN p_row;
  END IF;
  
  -- Derive a date from other fields or use current date as fallback
  v_date := derive_missing_date(p_row);
  
  -- Add the date field to the JSON
  v_result := jsonb_set(v_result, '{date}', to_jsonb(v_date::TEXT));
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Modify process_tradovate_csv_row to always ensure date is present
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
  p_user_id UUID,
  p_row JSONB,
  p_account_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_symbol TEXT;
  v_date DATE;
  v_qty INTEGER;
  v_entry_price NUMERIC := 0;
  v_exit_price NUMERIC := 0;
  v_fees NUMERIC := 0;
  v_pnl NUMERIC := 0;
  v_buy_fill_id TEXT;
  v_sell_fill_id TEXT;
  v_bought_timestamp TIMESTAMP;
  v_sold_timestamp TIMESTAMP;
  v_duration TEXT;
  v_metrics_exist BOOLEAN;
  v_trade_id UUID;
  v_metadata JSONB;
  v_processed_row JSONB;
BEGIN
  -- First ensure date exists in the row
  v_processed_row := ensure_date_in_row(p_row);
  
  -- Check if metrics exist before we start
  SELECT EXISTS(
      SELECT 1 
      FROM analytics 
      WHERE user_id = p_user_id
  ) INTO v_metrics_exist;
  
  IF NOT v_metrics_exist THEN
      -- Try to initialize metrics
      PERFORM calculate_user_analytics(p_user_id);
      
      -- Check again
      SELECT EXISTS(
          SELECT 1 
          FROM analytics 
          WHERE user_id = p_user_id
      ) INTO v_metrics_exist;
      
      IF NOT v_metrics_exist THEN
          RAISE WARNING 'No metrics found for user %, but continuing anyway', p_user_id;
      END IF;
  END IF;

  -- Extract trade data from the row with safer parsing
  v_symbol := COALESCE(
      v_processed_row->>'symbol', 
      v_processed_row->>'Symbol', 
      v_processed_row->>'SYMBOL', 
      v_processed_row->>'contract', 
      v_processed_row->>'Contract',
      v_processed_row->>'product',
      v_processed_row->>'Product'
  );
  
  -- Validate the symbol field is present
  IF v_symbol IS NULL THEN
      RAISE EXCEPTION 'Missing symbol/contract/product in trade data: %', v_processed_row;
  END IF;
  
  -- Now the date should always be available due to ensure_date_in_row
  BEGIN
      v_date := (v_processed_row->>'date')::DATE;
      IF v_date IS NULL THEN
          v_date := CURRENT_DATE;
      END IF;
  EXCEPTION WHEN OTHERS THEN
      -- Fall back to current date if parsing fails
      v_date := CURRENT_DATE;
  END;
  
  -- Parse quantity safely
  BEGIN
      v_qty := COALESCE(
          (v_processed_row->>'qty')::INTEGER,
          (v_processed_row->>'Qty')::INTEGER,
          (v_processed_row->>'quantity')::INTEGER,
          (v_processed_row->>'Quantity')::INTEGER,
          (v_processed_row->>'filledQty')::INTEGER,
          (v_processed_row->>'FilledQty')::INTEGER,
          1  -- Default to 1 if not found
      );
  EXCEPTION WHEN OTHERS THEN
      v_qty := 1; -- Default to 1 if parsing fails
  END;
  
  -- Use safe numeric parsing for monetary values
  v_entry_price := COALESCE(
      safe_numeric_from_jsonb(v_processed_row, 'entry_price'),
      safe_numeric_from_jsonb(v_processed_row, 'entryPrice'),
      safe_numeric_from_jsonb(v_processed_row, 'buyPrice'),
      safe_numeric_from_jsonb(v_processed_row, 'avgPrice'),
      0
  );
  
  v_exit_price := COALESCE(
      safe_numeric_from_jsonb(v_processed_row, 'exit_price'),
      safe_numeric_from_jsonb(v_processed_row, 'exitPrice'),
      safe_numeric_from_jsonb(v_processed_row, 'sellPrice'),
      0
  );
  
  v_fees := COALESCE(
      safe_numeric_from_jsonb(v_processed_row, 'fees'),
      safe_numeric_from_jsonb(v_processed_row, 'commission'),
      safe_numeric_from_jsonb(v_processed_row, 'commissions'),
      0
  );
  
  v_pnl := COALESCE(
      safe_numeric_from_jsonb(v_processed_row, 'pnl'),
      safe_numeric_from_jsonb(v_processed_row, 'profit'),
      safe_numeric_from_jsonb(v_processed_row, 'profit_loss'),
      0
  );
  
  v_buy_fill_id := v_processed_row->>'buyFillId';
  v_sell_fill_id := v_processed_row->>'sellFillId';
  
  -- Handle timestamp fields safely
  BEGIN
      v_bought_timestamp := (v_processed_row->>'boughtTimestamp')::TIMESTAMP;
  EXCEPTION WHEN OTHERS THEN
      v_bought_timestamp := NULL;
  END;
  
  BEGIN
      v_sold_timestamp := (v_processed_row->>'soldTimestamp')::TIMESTAMP;
  EXCEPTION WHEN OTHERS THEN
      v_sold_timestamp := NULL;
  END;
  
  v_duration := v_processed_row->>'duration';
  
  -- Store everything else in the metadata column
  v_metadata := v_processed_row;
  
  -- Insert trade into the trades table with robust error handling
  BEGIN
      INSERT INTO trades (
          user_id,
          account_id,
          symbol,
          date,
          broker,
          direction,
          quantity,
          entry_price,
          exit_price,
          pnl,
          fees,
          buy_fill_id,
          sell_fill_id,
          entry_date,
          exit_date,
          duration,
          metadata,
          created_at,
          updated_at
      ) VALUES (
          p_user_id,
          p_account_id,
          v_symbol,
          v_date,
          'Tradovate',
          CASE WHEN v_qty > 0 THEN 'long' ELSE 'short' END,
          ABS(v_qty),
          v_entry_price,
          v_exit_price,
          v_pnl,
          v_fees,
          v_buy_fill_id,
          v_sell_fill_id,
          v_bought_timestamp,
          v_sold_timestamp,
          v_duration,
          v_metadata,
          NOW(),
          NOW()
      )
      RETURNING id INTO v_trade_id;
  EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error inserting trade: %', SQLERRM;
  END;
  
  -- Return success with the trade ID
  RETURN jsonb_build_object(
      'success', TRUE,
      'trade_id', v_trade_id
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error info
  RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'trade_data', p_row
  );
END;
$$ LANGUAGE plpgsql;
