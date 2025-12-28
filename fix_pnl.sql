-- Fix NULL PNL values in trades_staging
UPDATE trades_staging SET pnl = CASE WHEN position = 'long' THEN (exit_price - entry_price) * quantity WHEN position = 'short' THEN (entry_price - exit_price) * quantity ELSE 0 END WHERE pnl IS NULL AND entry_price IS NOT NULL AND exit_price IS NOT NULL AND quantity IS NOT NULL;
