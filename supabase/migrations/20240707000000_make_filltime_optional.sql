-- Migration to ensure the Fill Time column is not required in the database

-- First, check if the entry_time and exit_time columns exist and drop them if they do
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'entry_time'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "entry_time";
    END IF;

    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'exit_time'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "exit_time";
    END IF;
END $$;

-- Add a comment to the migration to document the change
COMMENT ON TABLE public.trades IS 'Trades table with entry_time and exit_time columns removed as they are no longer required';

-- Update the documentation for the trades table
COMMENT ON COLUMN public.trades.entry_date IS 'Entry date - replaces the entry_time column';
COMMENT ON COLUMN public.trades.exit_date IS 'Exit date - replaces the exit_time column'; 