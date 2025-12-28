-- SQL functions for Tradovate CSV processing

-- Function to clean dollar signs from numeric values
CREATE OR REPLACE FUNCTION clean_dollar_sign(value TEXT)
RETURNS NUMERIC AS $$
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove dollar signs, commas, and other non-numeric characters except decimal points and negative signs
  RETURN NULLIF(REGEXP_REPLACE(value, '[^0-9.-]', '', 'g'), '')::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to handle missing Fill Time in Tradovate CSV rows
CREATE OR REPLACE FUNCTION handle_tradovate_missing_fill_time(p_row JSONB)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_fill_time TEXT;
BEGIN
  v_result := p_row;
  
  -- Get fill time from various possible fields
  v_fill_time := p_row->>'Fill Time';
  
  -- If Fill Time is missing, try alternative fields
  IF v_fill_time IS NULL OR v_fill_time = '' THEN
    v_fill_time := p_row->>'boughtTimestamp';
  END IF;
  
  IF v_fill_time IS NULL OR v_fill_time = '' THEN
    v_fill_time := p_row->>'soldTimestamp';
  END IF;
  
  -- If still no fill time but we have other identifying information, generate a default timestamp
  IF (v_fill_time IS NULL OR v_fill_time = '') AND (
    p_row->>'buyFillId' IS NOT NULL OR 
    p_row->>'sellFillId' IS NOT NULL OR 
    p_row->>'id' IS NOT NULL OR 
    p_row->>'symbol' IS NOT NULL OR 
    p_row->>'Contract' IS NOT NULL OR 
    p_row->>'Product' IS NOT NULL
  ) THEN
    v_fill_time := NOW()::TEXT;
    v_result := jsonb_set(v_result, '{Fill Time}', to_jsonb(v_fill_time));
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to process a single Tradovate CSV row
CREATE OR REPLACE FUNCTION process_tradovate_csv_row(
  p_user_id UUID,
  p_symbol TEXT,
  p_created_at TIMESTAMP DEFAULT NULL,
  p_updated_at TIMESTAMP DEFAULT NULL,
  p_pnl NUMERIC DEFAULT NULL,
  p_price_format TEXT DEFAULT NULL,
  p_tick_size NUMERIC DEFAULT NULL,
  p_buy_fill_id TEXT DEFAULT NULL,
  p_sell_fill_id TEXT DEFAULT NULL,
  p_buy_price NUMERIC DEFAULT NULL,
  p_sell_price NUMERIC DEFAULT NULL,
  p_bought_timestamp TIMESTAMP DEFAULT NULL,
  p_sold_timestamp TIMESTAMP DEFAULT NULL,
  p_duration INTERVAL DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_position TEXT;
  v_entry_date TIMESTAMP;
  v_exit_date TIMESTAMP;
  v_entry_price NUMERIC;
  v_exit_price NUMERIC;
  v_quantity INTEGER DEFAULT 1;
  v_date DATE;
BEGIN
  -- Determine position (long or short) based on buy/sell prices and timestamps
  IF p_bought_timestamp IS NOT NULL AND p_bought_timestamp < p_sold_timestamp THEN
    v_position := 'long';
    v_entry_date := p_bought_timestamp;
    v_exit_date := p_sold_timestamp;
    v_entry_price := p_buy_price;
    v_exit_price := p_sell_price;
  ELSE
    v_position := 'short';
    v_entry_date := p_sold_timestamp;
    v_exit_date := p_bought_timestamp;
    v_entry_price := p_sell_price;
    v_exit_price := p_buy_price;
  END IF;
  
  -- Set date to the entry date (just the date part)
  v_date := DATE(v_entry_date);
  
  -- Insert the trade into the trades table
  INSERT INTO trades (
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
    date,
    "buyFillId",
    "sellFillId",
    "buyPrice",
    "sellPrice",
    "boughtTimestamp",
    "soldTimestamp",
    duration,
    "_priceFormat",
    "_tickSize",
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_symbol,
    v_position,
    v_entry_date,
    v_exit_date,
    v_entry_price,
    v_exit_price,
    v_quantity,
    p_pnl,
    'Tradovate',
    v_date,
    p_buy_fill_id,
    p_sell_fill_id,
    p_buy_price,
    p_sell_price,
    p_bought_timestamp,
    p_sold_timestamp,
    p_duration,
    p_price_format,
    p_tick_size,
    COALESCE(p_created_at, NOW()),
    COALESCE(p_updated_at, NOW())
  ) RETURNING id INTO v_trade_id;
  
  -- Update analytics for this user
  PERFORM populate_analytics_table(p_user_id);
  
  RETURN v_trade_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE 'Error processing Tradovate CSV row: %', SQLERRM;
    -- Return NULL to indicate failure
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to process a batch of Tradovate CSV rows
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
  p_user_id UUID,
  p_data JSONB
)
RETURNS TABLE(
  trade_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_row JSONB;
  v_trade_id UUID;
  v_error TEXT;
BEGIN
  -- Process each row in the batch
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data) LOOP
    BEGIN
      -- Handle missing Fill Time
      v_row := handle_tradovate_missing_fill_time(v_row);
      
      -- Process the row and get the trade ID
      v_trade_id := process_tradovate_csv_row(
        p_user_id,
        v_row->>'symbol',
        (v_row->>'created_at')::TIMESTAMP,
        (v_row->>'updated_at')::TIMESTAMP,
        clean_dollar_sign(v_row->>'pnl'),
        v_row->>'_priceFormat',
        clean_dollar_sign(v_row->>'_tickSize'),
        v_row->>'buyFillId',
        v_row->>'sellFillId',
        clean_dollar_sign(v_row->>'buyPrice'),
        clean_dollar_sign(v_row->>'sellPrice'),
        (v_row->>'boughtTimestamp')::TIMESTAMP,
        (v_row->>'soldTimestamp')::TIMESTAMP,
        (v_row->>'duration')::INTERVAL
      );
      
      -- Return success
      trade_id := v_trade_id;
      success := v_trade_id IS NOT NULL;
      error_message := NULL;
      RETURN NEXT;
    EXCEPTION
      WHEN OTHERS THEN
        -- Return failure with error message
        trade_id := NULL;
        success := FALSE;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to populate analytics table with Tradovate data
