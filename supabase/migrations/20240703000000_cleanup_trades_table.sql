-- Migration to clean up the trades table and ensure only necessary columns are present for Tradovate CSV imports

-- First, let's create a backup of the trades table
CREATE TABLE IF NOT EXISTS public.trades_backup AS SELECT * FROM public.trades;

-- Now, let's drop columns that are duplicates or unnecessary
-- We'll keep only the columns that are actually used in the application

-- These are the columns we want to keep:
-- id, user_id, symbol, position, date, entry_date, exit_date, entry_price, exit_price, quantity, qty, pnl, 
-- strategy, broker, notes, tags, fees, commission, created_at, updated_at

-- Drop unnecessary columns (keeping the ones we need)
ALTER TABLE public.trades 
  DROP COLUMN IF EXISTS "side",
  DROP COLUMN IF EXISTS "price",
  DROP COLUMN IF EXISTS "timestamp",
  DROP COLUMN IF EXISTS "order_id",
  DROP COLUMN IF EXISTS "bs",
  DROP COLUMN IF EXISTS "product_description",
  DROP COLUMN IF EXISTS "fill_time",
  DROP COLUMN IF EXISTS "version_id",
  DROP COLUMN IF EXISTS "limit_price",
  DROP COLUMN IF EXISTS "stop_price",
  DROP COLUMN IF EXISTS "filled_qty",
  DROP COLUMN IF EXISTS "avg_fill_price",
  DROP COLUMN IF EXISTS "orderId",
  DROP COLUMN IF EXISTS "Account",
  DROP COLUMN IF EXISTS "Order ID",
  DROP COLUMN IF EXISTS "B/S",
  DROP COLUMN IF EXISTS "Contract",
  DROP COLUMN IF EXISTS "Product",
  DROP COLUMN IF EXISTS "Product Description",
  DROP COLUMN IF EXISTS "avgPrice",
  DROP COLUMN IF EXISTS "filledQty",
  DROP COLUMN IF EXISTS "Fill Time",
  DROP COLUMN IF EXISTS "lastCommandId",
  DROP COLUMN IF EXISTS "Status",
  DROP COLUMN IF EXISTS "_priceFormat",
  DROP COLUMN IF EXISTS "_priceFormatType",
  DROP COLUMN IF EXISTS "_tickSize",
  DROP COLUMN IF EXISTS "spreadDefinitionId",
  DROP COLUMN IF EXISTS "Version ID",
  DROP COLUMN IF EXISTS "Timestamp",
  DROP COLUMN IF EXISTS "Quantity",
  DROP COLUMN IF EXISTS "Text",
  DROP COLUMN IF EXISTS "Type",
  DROP COLUMN IF EXISTS "Limit Price",
  DROP COLUMN IF EXISTS "Stop Price",
  DROP COLUMN IF EXISTS "decimalLimit",
  DROP COLUMN IF EXISTS "decimalStop",
  DROP COLUMN IF EXISTS "Filled Qty",
  DROP COLUMN IF EXISTS "Avg Fill Price",
  DROP COLUMN IF EXISTS "decimalFillAvg",
  DROP COLUMN IF EXISTS "account",
  DROP COLUMN IF EXISTS "order_id_original",
  DROP COLUMN IF EXISTS "product",
  DROP COLUMN IF EXISTS "avg_price",
  DROP COLUMN IF EXISTS "last_command_id",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "price_format",
  DROP COLUMN IF EXISTS "price_format_type",
  DROP COLUMN IF EXISTS "tick_size",
  DROP COLUMN IF EXISTS "spread_definition_id",
  DROP COLUMN IF EXISTS "text",
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "decimal_limit",
  DROP COLUMN IF EXISTS "decimal_stop",
  DROP COLUMN IF EXISTS "filled_qty_total",
  DROP COLUMN IF EXISTS "decimal_fill_avg",
  DROP COLUMN IF EXISTS "daily_pnl",
  DROP COLUMN IF EXISTS "cumulative_pnl",
  DROP COLUMN IF EXISTS "win_loss_distribution",
  DROP COLUMN IF EXISTS "trade_duration_pnl",
  DROP COLUMN IF EXISTS "strategy_performance",
  DROP COLUMN IF EXISTS "daily_profit",
  DROP COLUMN IF EXISTS "profit",
  DROP COLUMN IF EXISTS "total_trades";

-- Add comment to the qty column to clarify its purpose
COMMENT ON COLUMN public.trades.qty IS 'Quantity field specifically for Tradovate CSV imports, mapped from filledQty';

-- Ensure all required columns have appropriate constraints
ALTER TABLE public.trades
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN symbol SET NOT NULL,
  ALTER COLUMN position SET NOT NULL,
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL;

-- Add check constraint for position
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_position_check,
  ADD CONSTRAINT trades_position_check CHECK (position IN ('long', 'short'));

-- Add check constraint for quantity
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_quantity_check,
  ADD CONSTRAINT trades_quantity_check CHECK (quantity > 0);

-- Add foreign key constraint for user_id
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_user_id_fkey,
  ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; 