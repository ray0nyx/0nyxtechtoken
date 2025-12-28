-- Test the process_tradovate_csv_batch function with sample data
SELECT process_tradovate_csv_batch(
  '856950ff-d638-419d-bcf1-b7dac51d1c7f'::uuid,
  NULL,
  ARRAY[
    ROW(
      'MNQZ5',
      '2025-10-17',
      1,
      25000.0,
      25050.0,
      5.0,
      '2025-10-17T10:00:00Z',
      '2025-10-17T10:30:00Z',
      30,
      '{"test": true}'::jsonb
    )::tradovate_csv_row
  ]
);

-- Check if any trades were inserted
SELECT COUNT(*) as total_trades, MAX(created_at) as latest_trade 
FROM trades 
WHERE user_id = '856950ff-d638-419d-bcf1-b7dac51d1c7f';
