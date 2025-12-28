-- Migration: Fix analytics_table references
-- Description: Creates a view named analytics_table that maps to the analytics table

-- Log this migration
DO $$
BEGIN
  -- Check if migration has already been applied
  IF NOT EXISTS (
    SELECT 1 FROM public.migration_log 
    WHERE migration_name = '20240714000002_fix_analytics_table_references'
  ) THEN
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240714000002_fix_analytics_table_references', 'Creates a view named analytics_table that maps to the analytics table', NOW());
  ELSE
    RAISE NOTICE 'Migration 20240714000002_fix_analytics_table_references has already been applied.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If the migration_log table doesn't exist yet, create it
    CREATE TABLE IF NOT EXISTS public.migration_log (
      id SERIAL PRIMARY KEY,
      migration_name TEXT NOT NULL,
      description TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert migration log entry
    INSERT INTO public.migration_log (migration_name, description, executed_at)
    VALUES ('20240714000002_fix_analytics_table_references', 'Creates a view named analytics_table that maps to the analytics table', NOW());
END;
$$;

-- Drop existing analytics_table if it exists as a table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_table') THEN
    DROP TABLE public.analytics_table;
  END IF;
END;
$$;

-- Drop existing analytics_table if it exists as a view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'analytics_table') THEN
    DROP VIEW public.analytics_table;
  END IF;
END;
$$;

-- Drop existing populate_analytics_table function if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'populate_analytics_table') THEN
    DROP FUNCTION IF EXISTS populate_analytics_table(UUID);
  END IF;
END;
$$;

-- Create a view named analytics_table that maps to the analytics table
CREATE OR REPLACE VIEW analytics_table AS
SELECT * FROM analytics;

-- Create a function to populate the analytics table
CREATE OR REPLACE FUNCTION populate_analytics_table(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Call the calculate_user_analytics function
  PERFORM calculate_user_analytics(p_user_id);
END;
$$ LANGUAGE plpgsql; 