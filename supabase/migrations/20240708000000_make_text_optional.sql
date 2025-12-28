-- Migration to ensure the Text column is not required in the database

-- First, check if the Text column exists and drop it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'Text'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "Text";
    END IF;
END $$;

-- Add a comment to the migration to document the change
COMMENT ON TABLE public.trades IS 'Trades table with Text column removed as it is no longer required';

-- Update the documentation for the trades table
COMMENT ON COLUMN public.trades.notes IS 'Notes field - can be used to store Text information from Tradovate CSV imports'; 