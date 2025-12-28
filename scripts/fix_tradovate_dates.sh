#!/bin/bash

# Script to fix the Tradovate date parsing issue
# This runs the SQL script that updates the database function and fixes existing trades

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/fix_tradovate_dates.sql"

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found at $SQL_FILE"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  echo "Please set it using: export DATABASE_URL=postgresql://user:password@host:port/dbname"
  exit 1
fi

echo "Running SQL script to fix Tradovate dates..."

# Run the SQL script using psql
psql "$DATABASE_URL" -f "$SQL_FILE"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "Successfully updated the database function and fixed existing trades."
  echo "All future Tradovate imports will now use the correct dates from the CSV."
else
  echo "Error: Failed to execute the SQL script."
  exit 1
fi

echo "Done!" 