CREATE OR REPLACE FUNCTION populate_tradovate_analytics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Clear existing analytics for this user
    DELETE FROM analytics_table WHERE analytics_table.user_id = p_user_id;
    
    -- Insert overall metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        total_trades, 
        total_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'overall_metrics' AS metric_name,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate';
    
    -- Insert monthly metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'monthly_metrics' AS metric_name,
        DATE_TRUNC('month', trades.date)::date AS date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate'
    GROUP BY 
        DATE_TRUNC('month', trades.date);
        
    -- Insert daily metrics
    INSERT INTO analytics_table (
        user_id, 
        metric_name, 
        date,
        total_trades, 
        total_pnl,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        'daily_metrics' AS metric_name,
        trades.date,
        COUNT(*) AS total_trades,
        SUM(trades.pnl) AS total_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate'
    GROUP BY 
        trades.date;
END;
$$ LANGUAGE plpgsql;

-- Function to get detailed analytics for Tradovate trades
CREATE OR REPLACE FUNCTION get_tradovate_detailed_analytics(p_user_id UUID)
RETURNS TABLE(
  total_trades BIGINT,
  win_rate NUMERIC,
  total_pnl NUMERIC,
  average_pnl NUMERIC,
  winning_trades BIGINT,
  losing_trades BIGINT,
  largest_win NUMERIC,
  largest_loss NUMERIC,
  avg_duration INTERVAL,
  profit_factor NUMERIC,
  expectancy NUMERIC,
  avg_win NUMERIC,
  avg_loss NUMERIC,
  win_loss_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH trade_stats AS (
    SELECT
      COUNT(*) as total_trades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(pnl) as total_pnl,
      AVG(pnl) as average_pnl,
      COALESCE(MAX(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) as largest_win,
      COALESCE(MIN(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) as largest_loss,
      AVG(duration) as avg_duration,
      SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
      ABS(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)) as gross_loss,
      AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
      AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss
    FROM
      trades
    WHERE
      user_id = p_user_id
      AND broker = 'Tradovate'
  )
  SELECT
    total_trades,
    CASE WHEN total_trades > 0 THEN (winning_trades::NUMERIC / NULLIF(total_trades, 0)) * 100 ELSE 0 END as win_rate,
    total_pnl,
    average_pnl,
    winning_trades,
    losing_trades,
    largest_win,
    largest_loss,
    avg_duration,
    CASE WHEN gross_loss = 0 THEN NULL ELSE gross_profit / NULLIF(gross_loss, 0) END as profit_factor,
    CASE 
      WHEN total_trades > 0 THEN 
        ((avg_win * winning_trades) + (avg_loss * losing_trades)) / NULLIF(total_trades, 0)
      ELSE 0 
    END as expectancy,
    avg_win,
    avg_loss,
    CASE WHEN avg_loss = 0 THEN NULL ELSE ABS(avg_win / NULLIF(avg_loss, 0)) END as win_loss_ratio
  FROM
    trade_stats;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update analytics when trades are changed
CREATE OR REPLACE FUNCTION update_tradovate_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the populate_tradovate_analytics function for the user
    PERFORM populate_tradovate_analytics(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS tradovate_analytics_update ON trades;
CREATE TRIGGER tradovate_analytics_update
AFTER INSERT OR UPDATE OR DELETE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_tradovate_analytics_on_trade_change();
