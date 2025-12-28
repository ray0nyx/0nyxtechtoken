-- Migration to add function for initializing empty user metrics
-- Description: Ensures users have basic metrics even before they have trades

-- Create function to initialize empty metrics for a user
CREATE OR REPLACE FUNCTION initialize_user_metrics(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Check if metrics already exist for this user
    IF NOT EXISTS (SELECT 1 FROM analytics WHERE user_id = p_user_id) THEN
        -- Insert empty metrics record
        INSERT INTO analytics (
            user_id,
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
        
        RAISE NOTICE 'Initialized empty metrics for user %', p_user_id;
    ELSE
        RAISE NOTICE 'Metrics already exist for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Modify process_tradovate_csv_batch to ensure metrics exist
DO $$
BEGIN
    -- Check if the process_tradovate_csv_batch function exists
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'process_tradovate_csv_batch'
    ) THEN
        -- Drop the function to recreate it
        DROP FUNCTION IF EXISTS process_tradovate_csv_batch(UUID, UUID, JSONB);
        
        RAISE NOTICE 'Dropped process_tradovate_csv_batch function for recreation';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error checking/dropping process_tradovate_csv_batch: %', SQLERRM;
END $$;

-- Recreate process_tradovate_csv_batch with initialization
CREATE OR REPLACE FUNCTION process_tradovate_csv_batch(
    p_user_id UUID,
    p_account_id UUID,
    p_rows JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_row JSONB;
    v_result JSONB;
    v_successful_rows INT := 0;
    v_failed_rows INT := 0;
    v_results JSONB[] := '{}';
    v_error TEXT;
BEGIN
    -- Initialize metrics for the user if they don't exist
    PERFORM initialize_user_metrics(p_user_id);
    
    -- Process each row
    FOR v_row IN SELECT jsonb_array_elements(p_rows)
    LOOP
        BEGIN
            -- Call the row processor function
            SELECT process_tradovate_csv_row(
                p_user_id, 
                p_account_id, 
                v_row
            ) INTO v_result;
            
            v_successful_rows := v_successful_rows + 1;
            v_results := array_append(v_results, jsonb_build_object(
                'success', true,
                'result', v_result
            ));
        EXCEPTION WHEN OTHERS THEN
            v_failed_rows := v_failed_rows + 1;
            v_error := SQLERRM;
            
            v_results := array_append(v_results, jsonb_build_object(
                'success', false,
                'error', v_error,
                'row', v_row
            ));
        END;
    END LOOP;
    
    -- Update analytics after processing trades
    BEGIN
        -- Calculate analytics based on the newly added trades
        PERFORM calculate_user_analytics(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error calculating analytics after processing trades: %', SQLERRM;
    END;
    
    -- Return batch processing results
    RETURN jsonb_build_object(
        'success', v_failed_rows = 0,
        'processed_count', v_successful_rows + v_failed_rows,
        'successful_count', v_successful_rows,
        'failed_count', v_failed_rows,
        'results', to_jsonb(v_results)
    );
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Errors processing trades: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to ensure users always have metrics
CREATE OR REPLACE FUNCTION ensure_user_has_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Initialize metrics for new users
    PERFORM initialize_user_metrics(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger on the auth.users table if it doesn't exist
DO $$
BEGIN
    -- Check if the trigger already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'ensure_new_user_has_metrics'
    ) THEN
        -- Create the trigger
        CREATE TRIGGER ensure_new_user_has_metrics
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION ensure_user_has_metrics();
        
        RAISE NOTICE 'Created trigger for initializing metrics for new users';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating trigger: %', SQLERRM;
END $$;

-- Initialize metrics for existing users who don't have them
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN 
        SELECT id 
        FROM auth.users 
        WHERE id NOT IN (SELECT user_id FROM analytics)
    LOOP
        PERFORM initialize_user_metrics(v_user.id);
    END LOOP;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION initialize_user_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_tradovate_csv_batch(UUID, UUID, JSONB) TO authenticated; 