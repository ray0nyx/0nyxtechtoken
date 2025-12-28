-- Migration to update trades table for Tradovate CSV imports
-- Remove 'contract' column and add 'qty' column

-- First, remove the 'contract' column
ALTER TABLE public.trades DROP COLUMN IF EXISTS "contract";
ALTER TABLE public.trades DROP COLUMN IF EXISTS "Contract";

-- Then, add the 'qty' column if it doesn't exist
-- Note: We're adding this as a separate column from 'quantity' to specifically handle Tradovate imports
-- This allows for backward compatibility with existing code
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'qty'
    ) THEN
        ALTER TABLE public.trades ADD COLUMN "qty" integer;
        COMMENT ON COLUMN public.trades.qty IS 'Quantity field specifically for Tradovate CSV imports';
    END IF;
END $$; 