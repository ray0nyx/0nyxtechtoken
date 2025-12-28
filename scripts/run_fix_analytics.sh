#!/bin/bash

# Script to run the fix_analytics_display.sql against the database
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
SQL_FILE="$SCRIPT_DIR/fix_analytics_display.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found at $SQL_FILE"
    exit 1
fi

echo "Running fix_analytics_display.sql against the database..."
echo "This may take a few minutes depending on the size of your analytics table."

# Run the SQL file against the database
psql "$DATABASE_URL" -f "$SQL_FILE"

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "✅ Success: Analytics display fix has been applied!"
    echo "All analytics data should now display correctly without dates."
else
    echo "❌ Error: Failed to apply the analytics display fix."
    echo "Please check the output above for more details."
fi 