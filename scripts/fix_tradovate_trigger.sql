-- Fix Tradovate Trigger Function
-- This script modifies the update_tradovate_analytics_on_trade_change trigger function
-- to include error handling, ensuring it doesn't fail when adding or modifying trades

-- Log the start of the script execution
DO $$
BEGIN
  RAISE NOTICE 'Starting Tradovate trigger function fix script...';
END $$;

-- First, drop all existing triggers that might be using the function
DO $$
BEGIN
  -- Drop the triggers if they exist (checking both possible names)
  DROP TRIGGER IF EXISTS tradovate_analytics_trigger ON trades;
  RAISE NOTICE 'Dropped tradovate_analytics_trigger';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping tradovate_analytics_trigger: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Drop the trigger with the name mentioned in the error message
  DROP TRIGGER IF EXISTS tradovate_analytics_update ON trades;
  RAISE NOTICE 'Dropped tradovate_analytics_update';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping tradovate_analytics_update: %', SQLERRM;
END $$;

-- Now we can safely drop the function
DO $$
BEGIN
  DROP FUNCTION IF EXISTS update_tradovate_analytics_on_trade_change();
  RAISE NOTICE 'Dropped update_tradovate_analytics_on_trade_change function';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error dropping function: %', SQLERRM;
END $$;

-- Create an improved version of the trigger function with error handling
CREATE OR REPLACE FUNCTION update_tradovate_analytics_on_trade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process Tradovate trades
    IF NEW.broker = 'Tradovate' THEN
        BEGIN
            -- Call the populate_tradovate_analytics function to refresh analytics
            PERFORM populate_tradovate_analytics(NEW.user_id);
            RAISE NOTICE 'Successfully updated Tradovate analytics for user %', NEW.user_id;
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the transaction
            RAISE NOTICE 'Error updating Tradovate analytics: %', SQLERRM;
        END;
    END IF;
    
    -- Always return NEW to allow the original operation to complete
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DO $$
BEGIN
    -- Create the trigger with a consistent name
    CREATE TRIGGER tradovate_analytics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_tradovate_analytics_on_trade_change();
    
    RAISE NOTICE 'Tradovate analytics trigger recreated successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error recreating trigger: %', SQLERRM;
END $$;

-- Log the completion of the script
DO $$
BEGIN
  RAISE NOTICE 'Tradovate trigger function fix script completed successfully';
END $$; 