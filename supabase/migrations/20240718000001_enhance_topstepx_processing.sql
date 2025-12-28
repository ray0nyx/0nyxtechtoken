-- Add unique constraint to analytics table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'analytics_user_id_key'
  ) THEN
    ALTER TABLE analytics ADD CONSTRAINT analytics_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Create or replace the function to process TopstepX CSV data
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch(trades_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB := '{}'::JSONB;
    v_row JSONB;
    v_trade_id UUID;
    v_count INTEGER := 0;
    v_error TEXT;
    v_user_id UUID;
    v_account_id UUID;
    v_analytics_result JSONB;
BEGIN
    -- Get user_id and account_id from the first row
    SELECT 
        (trades_json->0->>'user_id')::UUID,
        (trades_json->0->>'account_id')::UUID
    INTO v_user_id, v_account_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Missing user_id in JSON data',
            'processed', 0
        );
    END IF;
    
    -- Process each row in the array
    FOR v_row IN SELECT * FROM jsonb_array_elements(trades_json)
    LOOP
        BEGIN
            -- Insert the trade
            INSERT INTO trades (
                id,
                user_id,
                symbol,
                position,
                entry_date,
                exit_date,
                entry_price,
                exit_price,
                quantity,
                fees,
                commission,
                pnl,
                date,
                account_id,
                broker,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_user_id,
                v_row->>'contract_name',
                LOWER(v_row->>'type'),
                (v_row->>'entered_at')::TIMESTAMP,
                (v_row->>'exited_at')::TIMESTAMP,
                (v_row->>'entry_price')::NUMERIC,
                (v_row->>'exit_price')::NUMERIC,
                (v_row->>'size')::INTEGER,
                (v_row->>'fees')::NUMERIC,
                (v_row->>'fees')::NUMERIC,
                (v_row->>'pnl')::NUMERIC,
                (v_row->>'trade_day')::TIMESTAMP::DATE,
                v_account_id,
                'TopstepX',
                NOW(),
                NOW()
            )
            RETURNING id INTO v_trade_id;
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing row: %', SQLERRM;
        END;
    END LOOP;
    
    -- Update analytics after processing trades
    IF v_count > 0 THEN
        v_analytics_result := update_analytics_after_trades(v_user_id);
    END IF;
    
    -- Return the result
    RETURN jsonb_build_object(
        'success', true,
        'processed', v_count,
        'analytics', v_analytics_result
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch(JSONB) TO authenticated;

-- Create or replace the function to update analytics after processing trades
CREATE OR REPLACE FUNCTION update_analytics_after_trades(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_trades INTEGER;
    v_winning_trades INTEGER;
    v_losing_trades INTEGER;
    v_total_pnl NUMERIC;
    v_win_rate NUMERIC;
    v_avg_win NUMERIC;
    v_avg_loss NUMERIC;
    v_win_loss_ratio NUMERIC;
    v_analytics_id UUID;
    v_performance_id UUID;
BEGIN
    -- Count total trades
    SELECT COUNT(*) INTO v_total_trades
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Count winning trades
    SELECT COUNT(*) INTO v_winning_trades
    FROM trades
    WHERE user_id = p_user_id AND pnl > 0;
    
    -- Count losing trades
    SELECT COUNT(*) INTO v_losing_trades
    FROM trades
    WHERE user_id = p_user_id AND pnl < 0;
    
    -- Calculate total PnL
    SELECT COALESCE(SUM(pnl), 0) INTO v_total_pnl
    FROM trades
    WHERE user_id = p_user_id;
    
    -- Calculate win rate
    IF v_total_trades > 0 THEN
        v_win_rate := (v_winning_trades::NUMERIC / v_total_trades::NUMERIC) * 100;
    ELSE
        v_win_rate := 0;
    END IF;
    
    -- Calculate average win
    SELECT COALESCE(AVG(pnl), 0) INTO v_avg_win
    FROM trades
    WHERE user_id = p_user_id AND pnl > 0;
    
    -- Calculate average loss
    SELECT COALESCE(AVG(pnl), 0) INTO v_avg_loss
    FROM trades
    WHERE user_id = p_user_id AND pnl < 0;
    
    -- Calculate win/loss ratio
    IF v_avg_loss <> 0 THEN
        v_win_loss_ratio := ABS(v_avg_win / v_avg_loss);
    ELSE
        v_win_loss_ratio := 0;
    END IF;
    
    -- Update analytics table
    INSERT INTO analytics (
        id,
        user_id,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        total_pnl,
        avg_win,
        avg_loss,
        win_loss_ratio,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        v_total_trades,
        v_winning_trades,
        v_losing_trades,
        v_win_rate,
        v_total_pnl,
        v_avg_win,
        v_avg_loss,
        v_win_loss_ratio,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_trades = EXCLUDED.total_trades,
        winning_trades = EXCLUDED.winning_trades,
        losing_trades = EXCLUDED.losing_trades,
        win_rate = EXCLUDED.win_rate,
        total_pnl = EXCLUDED.total_pnl,
        avg_win = EXCLUDED.avg_win,
        avg_loss = EXCLUDED.avg_loss,
        win_loss_ratio = EXCLUDED.win_loss_ratio,
        updated_at = NOW()
    RETURNING id INTO v_analytics_id;
    
    -- Update performance table
    INSERT INTO performance_table (
        id,
        user_id,
        total_trades,
        total_pnl,
        winning_trades,
        losing_trades,
        win_rate,
        avg_win,
        avg_loss,
        profit_factor,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        v_total_trades,
        v_total_pnl,
        v_winning_trades,
        v_losing_trades,
        v_win_rate,
        v_avg_win,
        v_avg_loss,
        v_win_loss_ratio,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_trades = EXCLUDED.total_trades,
        total_pnl = EXCLUDED.total_pnl,
        winning_trades = EXCLUDED.winning_trades,
        losing_trades = EXCLUDED.losing_trades,
        win_rate = EXCLUDED.win_rate,
        avg_win = EXCLUDED.avg_win,
        avg_loss = EXCLUDED.avg_loss,
        profit_factor = EXCLUDED.profit_factor,
        updated_at = NOW()
    RETURNING id INTO v_performance_id;
    
    -- Return the result
    RETURN jsonb_build_object(
        'success', true,
        'analytics_id', v_analytics_id,
        'performance_id', v_performance_id
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_analytics_after_trades(UUID) TO authenticated;
