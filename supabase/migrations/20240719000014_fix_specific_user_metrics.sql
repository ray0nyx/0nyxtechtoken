-- Migration to directly fix the specific user mentioned in the error
-- Description: Force creates metrics for user ID 856950ff-d638-419d-bcf1-b7dac51d1c7f

-- Clear any potential conflicting records for this user
DO $$
BEGIN
    DELETE FROM analytics 
    WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f' 
    AND metric_name = 'overall_metrics';
    
    RAISE NOTICE 'Cleared any existing metrics for the user';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error clearing metrics: %', SQLERRM;
END $$;

-- Direct insertion of metrics for the specific user
INSERT INTO analytics (
    user_id,
    metric_name,
    total_trades,
    total_pnl,
    win_rate,
    average_pnl,
    wins,
    losses,
    largest_win,
    largest_loss,
    daily_pnl,
    weekly_pnl,
    monthly_pnl,
    cumulative_pnl,
    created_at,
    updated_at
) VALUES (
    '856950ff-d638-419d-bcf1-b7dac51d1c7f',
    'overall_metrics',
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    jsonb_build_object('value', 0),
    '{}'::JSONB,
    '{}'::JSONB,
    '{}'::JSONB,
    jsonb_build_object('value', 0),
    NOW(),
    NOW()
);

-- Create a way to manually force-create metrics for any user
CREATE OR REPLACE FUNCTION force_create_user_metrics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- First clear any conflicting records
    BEGIN
        DELETE FROM analytics 
        WHERE user_id = p_user_id 
        AND metric_name = 'overall_metrics';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error clearing existing metrics: %', SQLERRM;
    END;
    
    -- Then insert a fresh record
    BEGIN
        INSERT INTO analytics (
            user_id,
            metric_name,
            total_trades,
            total_pnl,
            win_rate,
            average_pnl,
            wins,
            losses,
            largest_win,
            largest_loss,
            daily_pnl,
            weekly_pnl,
            monthly_pnl,
            cumulative_pnl,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            'overall_metrics',
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            jsonb_build_object('value', 0),
            '{}'::JSONB,
            '{}'::JSONB,
            '{}'::JSONB,
            jsonb_build_object('value', 0),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Successfully created metrics for user %', p_user_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creating metrics: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION force_create_user_metrics(UUID) TO authenticated;

-- Check if we need to diagnose deeper issues with the constraint
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
    v_constraint_def TEXT;
BEGIN
    -- Check if unique constraint exists as expected
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'analytics_user_id_metric_name_unique'
        AND table_name = 'analytics'
    ) INTO v_constraint_exists;
    
    IF v_constraint_exists THEN
        -- Try to get the constraint definition
        SELECT pg_get_constraintdef(oid)
        INTO v_constraint_def
        FROM pg_constraint
        WHERE conname = 'analytics_user_id_metric_name_unique';
        
        RAISE NOTICE 'Constraint exists and is defined as: %', v_constraint_def;
    ELSE
        RAISE WARNING 'Expected constraint "analytics_user_id_metric_name_unique" does not exist';
    END IF;
END $$;

-- Also check the metrics for this user after our insertion
DO $$
DECLARE
    v_record_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM analytics 
        WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f'
        AND metric_name = 'overall_metrics'
    ) INTO v_record_exists;
    
    IF v_record_exists THEN
        RAISE NOTICE 'SUCCESS: Metrics record now exists for the user';
    ELSE
        RAISE WARNING 'FAILURE: Metrics record still does not exist after insertion attempt';
    END IF;
END $$; 