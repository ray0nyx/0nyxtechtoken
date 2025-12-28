-- Migration to ensure the B/S column is not required in the database

-- First, check if the B/S column exists and drop it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'B/S'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "B/S";
    END IF;
END $$;

-- Add a comment to the migration to document the change
COMMENT ON TABLE public.trades IS 'Trades table with B/S column removed as it is no longer required';

-- Update the documentation for the trades table
COMMENT ON COLUMN public.trades.position IS 'Position (long or short) - replaces the B/S column'; 