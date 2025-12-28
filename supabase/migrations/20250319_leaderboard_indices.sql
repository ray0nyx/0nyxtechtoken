-- Add indices to improve leaderboard query performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl);

-- Add index on profiles table for name lookup
CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(first_name, last_name);

-- Add comment to explain these indices
COMMENT ON INDEX idx_trades_user_id IS 'Improves performance of leaderboard queries by user_id';
COMMENT ON INDEX idx_trades_date IS 'Improves performance of date-based filtering for leaderboard';
COMMENT ON INDEX idx_trades_pnl IS 'Improves performance of sorting by PnL for leaderboard';
COMMENT ON INDEX idx_profiles_name IS 'Improves performance of name lookups for leaderboard'; 