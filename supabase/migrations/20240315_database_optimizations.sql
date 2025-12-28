-- Database Optimizations Migration

-- 1. Add missing indexes to improve query performance
-- Add index on user_id for journal_notes to speed up user-specific queries
CREATE INDEX IF NOT EXISTS idx_journal_notes_user_id ON public.journal_notes(user_id);

-- Add index on user_id for user_subscriptions to speed up user lookup
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

-- Add index on status for user_subscriptions to speed up filtering by status
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

-- Add index on email for user_subscriptions to speed up email lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON public.user_subscriptions(email);

-- 2. Fix duplicate user subscription issue
-- Create a temporary function to identify and fix duplicate subscriptions
DO $$
DECLARE
    user_rec RECORD;
    duplicate_count INTEGER;
    active_sub_id UUID;
BEGIN
    -- Find users with multiple subscriptions
    FOR user_rec IN 
        SELECT user_id, COUNT(*) as sub_count 
        FROM public.user_subscriptions 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'Fixing duplicate subscriptions for user: %', user_rec.user_id;
        
        -- Find if there's an active subscription
        SELECT id INTO active_sub_id 
        FROM public.user_subscriptions 
        WHERE user_id = user_rec.user_id AND status = 'active' 
        LIMIT 1;
        
        -- If there's an active subscription, keep it and delete others
        IF active_sub_id IS NOT NULL THEN
            DELETE FROM public.user_subscriptions 
            WHERE user_id = user_rec.user_id AND id != active_sub_id;
            RAISE NOTICE 'Kept active subscription % and deleted others', active_sub_id;
        ELSE
            -- Otherwise keep the most recent one
            DELETE FROM public.user_subscriptions 
            WHERE id NOT IN (
                SELECT id FROM public.user_subscriptions 
                WHERE user_id = user_rec.user_id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) AND user_id = user_rec.user_id;
            RAISE NOTICE 'Kept most recent subscription for user %', user_rec.user_id;
        END IF;
    END LOOP;
END $$;

-- 3. Add a unique constraint to prevent duplicate subscriptions in the future
ALTER TABLE public.user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_unique;

ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);

-- 4. Optimize the trades table which has high sequential scans
-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trades_user_id_date ON public.trades(user_id, date);
CREATE INDEX IF NOT EXISTS idx_trades_user_id_symbol ON public.trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_user_id_pnl ON public.trades(user_id, pnl);

-- 5. Analyze tables to update statistics for query planner
ANALYZE public.trades;
ANALYZE public.analytics;
ANALYZE public.journal_notes;
ANALYZE public.user_subscriptions;
ANALYZE public.users;

-- 6. Update the handle_new_user function to be more robust with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Log the trigger activation for debugging
  RAISE LOG 'handle_new_user trigger activated for user_id: %, email: %', NEW.id, NEW.email;
  
  -- Create user record with better error handling
  BEGIN
    -- Insert new user if not exists
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.created_at, NOW()), 
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
      email = NEW.email,
      updated_at = COALESCE(NEW.updated_at, NOW());
      
    RAISE LOG 'User record managed for ID: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue
    RAISE LOG 'Error managing user record: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Create subscription record with better error handling
  BEGIN
    -- Only create if not exists
    IF NOT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id) THEN
      -- Generate a UUID for the subscription
      v_subscription_id := gen_random_uuid();
      
      -- Create trial subscription record
      INSERT INTO public.user_subscriptions (
        id,
        user_id,
        status,
        access_level,
        email,
        created_at,
        updated_at
      ) VALUES (
        v_subscription_id,
        NEW.id,
        'trial',
        'dashboard_only',
        NEW.email,
        NOW(),
        NOW()
      );
      
      RAISE LOG 'Created subscription record with ID: % for user: %', v_subscription_id, NEW.id;
    ELSE
      RAISE LOG 'User % already has a subscription record', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail the whole process
    RAISE LOG 'Error creating subscription: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  END;
  
  -- Always return NEW to allow the sign-up to complete
  RETURN NEW;
END;
$function$;

-- 7. Add a function to clean up orphaned records periodically
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Delete user_subscriptions without corresponding auth.users
    DELETE FROM public.user_subscriptions
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    -- Delete profiles without corresponding auth.users
    DELETE FROM public.profiles
    WHERE id NOT IN (SELECT id FROM auth.users);
    
    -- Delete journal_notes without corresponding auth.users
    DELETE FROM public.journal_notes
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    -- Delete trades without corresponding auth.users
    DELETE FROM public.trades
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    -- Delete analytics without corresponding auth.users
    DELETE FROM public.analytics
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    RAISE NOTICE 'Orphaned records cleanup completed';
END;
$function$;

-- Create a comment to document the cleanup function
COMMENT ON FUNCTION public.cleanup_orphaned_records() IS 
'Cleans up orphaned records in various tables that reference auth.users. 
This function should be run periodically as a maintenance task.';

-- 8. Add a migration log entry
INSERT INTO public.migration_log (migration_name, applied_at, description)
VALUES (
    '20240315_database_optimizations',
    NOW(),
    'Added performance optimizations, fixed duplicate subscriptions, added indexes, and improved error handling'
)
ON CONFLICT (migration_name) DO NOTHING; 