-- Test trade insertion to verify database is working
INSERT INTO trades (
  user_id,
  symbol,
  side,
  quantity,
  price,
  exit_price,
  timestamp,
  exit_time,
  pnl,
  net_pnl,
  fees,
  trade_date,
  platform,
  notes,
  entry_price,
  entry_date,
  exit_date,
  created_at,
  updated_at
) VALUES (
  '856950ff-d638-419d-bcf1-b7dac51d1c7f',
  'TEST',
  'long',
  1,
  100.00,
  105.00,
  NOW(),
  NOW(),
  5.00,
  5.00,
  0,
  CURRENT_DATE,
  'test',
  'Test trade insertion',
  100.00,
  NOW(),
  NOW(),
  NOW(),
  NOW()
);

-- Check if the test trade was inserted
SELECT COUNT(*) as total_trades, MAX(created_at) as latest_trade 
FROM trades 
WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f';

-- Show the most recent trades
SELECT id, symbol, side, quantity, price, pnl, created_at 
FROM trades 
WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f' 
ORDER BY created_at DESC 
LIMIT 5;
