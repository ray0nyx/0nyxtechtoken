-- Migration: Enhance analytics table
-- Description: Adds additional columns to analytics table

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240713000003_enhance_analytics'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240713000003_enhance_analytics', 'Adds additional columns to analytics table', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240713000003_enhance_analytics has already been applied.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL UNIQUE,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
    
    -- Then try to insert again
    IF NOT EXISTS (
      SELECT 1 FROM public.migration_log 
      WHERE migration_name = '20240713000003_enhance_analytics'
    ) THEN
      INSERT INTO public.migration_log (migration_name, description, executed_at)
      VALUES ('20240713000003_enhance_analytics', 'Adds additional columns to analytics table', NOW());
    ELSE
      RAISE NOTICE 'Migration 20240713000003_enhance_analytics has already been applied.';
    END IF;
END;
$$;

-- Add "Win Rate" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'win_rate') THEN
    ALTER TABLE analytics ADD COLUMN "win_rate" NUMERIC;
    RAISE NOTICE 'Added column "win_rate" to analytics';
  ELSE
    RAISE NOTICE 'Column "win_rate" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "win_rate": %', SQLERRM;
END;
$$;

-- Add "Average P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'average_pnl') THEN
    ALTER TABLE analytics ADD COLUMN "average_pnl" NUMERIC;
    RAISE NOTICE 'Added column "average_pnl" to analytics';
  ELSE
    RAISE NOTICE 'Column "average_pnl" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "average_pnl": %', SQLERRM;
END;
$$;

-- Add "Wins" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'wins') THEN
    ALTER TABLE analytics ADD COLUMN "wins" INTEGER;
    RAISE NOTICE 'Added column "wins" to analytics';
  ELSE
    RAISE NOTICE 'Column "wins" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "wins": %', SQLERRM;
END;
$$;

-- Add "Losses" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'losses') THEN
    ALTER TABLE analytics ADD COLUMN "losses" INTEGER;
    RAISE NOTICE 'Added column "losses" to analytics';
  ELSE
    RAISE NOTICE 'Column "losses" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "losses": %', SQLERRM;
END;
$$;

-- Add "Largest Win" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'largest_win') THEN
    ALTER TABLE analytics ADD COLUMN "largest_win" NUMERIC;
    RAISE NOTICE 'Added column "largest_win" to analytics';
  ELSE
    RAISE NOTICE 'Column "largest_win" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "largest_win": %', SQLERRM;
END;
$$;

-- Add "Largest Loss" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'largest_loss') THEN
    ALTER TABLE analytics ADD COLUMN "largest_loss" NUMERIC;
    RAISE NOTICE 'Added column "largest_loss" to analytics';
  ELSE
    RAISE NOTICE 'Column "largest_loss" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "largest_loss": %', SQLERRM;
END;
$$;

-- Add "Daily P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'daily_pnl') THEN
    ALTER TABLE analytics ADD COLUMN "daily_pnl" NUMERIC;
    RAISE NOTICE 'Added column "daily_pnl" to analytics';
  ELSE
    RAISE NOTICE 'Column "daily_pnl" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "daily_pnl": %', SQLERRM;
END;
$$;

-- Add "Weekly P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'weekly_pnl') THEN
    ALTER TABLE analytics ADD COLUMN "weekly_pnl" NUMERIC;
    RAISE NOTICE 'Added column "weekly_pnl" to analytics';
  ELSE
    RAISE NOTICE 'Column "weekly_pnl" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "weekly_pnl": %', SQLERRM;
END;
$$;

-- Add "Monthly P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'monthly_pnl') THEN
    ALTER TABLE analytics ADD COLUMN "monthly_pnl" NUMERIC;
    RAISE NOTICE 'Added column "monthly_pnl" to analytics';
  ELSE
    RAISE NOTICE 'Column "monthly_pnl" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "monthly_pnl": %', SQLERRM;
END;
$$;

-- Add "Cumulative P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics' AND column_name = 'cumulative_pnl') THEN
    ALTER TABLE analytics ADD COLUMN "cumulative_pnl" NUMERIC;
    RAISE NOTICE 'Added column "cumulative_pnl" to analytics';
  ELSE
    RAISE NOTICE 'Column "cumulative_pnl" already exists in analytics';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "cumulative_pnl": %', SQLERRM;
END;
$$; 