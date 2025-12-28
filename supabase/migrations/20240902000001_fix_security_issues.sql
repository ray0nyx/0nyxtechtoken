-- Migration to fix security issues reported by Supabase linter
-- This migration addresses:
-- 1. Security definer views
-- 2. RLS disabled tables

-- 1. Fix security definer views by recreating them without SECURITY DEFINER
-- First, let's save the view definitions
DO $$
DECLARE
    view_def TEXT;
BEGIN
    -- Get trade_pairs view definition
    SELECT pg_get_viewdef('public.trade_pairs'::regclass, true) INTO view_def;
    -- Store it for later use
    IF view_def IS NOT NULL THEN
        CREATE TEMP TABLE IF NOT EXISTS temp_view_defs(view_name TEXT PRIMARY KEY, definition TEXT);
        INSERT INTO temp_view_defs VALUES ('trade_pairs', view_def)
        ON CONFLICT (view_name) DO UPDATE SET definition = view_def;
    END IF;

    -- Get daily_trade_summary view definition
    SELECT pg_get_viewdef('public.daily_trade_summary'::regclass, true) INTO view_def;
    -- Store it for later use
    IF view_def IS NOT NULL THEN
        INSERT INTO temp_view_defs VALUES ('daily_trade_summary', view_def)
        ON CONFLICT (view_name) DO UPDATE SET definition = view_def;
    END IF;

    -- Get product_performance view definition
    SELECT pg_get_viewdef('public.product_performance'::regclass, true) INTO view_def;
    -- Store it for later use
    IF view_def IS NOT NULL THEN
        INSERT INTO temp_view_defs VALUES ('product_performance', view_def)
        ON CONFLICT (view_name) DO UPDATE SET definition = view_def;
    END IF;
END
$$;

-- Drop and recreate the views without SECURITY DEFINER
DROP VIEW IF EXISTS public.trade_pairs CASCADE;
DROP VIEW IF EXISTS public.daily_trade_summary CASCADE;
DROP VIEW IF EXISTS public.product_performance CASCADE;

-- Recreate trade_pairs view
DO $$
DECLARE
    view_def TEXT;
BEGIN
    SELECT definition FROM temp_view_defs WHERE view_name = 'trade_pairs' INTO view_def;
    IF view_def IS NOT NULL THEN
        -- Remove SECURITY DEFINER if present and recreate
        view_def := regexp_replace(view_def, 'SECURITY\s+DEFINER', '', 'i');
        EXECUTE 'CREATE VIEW public.trade_pairs AS ' || view_def;
        
        -- Grant appropriate permissions
        EXECUTE 'GRANT SELECT ON public.trade_pairs TO authenticated';
        EXECUTE 'GRANT SELECT ON public.trade_pairs TO service_role';
    END IF;
END
$$;

-- Recreate daily_trade_summary view
DO $$
DECLARE
    view_def TEXT;
BEGIN
    SELECT definition FROM temp_view_defs WHERE view_name = 'daily_trade_summary' INTO view_def;
    IF view_def IS NOT NULL THEN
        -- Remove SECURITY DEFINER if present and recreate
        view_def := regexp_replace(view_def, 'SECURITY\s+DEFINER', '', 'i');
        EXECUTE 'CREATE VIEW public.daily_trade_summary AS ' || view_def;
        
        -- Grant appropriate permissions
        EXECUTE 'GRANT SELECT ON public.daily_trade_summary TO authenticated';
        EXECUTE 'GRANT SELECT ON public.daily_trade_summary TO service_role';
    END IF;
END
$$;

-- Recreate product_performance view
DO $$
DECLARE
    view_def TEXT;
BEGIN
    SELECT definition FROM temp_view_defs WHERE view_name = 'product_performance' INTO view_def;
    IF view_def IS NOT NULL THEN
        -- Remove SECURITY DEFINER if present and recreate
        view_def := regexp_replace(view_def, 'SECURITY\s+DEFINER', '', 'i');
        EXECUTE 'CREATE VIEW public.product_performance AS ' || view_def;
        
        -- Grant appropriate permissions
        EXECUTE 'GRANT SELECT ON public.product_performance TO authenticated';
        EXECUTE 'GRANT SELECT ON public.product_performance TO service_role';
    END IF;
