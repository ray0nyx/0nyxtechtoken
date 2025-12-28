-- Make order_id column optional in trades table
-- Note: The column is already nullable, but this migration ensures it's explicitly documented

-- Add comment to the order_id column to indicate it's optional
COMMENT ON COLUMN trades.order_id IS 'Optional order ID from broker system';

-- Add comment to the orderId column to indicate it's optional
COMMENT ON COLUMN trades."orderId" IS 'Optional order ID from broker system (alternative format)';

-- Add comment to the "Order ID" column to indicate it's optional
COMMENT ON COLUMN trades."Order ID" IS 'Optional order ID from broker system (alternative format)';

-- Add comment to the order_id_original column to indicate it's optional
COMMENT ON COLUMN trades.order_id_original IS 'Optional original order ID from broker system'; 