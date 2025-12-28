-- Check if migration has already been applied
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM migration_log WHERE migration_name = '20240715000022_process_trades_and_analytics'
  ) THEN
    -- Log migration
    INSERT INTO migration_log (migration_name) 
    VALUES ('20240715000022_process_trades_and_analytics');

    -- Create a function to process pending trades from trades_staging to trades
    CREATE OR REPLACE FUNCTION process_pending_trades()
    RETURNS INTEGER AS $$
    DECLARE
        v_count INTEGER := 0;
        v_record RECORD;
    BEGIN
        -- Process each pending trade
        FOR v_record IN 
            SELECT * FROM trades_staging 
            WHERE import_status = 'pending'
        LOOP
            -- If the symbol is empty but the buyfillid and sellfillid exist, 
            -- set the symbol to a default value
            IF v_record.symbol IS NULL OR v_record.symbol = '' THEN
                v_record.symbol := 'UNKNOWN';
            END IF;

            -- Calculate PNL if not set
            IF v_record.pnl IS NULL THEN
                IF v_record.position = 'long' THEN
                    v_record.pnl := (v_record.exit_price - v_record.entry_price) * v_record.quantity;
                ELSE
                    v_record.pnl := (v_record.entry_price - v_record.exit_price) * v_record.quantity;
                END IF;
            END IF;

            -- Generate the date from entry_date if not set
            IF v_record.date IS NULL THEN
                v_record.date := COALESCE(v_record.entry_date::DATE, CURRENT_DATE);
            END IF;

            -- Insert into the trades table
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
                notes,
                buyFillId,
                sellFillId,
                date
            ) VALUES (
                v_record.user_id,
                v_record.symbol,
                v_record.position,
                v_record.entry_date,
                v_record.exit_date,
                v_record.entry_price,
                v_record.exit_price,
                v_record.quantity,
                v_record.pnl,
                COALESCE(v_record.broker, 'Tradovate'),
                v_record.notes,
                v_record.buyfillid,
                v_record.sellfillid,
                v_record.date
            );

            -- Update status in staging table
            UPDATE trades_staging 
            SET 
                import_status = 'processed',
                processed_at = NOW()
            WHERE id = v_record.id;

            v_count := v_count + 1;
        END LOOP;

        RETURN v_count;
    END;
    $$ LANGUAGE plpgsql;

    -- Create enhanced analytics function
    CREATE OR REPLACE FUNCTION get_enhanced_analytics_for_user(p_user_id UUID)
    RETURNS JSONB AS $$
    DECLARE
        v_result JSONB;
        v_analytics RECORD;
        v_daily_pnl JSONB;
        v_weekly_pnl JSONB;
        v_monthly_pnl JSONB;
    BEGIN
        -- Try to get analytics from the analytics table first
        SELECT * INTO v_analytics
        FROM analytics
        WHERE user_id = p_user_id
        LIMIT 1;

        -- If analytics exists, use it
        IF FOUND THEN
            -- Format the analytics data
            v_result := jsonb_build_object(
                'totalTrades', COALESCE(v_analytics.total_trades, 0),
                'winRate', COALESCE(v_analytics.win_rate, 0),
                'totalPnl', COALESCE(v_analytics.total_pnl, 0),
                'averagePnl', COALESCE(v_analytics.average_pnl, 0),
                'winningTrades', COALESCE(v_analytics.wins, 0),
                'losingTrades', COALESCE(v_analytics.losses, 0),
                'largestWin', COALESCE(v_analytics.largest_win, 0),
                'largestLoss', COALESCE(v_analytics.largest_loss, 0),
                'dailyPnl', COALESCE(v_analytics.daily_pnl, '{}'::JSONB),
                'weeklyPnl', COALESCE(v_analytics.weekly_pnl, '{}'::JSONB),
                'monthlyPnl', COALESCE(v_analytics.monthly_pnl, '{}'::JSONB),
                'cumulativePnl', COALESCE(v_analytics.cumulative_pnl, 0)
            );
        ELSE
            -- If no analytics, calculate from trades
            SELECT
                COUNT(*) as total_trades,
                COALESCE(SUM(pnl), 0) as total_pnl,
                COALESCE(COUNT(*) FILTER (WHERE pnl > 0), 0) as wins,
                COALESCE(COUNT(*) FILTER (WHERE pnl < 0), 0) as losses,
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        ROUND((COUNT(*) FILTER (WHERE pnl > 0)::DECIMAL / COUNT(*)) * 100, 2)
                    ELSE 0 
                END as win_rate,
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        ROUND(SUM(pnl) / COUNT(*), 2)
                    ELSE 0 
                END as average_pnl,
                COALESCE(MAX(pnl) FILTER (WHERE pnl > 0), 0) as largest_win,
                COALESCE(MIN(pnl) FILTER (WHERE pnl < 0), 0) as largest_loss
            INTO v_analytics
            FROM trades
            WHERE user_id = p_user_id;

            -- Calculate daily PNL
            SELECT jsonb_object_agg(
                date::TEXT, 
                ROUND(SUM(pnl)::NUMERIC, 2)
            )
            INTO v_daily_pnl
            FROM trades
            WHERE user_id = p_user_id
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date;

            -- Calculate weekly PNL
            SELECT jsonb_object_agg(
                TO_CHAR(date_trunc('week', date), 'YYYY-MM-DD'),
                ROUND(SUM(pnl)::NUMERIC, 2)
            )
            INTO v_weekly_pnl
            FROM trades
            WHERE user_id = p_user_id
            AND date >= CURRENT_DATE - INTERVAL '12 weeks'
            GROUP BY date_trunc('week', date);

            -- Calculate monthly PNL
            SELECT jsonb_object_agg(
                TO_CHAR(date_trunc('month', date), 'YYYY-MM'),
                ROUND(SUM(pnl)::NUMERIC, 2)
            )
            INTO v_monthly_pnl
            FROM trades
            WHERE user_id = p_user_id
            AND date >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY date_trunc('month', date);

            -- Format the analytics data
            v_result := jsonb_build_object(
                'totalTrades', COALESCE(v_analytics.total_trades, 0),
                'winRate', COALESCE(v_analytics.win_rate, 0),
                'totalPnl', COALESCE(v_analytics.total_pnl, 0),
                'averagePnl', COALESCE(v_analytics.average_pnl, 0),
                'winningTrades', COALESCE(v_analytics.wins, 0),
                'losingTrades', COALESCE(v_analytics.losses, 0),
                'largestWin', COALESCE(v_analytics.largest_win, 0),
                'largestLoss', COALESCE(v_analytics.largest_loss, 0),
                'dailyPnl', COALESCE(v_daily_pnl, '{}'::JSONB),
                'weeklyPnl', COALESCE(v_weekly_pnl, '{}'::JSONB),
                'monthlyPnl', COALESCE(v_monthly_pnl, '{}'::JSONB),
                'cumulativePnl', COALESCE(v_analytics.total_pnl, 0)
            );
        END IF;

        RETURN v_result;
    END;
    $$ LANGUAGE plpgsql;

    -- Process all pending trades
    SELECT process_pending_trades();

    -- Recalculate analytics for all users
    SELECT recalculate_all_analytics();

    -- Grant permissions
    GRANT ALL ON SCHEMA public TO authenticated;
    GRANT EXECUTE ON FUNCTION process_pending_trades() TO authenticated;
    GRANT EXECUTE ON FUNCTION get_enhanced_analytics_for_user(UUID) TO authenticated;

    RAISE NOTICE 'Migration 20240715000022_process_trades_and_analytics has been applied';
  END IF;
END $$; 