END
$$;

-- 2. Enable RLS on tables where it's disabled
-- Enable RLS on user_performance table
ALTER TABLE IF EXISTS public.user_performance ENABLE ROW LEVEL SECURITY;

-- Create policy for user_performance
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Users can only access their own performance data" ON public.user_performance;
    
    -- Create policy
    CREATE POLICY "Users can only access their own performance data"
    ON public.user_performance
    FOR ALL
    USING (auth.uid() = user_id);
    
    -- Allow service role full access
    DROP POLICY IF EXISTS "Service role can access all performance data" ON public.user_performance;
    CREATE POLICY "Service role can access all performance data"
    ON public.user_performance
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Enable RLS on analytics table
ALTER TABLE IF EXISTS public.analytics ENABLE ROW LEVEL SECURITY;

-- Create policy for analytics
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Users can only access their own analytics data" ON public.analytics;
    
    -- Create policy
    CREATE POLICY "Users can only access their own analytics data"
    ON public.analytics
    FOR ALL
    USING (auth.uid() = user_id);
    
    -- Allow service role full access
    DROP POLICY IF EXISTS "Service role can access all analytics data" ON public.analytics;
    CREATE POLICY "Service role can access all analytics data"
    ON public.analytics
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Enable RLS on trades_staging table
ALTER TABLE IF EXISTS public.trades_staging ENABLE ROW LEVEL SECURITY;

-- Create policy for trades_staging
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Users can only access their own staging trades" ON public.trades_staging;
    
    -- Create policy
    CREATE POLICY "Users can only access their own staging trades"
    ON public.trades_staging
    FOR ALL
    USING (auth.uid() = user_id);
    
    -- Allow service role full access
    DROP POLICY IF EXISTS "Service role can access all staging trades" ON public.trades_staging;
    CREATE POLICY "Service role can access all staging trades"
    ON public.trades_staging
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Enable RLS on user_trade_metrics table
ALTER TABLE IF EXISTS public.user_trade_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy for user_trade_metrics
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Users can only access their own trade metrics" ON public.user_trade_metrics;
    
    -- Create policy
    CREATE POLICY "Users can only access their own trade metrics"
    ON public.user_trade_metrics
    FOR ALL
    USING (auth.uid() = user_id);
    
    -- Allow service role full access
    DROP POLICY IF EXISTS "Service role can access all trade metrics" ON public.user_trade_metrics;
    CREATE POLICY "Service role can access all trade metrics"
    ON public.user_trade_metrics
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Enable RLS on migration_log table
ALTER TABLE IF EXISTS public.migration_log ENABLE ROW LEVEL SECURITY;

-- Create policy for migration_log (typically admin-only)
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Only service role can access migration logs" ON public.migration_log;
    
    -- Create policy - restrict to service role only
    CREATE POLICY "Only service role can access migration logs"
    ON public.migration_log
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Enable RLS on performance_table table
ALTER TABLE IF EXISTS public.performance_table ENABLE ROW LEVEL SECURITY;

-- Create policy for performance_table
DO $$
BEGIN
    -- Drop policy if it exists
    DROP POLICY IF EXISTS "Users can only access their own performance data" ON public.performance_table;
    
    -- Create policy
    CREATE POLICY "Users can only access their own performance data"
    ON public.performance_table
    FOR ALL
    USING (auth.uid() = user_id);
    
    -- Allow service role full access
    DROP POLICY IF EXISTS "Service role can access all performance data" ON public.performance_table;
    CREATE POLICY "Service role can access all performance data"
    ON public.performance_table
    FOR ALL
    USING (auth.role() = 'service_role');
END
$$;

-- Clean up temporary table
DROP TABLE IF EXISTS temp_view_defs; 