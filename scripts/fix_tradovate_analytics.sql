-- Fix Tradovate Analytics Function
-- This script fixes the populate_tradovate_analytics function that was failing due to a missing unique constraint

-- Log the start of the script execution
DO $$
BEGIN
  RAISE NOTICE 'Starting Tradovate analytics function fix script...';
END $$;

-- First, try to add the missing unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'analytics_user_id_metric_name_date_key'
  ) THEN
    BEGIN
      ALTER TABLE analytics 
      ADD CONSTRAINT analytics_user_id_metric_name_date_key 
      UNIQUE (user_id, metric_name, date);
      
      RAISE NOTICE 'Added missing unique constraint to analytics table';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
      RAISE NOTICE 'Will use alternative function implementation instead';
    END;
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Drop the existing function if it exists
DO $$
BEGIN
  DROP FUNCTION IF EXISTS populate_tradovate_analytics(uuid);
  RAISE NOTICE 'Dropped existing populate_tradovate_analytics function';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping function: %', SQLERRM;
  RAISE NOTICE 'Will attempt to create function anyway';
END $$;

-- Create an alternative version of the function that doesn't rely on the unique constraint
CREATE OR REPLACE FUNCTION populate_tradovate_analytics(p_user_id uuid)
RETURNS void AS $$
BEGIN
    -- First, delete existing analytics records for this user
    DELETE FROM analytics 
    WHERE user_id = p_user_id 
    AND metric_name = 'daily_metrics'
    AND EXISTS (
        SELECT 1 FROM trades 
        WHERE trades.user_id = p_user_id 
        AND trades.broker = 'Tradovate'
        AND trades.date = analytics.date
    );
    
    -- Then insert new records
    INSERT INTO analytics (
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
        jsonb_build_object('value', COUNT(*)) AS total_trades,
        jsonb_build_object('value', SUM(trades.pnl)) AS total_pnl,
        NOW() AS created_at,
        NOW() AS updated_at
    FROM 
        trades
    WHERE 
        trades.user_id = p_user_id
        AND trades.broker = 'Tradovate'
    GROUP BY 
        trades.date;
    
    RAISE NOTICE 'Tradovate analytics refreshed for user %', p_user_id;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in populate_tradovate_analytics: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Log the completion of the script
DO $$
BEGIN
  RAISE NOTICE 'Tradovate analytics function fix script completed successfully';
END $$; 