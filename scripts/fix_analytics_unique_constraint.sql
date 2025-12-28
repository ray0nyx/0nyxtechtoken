-- Fix for the "duplicate key value violates unique constraint analytics_user_id_metric_name_unique" error
-- This occurs when analytics records are attempted to be inserted multiple times for the same user and metric

-- PART 1: Cleanup existing duplicates in the analytics table
DO $$
DECLARE
    v_count INTEGER;
    v_duplicates_removed INTEGER := 0;
    v_rec RECORD;
BEGIN
    -- Create temporary table to track duplicate analytics entries
    CREATE TEMP TABLE duplicate_analytics AS
    SELECT 
        MIN(id) AS keep_id,
        user_id,
        metric_name,
        COUNT(*) AS entry_count,
        ARRAY_AGG(id) AS all_ids
    FROM analytics
    GROUP BY user_id, metric_name
    HAVING COUNT(*) > 1;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Found % duplicate groups in the analytics table', v_count;
        
        -- For each duplicate group, keep the newest one and delete the rest
        FOR v_rec IN SELECT * FROM duplicate_analytics LOOP
            -- Find the newest record
            DELETE FROM analytics
            WHERE 
                user_id = v_rec.user_id AND 
                metric_name = v_rec.metric_name AND
                id != (
                    SELECT id FROM analytics
                    WHERE user_id = v_rec.user_id AND metric_name = v_rec.metric_name
                    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                    LIMIT 1
                );
            
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_duplicates_removed := v_duplicates_removed + v_count;
        END LOOP;
        
        RAISE NOTICE 'Removed % duplicate analytics records', v_duplicates_removed;
    ELSE
        RAISE NOTICE 'No duplicates found in analytics table';
    END IF;
    
    DROP TABLE IF EXISTS duplicate_analytics;
END $$;

-- PART 2: Update the refresh_user_analytics function to handle constraint violations
CREATE OR REPLACE FUNCTION refresh_user_analytics(p_user_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_metric_names TEXT[] := ARRAY[
        'winning_days', 'win_rate', 'total_trades', 'total_pnl', 
        'avg_pnl_per_contract', 'avg_win', 'avg_loss', 'profit_factor', 
        'expectancy', 'sharpe_ratio', 'largest_win', 'largest_loss',
        'win_loss_ratio', 'consecutive_wins', 'consecutive_losses'
    ];
    v_metric TEXT;
    v_value NUMERIC;
BEGIN
    -- Log analytics refresh for debugging
    RAISE NOTICE 'Refreshing analytics for user %', p_user_id;
    
    -- For each metric, calculate and update
    FOREACH v_metric IN ARRAY v_metric_names
    LOOP
        BEGIN
            -- Calculate the metric value
            EXECUTE format('SELECT calculate_%s($1)', v_metric) USING p_user_id INTO v_value;
            
            -- Insert or update the analytic record using ON CONFLICT
            INSERT INTO analytics (user_id, metric_name, value)
            VALUES (p_user_id, v_metric, v_value)
            ON CONFLICT (user_id, metric_name) 
            DO UPDATE SET 
                value = EXCLUDED.value, 
                updated_at = NOW();
                
            EXCEPTION WHEN OTHERS THEN
                -- Log the error but continue processing other metrics
                RAISE WARNING 'Error updating metric % for user %: %', 
                    v_metric, p_user_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in refresh_user_analytics: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 3: Update the process_topstepx_csv_batch function to handle analytics errors gracefully
CREATE OR REPLACE FUNCTION handle_analytics_refresh(p_user_id UUID) 
RETURNS JSONB AS $$
DECLARE
    v_success BOOLEAN;
BEGIN
    BEGIN
        -- Try to refresh analytics
        v_success := refresh_user_analytics(p_user_id);
        
        IF v_success THEN
            RETURN jsonb_build_object(
                'analytics_refresh', 'success'
            );
        ELSE
            RETURN jsonb_build_object(
                'analytics_refresh', 'failed',
                'error', 'Unknown error refreshing analytics'
            );
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the entire operation
        RETURN jsonb_build_object(
            'analytics_refresh', 'failed',
            'error', SQLERRM
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 4: Update improved_topstepx_error_handling.sql function to use the new handler
CREATE OR REPLACE FUNCTION process_topstepx_csv_batch_helper(
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_user_id UUID;
  v_analytics_result JSONB;
BEGIN
  -- Call the original function first
  v_result := process_topstepx_csv_batch(p_data);
  
  -- Extract user_id, defaulting to the auth context if not in result
  IF v_result ? 'user_id' THEN
    v_user_id := (v_result->>'user_id')::UUID;
  ELSIF p_data ? 'user_id' THEN
    v_user_id := (p_data->>'user_id')::UUID;
  ELSE
    v_user_id := auth.uid();
  END IF;
  
  -- If trades were successfully processed, try to refresh analytics safely
  IF (v_result->>'success')::BOOLEAN THEN
    v_analytics_result := handle_analytics_refresh(v_user_id);
    
    -- Add analytics result to the response without changing the success status
    v_result := jsonb_set(v_result, '{analytics}', v_analytics_result);
  END IF;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'message', 'Error in helper function: ' || SQLERRM,
    'original_result', v_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION refresh_user_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_analytics_refresh(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_topstepx_csv_batch_helper(JSONB) TO authenticated;

-- Optional: If analytics_user_id_metric_name_unique constraint is not needed
-- (Only use this if business logic allows multiple values per metric)
/*
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'analytics_user_id_metric_name_unique'
  ) THEN
    ALTER TABLE analytics DROP CONSTRAINT analytics_user_id_metric_name_unique;
    RAISE NOTICE 'Removed unique constraint from analytics table';
    
    -- Recreate as a non-unique index to maintain performance
    CREATE INDEX IF NOT EXISTS analytics_user_id_metric_name_idx 
    ON analytics(user_id, metric_name);
  ELSE
    RAISE NOTICE 'Constraint analytics_user_id_metric_name_unique does not exist';
  END IF;
END $$;
*/ 