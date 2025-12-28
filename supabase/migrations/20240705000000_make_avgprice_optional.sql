-- Migration to ensure the avgPrice column is not required in the database

-- First, check if the avgPrice column exists and drop it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'avgPrice'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "avgPrice";
    END IF;
END $$;

-- Add a comment to the migration to document the change
COMMENT ON TABLE public.trades IS 'Trades table with avgPrice column removed as it is no longer required';

-- Update the documentation for the trades table
COMMENT ON COLUMN public.trades.entry_price IS 'Entry price - replaces the avgPrice column for entry trades';
COMMENT ON COLUMN public.trades.exit_price IS 'Exit price - replaces the avgPrice column for exit trades'; 