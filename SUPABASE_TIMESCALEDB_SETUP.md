# TimescaleDB Setup for Supabase

This guide explains how to set up TimescaleDB for the institutional backtester in your Supabase project.

## Prerequisites

1. **Supabase Project**: You need an active Supabase project
2. **TimescaleDB Extension**: TimescaleDB must be enabled in your Supabase project
3. **Admin Access**: You need admin access to your Supabase project

## Step 1: Enable TimescaleDB Extension

### Option A: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Extensions**
3. Search for "TimescaleDB" or "timescaledb"
4. Click **Enable** if available

### Option B: Via SQL Editor
1. Go to **SQL Editor** in your Supabase dashboard
2. Run this command:
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Option C: Contact Supabase Support
If TimescaleDB is not available in your project:
1. Contact Supabase support
2. Request TimescaleDB extension to be enabled
3. Provide your project reference ID

## Step 2: Run the Migration

### Option A: Via Supabase Dashboard
1. Go to **SQL Editor**
2. Copy and paste the contents of `supabase/migrations/20240120000001_setup_timescaledb_supabase.sql`
3. Click **Run**

### Option B: Via Supabase CLI
```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

### Option C: Via Direct Script
1. Copy the contents of `scripts/setup-timescaledb-supabase.sql`
2. Run it in your Supabase SQL Editor

## Step 3: Verify Setup

Run the test script to verify everything is working:

1. Go to **SQL Editor** in Supabase
2. Copy and paste the contents of `scripts/test-timescaledb-supabase.sql`
3. Click **Run**

You should see output like:
```
TimescaleDB extension is available
Successfully created hypertable for market_data
Successfully created hypertable for tick_data
Successfully created hypertable for backtest_data
TimescaleDB Supabase setup test completed successfully!
```

## Step 4: Configure Your Application

Update your application to use the TimescaleDB functions:

```typescript
// Example: Insert market data
const { data, error } = await supabase.rpc('insert_market_data', {
  p_timestamp: new Date().toISOString(),
  p_symbol: 'BTC/USD',
  p_exchange: 'binance',
  p_timeframe: '1h',
  p_open: 50000.0,
  p_high: 51000.0,
  p_low: 49000.0,
  p_close: 50500.0,
  p_volume: 100.0
});

// Example: Get market data
const { data, error } = await supabase.rpc('get_market_data', {
  p_symbol: 'BTC/USD',
  p_exchange: 'binance',
  p_timeframe: '1h',
  p_start_time: startDate.toISOString(),
  p_end_time: endDate.toISOString()
});
```

## Troubleshooting

### TimescaleDB Extension Not Available
- **Error**: "TimescaleDB extension not found"
- **Solution**: Contact Supabase support to enable TimescaleDB

### Permission Denied
- **Error**: "permission denied for table market_data"
- **Solution**: Ensure RLS policies are properly set up and you're authenticated

### Hypertable Creation Failed
- **Error**: "Hypertable creation failed"
- **Solution**: Check if TimescaleDB is properly enabled and you have the necessary permissions

### Column Does Not Exist
- **Error**: "column 'timestamp' does not exist"
- **Solution**: Ensure the migration ran successfully and tables were created

## Tables Created

1. **market_data**: OHLCV data for stocks and crypto
2. **tick_data**: High-frequency tick data
3. **backtest_data**: Backtest results and portfolio values

## Functions Available

1. **insert_market_data()**: Insert OHLCV data
2. **get_market_data()**: Retrieve market data for a time range
3. **get_latest_price()**: Get the latest price for a symbol
4. **calculate_sma()**: Calculate Simple Moving Average

## Security

- **RLS Enabled**: All tables have Row Level Security enabled
- **Public Read Access**: Market data and tick data are publicly readable
- **Authenticated Access**: Backtest data requires authentication
- **Function Security**: All functions use SECURITY DEFINER for proper permissions

## Performance

- **Hypertables**: All tables are converted to TimescaleDB hypertables for optimal time-series performance
- **Indexes**: Proper indexes are created for common query patterns
- **Chunking**: Data is automatically chunked by time for better performance

## Next Steps

1. **Data Ingestion**: Set up data ingestion from your preferred data sources
2. **API Integration**: Integrate with your existing API endpoints
3. **Monitoring**: Set up monitoring for data quality and performance
4. **Backup**: Configure automated backups for your time-series data

## Support

If you encounter any issues:
1. Check the Supabase logs in your dashboard
2. Verify TimescaleDB extension is enabled
3. Ensure all migrations ran successfully
4. Contact Supabase support if needed
