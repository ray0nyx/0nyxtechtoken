-- Migration to ensure the filledQty column is not required in the database

-- First, check if the filledQty column exists and drop it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'filledQty'
    ) THEN
        ALTER TABLE public.trades DROP COLUMN "filledQty";
    END IF;
END $$;

-- Add a comment to the migration to document the change
COMMENT ON TABLE public.trades IS 'Trades table with filledQty column removed as it is no longer required';

-- Update the documentation for the trades table
COMMENT ON COLUMN public.trades.quantity IS 'Quantity - replaces the filledQty column';
COMMENT ON COLUMN public.trades.qty IS 'Quantity field specifically for Tradovate CSV imports, used when filledQty is not available'; 