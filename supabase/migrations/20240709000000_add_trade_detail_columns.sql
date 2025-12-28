-- Migration to add detailed trade columns to the trades table

-- Add new columns to the trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS "buyFillId" TEXT,
ADD COLUMN IF NOT EXISTS "sellFillId" TEXT,
ADD COLUMN IF NOT EXISTS "buyPrice" NUMERIC(20,2),
ADD COLUMN IF NOT EXISTS "sellPrice" NUMERIC(20,2),
ADD COLUMN IF NOT EXISTS "boughtTimestamp" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "soldTimestamp" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "duration" INTEGER; -- Duration in seconds

-- Add comments to document the new columns
COMMENT ON COLUMN public.trades."buyFillId" IS 'The fill ID for the buy side of the trade';
COMMENT ON COLUMN public.trades."sellFillId" IS 'The fill ID for the sell side of the trade';
COMMENT ON COLUMN public.trades."buyPrice" IS 'The price at which the asset was bought';
COMMENT ON COLUMN public.trades."sellPrice" IS 'The price at which the asset was sold';
COMMENT ON COLUMN public.trades."boughtTimestamp" IS 'The timestamp when the asset was bought';
COMMENT ON COLUMN public.trades."soldTimestamp" IS 'The timestamp when the asset was sold';
COMMENT ON COLUMN public.trades."duration" IS 'The duration of the trade in seconds';

-- Update the table comment
COMMENT ON TABLE public.trades IS 'Trades table with detailed trade information including buy/sell timestamps and duration'; 