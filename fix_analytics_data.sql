-- Fix analytics data for user
-- This script manually updates the analytics table with correct trade statistics

-- First, let's get the current trade statistics
WITH trade_stats AS (
  SELECT 
    COUNT(*) as total_trades,
    SUM(pnl) as total_pnl,
    COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN pnl < 0 THEN 1 END) as losing_trades,
    MAX(pnl) as largest_win,
    MIN(pnl) as largest_loss,
    AVG(pnl) as average_pnl,
    ROUND(COUNT(CASE WHEN pnl > 0 THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as win_rate
  FROM trades 
  WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f'
),
daily_pnl_data AS (
  SELECT 
    jsonb_object_agg(
      date_str, 
      daily_total
    ) as daily_pnl
  FROM (
    SELECT 
      DATE(created_at)::text as date_str,
      ROUND(SUM(pnl)::numeric, 2) as daily_total
    FROM trades 
    WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f'
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  ) daily_totals
)
-- Update the analytics table with correct data
UPDATE analytics 
SET 
  total_trades = jsonb_build_object('value', ts.total_trades),
  total_pnl = jsonb_build_object('value', ts.total_pnl),
  win_rate = jsonb_build_object('value', ts.win_rate),
  average_pnl = jsonb_build_object('value', ts.average_pnl),
  wins = jsonb_build_object('value', ts.winning_trades),
  losses = jsonb_build_object('value', ts.losing_trades),
  largest_win = jsonb_build_object('value', ts.largest_win),
  largest_loss = jsonb_build_object('value', ts.largest_loss),
  daily_pnl = dpd.daily_pnl,
  updated_at = NOW()
FROM trade_stats ts, daily_pnl_data dpd
WHERE analytics.user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f'
  AND analytics.total_trades IS NOT NULL;

-- Verify the update
SELECT 
  total_trades,
  total_pnl,
  win_rate,
  average_pnl,
  wins,
  losses,
  largest_win,
  largest_loss,
  updated_at
FROM analytics 
WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f' 
  AND total_trades IS NOT NULL
ORDER BY updated_at DESC 
LIMIT 1;
