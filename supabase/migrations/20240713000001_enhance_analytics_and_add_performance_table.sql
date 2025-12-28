-- Migration: Enhance analytics table and add performance table
-- Description: Adds additional columns to analytics_table and creates a new performance_table

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240713000001_enhance_analytics_and_add_performance_table'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240713000001_enhance_analytics_and_add_performance_table', 'Adds additional columns to analytics_table and creates a new performance_table', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240713000001_enhance_analytics_and_add_performance_table has already been applied.';
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
      WHERE migration_name = '20240713000001_enhance_analytics_and_add_performance_table'
    ) THEN
      INSERT INTO public.migration_log (migration_name, description, executed_at)
      VALUES ('20240713000001_enhance_analytics_and_add_performance_table', 'Adds additional columns to analytics_table and creates a new performance_table', NOW());
    ELSE
      RAISE NOTICE 'Migration 20240713000001_enhance_analytics_and_add_performance_table has already been applied.';
    END IF;
END;
$$;

-- Add "Win Rate" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Win Rate') THEN
    ALTER TABLE analytics_table ADD COLUMN "Win Rate" NUMERIC;
    RAISE NOTICE 'Added column "Win Rate" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Win Rate" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Win Rate": %', SQLERRM;
END;
$$;

-- Add "Average P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Average P&L') THEN
    ALTER TABLE analytics_table ADD COLUMN "Average P&L" NUMERIC;
    RAISE NOTICE 'Added column "Average P&L" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Average P&L" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Average P&L": %', SQLERRM;
END;
$$;

-- Add "Wins" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Wins') THEN
    ALTER TABLE analytics_table ADD COLUMN "Wins" INTEGER;
    RAISE NOTICE 'Added column "Wins" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Wins" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Wins": %', SQLERRM;
END;
$$;

-- Add "Losses" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Losses') THEN
    ALTER TABLE analytics_table ADD COLUMN "Losses" INTEGER;
    RAISE NOTICE 'Added column "Losses" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Losses" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Losses": %', SQLERRM;
END;
$$;

-- Add "Largest Win" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Largest Win') THEN
    ALTER TABLE analytics_table ADD COLUMN "Largest Win" NUMERIC;
    RAISE NOTICE 'Added column "Largest Win" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Largest Win" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Largest Win": %', SQLERRM;
END;
$$;

-- Add "Largest Loss" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Largest Loss') THEN
    ALTER TABLE analytics_table ADD COLUMN "Largest Loss" NUMERIC;
    RAISE NOTICE 'Added column "Largest Loss" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Largest Loss" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Largest Loss": %', SQLERRM;
END;
$$;

-- Add "Daily P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Daily P&L') THEN
    ALTER TABLE analytics_table ADD COLUMN "Daily P&L" NUMERIC;
    RAISE NOTICE 'Added column "Daily P&L" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Daily P&L" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Daily P&L": %', SQLERRM;
END;
$$;

-- Add "Weekly P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Weekly P&L') THEN
    ALTER TABLE analytics_table ADD COLUMN "Weekly P&L" NUMERIC;
    RAISE NOTICE 'Added column "Weekly P&L" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Weekly P&L" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Weekly P&L": %', SQLERRM;
END;
$$;

-- Add "Monthly P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Monthly P&L') THEN
    ALTER TABLE analytics_table ADD COLUMN "Monthly P&L" NUMERIC;
    RAISE NOTICE 'Added column "Monthly P&L" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Monthly P&L" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Monthly P&L": %', SQLERRM;
END;
$$;

-- Add "Cumulative P&L" column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analytics_table' AND column_name = 'Cumulative P&L') THEN
    ALTER TABLE analytics_table ADD COLUMN "Cumulative P&L" NUMERIC;
    RAISE NOTICE 'Added column "Cumulative P&L" to analytics_table';
  ELSE
    RAISE NOTICE 'Column "Cumulative P&L" already exists in analytics_table';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding column "Cumulative P&L": %', SQLERRM;
END;
$$;

-- Create performance_table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_table') THEN
    CREATE TABLE performance_table (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      date DATE,
      "Strategy Performance" NUMERIC,
      "Win Rate" NUMERIC,
      "Trade Duration vs P&L" NUMERIC,
      "Performance by Duration" NUMERIC,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create index on user_id for performance_table
    CREATE INDEX idx_performance_table_user_id ON performance_table(user_id);
    
    -- Create index on date for performance_table
    CREATE INDEX idx_performance_table_date ON performance_table(date);
    
    RAISE NOTICE 'Created performance_table and indexes';
  ELSE
    RAISE NOTICE 'performance_table already exists';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating performance_table: %', SQLERRM;
END;
$$; 