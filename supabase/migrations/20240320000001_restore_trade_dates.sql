-- Check and add date columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'entry_date') THEN
        ALTER TABLE trades ADD COLUMN entry_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'exit_date') THEN
        ALTER TABLE trades ADD COLUMN exit_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add date column if it doesn't exist (for compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'date') THEN
        ALTER TABLE trades ADD COLUMN date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS handle_trade_dates_trigger ON trades;
DROP FUNCTION IF EXISTS handle_trade_dates();

-- Create function to handle date updates
CREATE OR REPLACE FUNCTION handle_trade_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- For new trades or updates
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Set entry_date if not provided
        IF NEW.entry_date IS NULL THEN
            NEW.entry_date = CURRENT_TIMESTAMP;
        END IF;
        
        -- Set exit_date if not provided but trade has exit info
        IF NEW.exit_date IS NULL AND NEW.exit_time IS NOT NULL THEN
            NEW.exit_date = NEW.exit_time;
        END IF;
        
        -- Set the date field for compatibility with existing queries
        NEW.date = COALESCE(NEW.exit_date, NEW.entry_date);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for date handling, but only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'handle_trade_dates_trigger' 
        AND tgrelid = 'trades'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER handle_trade_dates_trigger
                BEFORE INSERT OR UPDATE ON trades
                FOR EACH ROW
                EXECUTE FUNCTION handle_trade_dates()';
    END IF;
END $$;

-- Update existing trades to set dates with a more defensive approach
-- that checks for column existence first
DO $$
DECLARE
    has_timestamp BOOLEAN;
    has_exit_time BOOLEAN;
    has_trade_date BOOLEAN;
    has_created_at BOOLEAN;
    has_updated_at BOOLEAN;
BEGIN
    -- Check which columns exist
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'timestamp') INTO has_timestamp;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'exit_time') INTO has_exit_time;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'trade_date') INTO has_trade_date;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'created_at') INTO has_created_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'updated_at') INTO has_updated_at;
    
    -- Update entry_date based on available columns
    IF has_timestamp THEN
        UPDATE trades SET entry_date = timestamp WHERE entry_date IS NULL;
    ELSIF has_created_at THEN
        UPDATE trades SET entry_date = created_at WHERE entry_date IS NULL;
    ELSE
        UPDATE trades SET entry_date = CURRENT_TIMESTAMP WHERE entry_date IS NULL;
    END IF;
    
    -- Update exit_date based on available columns
    IF has_exit_time THEN
        UPDATE trades SET exit_date = exit_time WHERE exit_date IS NULL;
    ELSIF has_updated_at THEN
        UPDATE trades SET exit_date = updated_at WHERE exit_date IS NULL;
    END IF;
    
    -- Update date column based on available columns
    IF has_trade_date THEN
        UPDATE trades SET date = trade_date WHERE date IS NULL;
    ELSIF has_timestamp THEN
        UPDATE trades SET date = timestamp WHERE date IS NULL;
    ELSIF has_created_at THEN
        UPDATE trades SET date = created_at WHERE date IS NULL;
    ELSE
        UPDATE trades SET date = CURRENT_TIMESTAMP WHERE date IS NULL;
    END IF;
END $$;

-- Add indexes for better query performance
DROP INDEX IF EXISTS idx_trades_entry_date;
DROP INDEX IF EXISTS idx_trades_exit_date;
DROP INDEX IF EXISTS idx_trades_date;

CREATE INDEX idx_trades_entry_date ON trades(entry_date);
CREATE INDEX idx_trades_exit_date ON trades(exit_date);
CREATE INDEX idx_trades_date ON trades(date); 