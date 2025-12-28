#!/bin/bash

# Script to run the update_pnl_analytics.sql against the database
# Make sure to set DATABASE_URL environment variable before running

set -e

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it using: export DATABASE_URL=postgres://username:password@host:port/database"
    exit 1
fi

# Check if the SQL file exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/update_pnl_analytics.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found at $SQL_FILE"
    exit 1
fi

echo "Running update_pnl_analytics.sql against the database..."
echo "This script will calculate and update the analytics for all P&L entries."

# Run the SQL file against the database
psql "$DATABASE_URL" -f "$SQL_FILE"

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "✅ Success: P&L analytics have been updated!"
    echo "All P&L entries should now have proper values in the analytics fields."
else
    echo "❌ Error: Failed to update P&L analytics."
    echo "Please check the output above for more details."
fi 