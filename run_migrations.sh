#!/bin/bash

# Run the migrations in order
echo "Running migration 20240716000002_fix_pnl_in_staging.sql..."
psql -h localhost -p 54322 -d postgres -U postgres -f supabase/migrations/20240716000002_fix_pnl_in_staging.sql

echo "Running migration 20240716000003_fix_csv_processing.sql..."
psql -h localhost -p 54322 -d postgres -U postgres -f supabase/migrations/20240716000003_fix_csv_processing.sql

echo "Running migration 20240716000004_fix_pnl_in_trades.sql..."
psql -h localhost -p 54322 -d postgres -U postgres -f supabase/migrations/20240716000004_fix_pnl_in_trades.sql

echo "Migrations complete!"
