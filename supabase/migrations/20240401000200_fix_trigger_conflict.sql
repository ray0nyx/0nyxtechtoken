-- First, check if the handle_trade_dates function exists, if not create a placeholder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_trade_dates' 
        AND pg_function_is_visible(oid)
    ) THEN
        RAISE NOTICE 'Creating placeholder for handle_trade_dates function';
        
        -- Create a placeholder function if it doesn't exist
        -- You should replace this with your actual function implementation
        CREATE OR REPLACE FUNCTION handle_trade_dates()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $FUNC$
        BEGIN
            -- This is a placeholder. In a real deployment, ensure the actual function logic is here
            IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                -- Example: set dates if needed
                IF NEW.created_at IS NULL THEN
                    NEW.created_at := NOW();
                END IF;
                
                IF TG_OP = 'UPDATE' THEN
                    NEW.updated_at := NOW();
                ELSIF TG_OP = 'INSERT' THEN
                    NEW.updated_at := NOW();
                END IF;
            END IF;
            
            RETURN NEW;
        END;
        $FUNC$;
    END IF;
END
$$;

-- First drop the existing trigger if it exists
DROP TRIGGER IF EXISTS handle_trade_dates_trigger ON trades;

-- Then recreate it
CREATE TRIGGER handle_trade_dates_trigger
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION handle_trade_dates();

-- Create a deployment script for manually deploying changes
COMMENT ON SCHEMA public IS 'Deployment instructions:

To deploy these changes:

1. For the trigger fix:
   - This migration will fix the duplicate trigger issue.

2. For the user registration fix:
   - The repair_user_account function is in migration 20240401000100_add_user_repair_functions.sql
   - Deploy the Edge Function with: npx supabase functions deploy register-user
   - Make sure Docker is running for local testing
   
3. To repair any existing users with issues:
   - Run this SQL: SELECT * FROM repair_missing_users();
'; 