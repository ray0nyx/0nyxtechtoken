-- Add new columns to the trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS symbol TEXT,
ADD COLUMN IF NOT EXISTS priceFormat TEXT,
ADD COLUMN IF NOT EXISTS priceFormatType TEXT,
ADD COLUMN IF NOT EXISTS tickSize NUMERIC,
ADD COLUMN IF NOT EXISTS buyFillId TEXT,
ADD COLUMN IF NOT EXISTS sellFillId TEXT,
ADD COLUMN IF NOT EXISTS qty INTEGER,
ADD COLUMN IF NOT EXISTS buyPrice NUMERIC,
ADD COLUMN IF NOT EXISTS sellPrice NUMERIC,
ADD COLUMN IF NOT EXISTS pnl NUMERIC,
ADD COLUMN IF NOT EXISTS boughtTimestamp TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS soldTimestamp TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS duration INTERVAL;

-- Add comments to document the new columns
COMMENT ON COLUMN trades.priceFormat IS 'Price format for the trade';
COMMENT ON COLUMN trades.priceFormatType IS 'Type of price format';
COMMENT ON COLUMN trades.tickSize IS 'Tick size for the instrument';
COMMENT ON COLUMN trades.buyFillId IS 'ID for the buy fill';
COMMENT ON COLUMN trades.sellFillId IS 'ID for the sell fill';
COMMENT ON COLUMN trades.buyPrice IS 'Price at which the instrument was bought';
COMMENT ON COLUMN trades.sellPrice IS 'Price at which the instrument was sold';
COMMENT ON COLUMN trades.boughtTimestamp IS 'Timestamp when the instrument was bought';
COMMENT ON COLUMN trades.soldTimestamp IS 'Timestamp when the instrument was sold';
COMMENT ON COLUMN trades.duration IS 'Duration between buy and sell'; 