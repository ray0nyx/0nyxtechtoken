-- Create the trades_staging table if it doesn't exist
CREATE TABLE IF NOT EXISTS trades_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    symbol TEXT,
    position TEXT NOT NULL,
    entry_date TIMESTAMP,
    exit_date TIMESTAMP,
    entry_price NUMERIC,
    exit_price DOUBLE PRECISION,
    quantity NUMERIC,
    pnl NUMERIC,
    strategy TEXT,
    broker TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    tags TEXT[],
    fees DOUBLE PRECISION,
    commission NUMERIC,
    date DATE,
    qty INTEGER,
    priceFormat TEXT,
    priceFormatType TEXT,
    tickSize NUMERIC,
    buyFillId TEXT,
    sellFillId TEXT,
    buyPrice NUMERIC,
    sellPrice NUMERIC,
    boughtTimestamp TIMESTAMP,
    soldTimestamp TIMESTAMP,
    duration INTERVAL,
    import_status TEXT DEFAULT 'pending',
    error_message TEXT,
    processed_at TIMESTAMP
);

-- Add comments to document the staging table
COMMENT ON TABLE trades_staging IS 'Staging table for trades before they are processed and moved to the main trades table';
COMMENT ON COLUMN trades_staging.import_status IS 'Status of the import process: pending, processed, error';
COMMENT ON COLUMN trades_staging.error_message IS 'Error message if the import process failed';
COMMENT ON COLUMN trades_staging.processed_at IS 'Timestamp when the trade was processed and moved to the main trades table';

-- Create an index on user_id and import_status for faster queries
CREATE INDEX IF NOT EXISTS trades_staging_user_id_import_status_idx ON trades_staging (user_id, import_status);

-- Create a function to clean dollar signs from numeric values if it doesn't exist
CREATE OR REPLACE FUNCTION clean_dollar_sign(input_value TEXT)
RETURNS NUMERIC AS $$
BEGIN
    -- Remove dollar signs and any other non-numeric characters except decimal points and negative signs
    RETURN NULLIF(REGEXP_REPLACE(input_value, '[^0-9.-]', '', 'g'), '')::NUMERIC;
EXCEPTION
    WHEN OTHERS THEN
        -- If conversion fails, return NULL
        RETURN NULL;
END;
$$ LANGUAGE plpgsql; 