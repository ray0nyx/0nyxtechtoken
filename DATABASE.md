# Database Fixes and Migration Guide

This document contains instructions for applying database fixes to resolve various issues encountered with the WagYu trading platform.

## Overview of Fixes

We've addressed several critical issues with the database functions:

1. **TopstepX Function Fix**: Created a function to process TopstepX CSV data
2. **Tradovate Function Fix**: Fixed the Tradovate CSV processing function
3. **Case Sensitivity Fixes**: Resolved issues with column name case sensitivity in both functions
4. **Duration Field Fix**: Fixed type mismatch issues with the duration field
5. **Migration Fixes**: Created additional migrations to fix related issues in the database

## How to Apply the Fixes

### Step 1: Apply the SQL Scripts

Run the following SQL scripts in order:

```bash
# Connect to your database
psql -d your_database_name

# Run these scripts in order
\i scripts/case_fix_tradovate_function.sql
\i scripts/case_fix_topstepx_function.sql
\i scripts/fix_case_sensitivity_migration.sql
```

### Step 2: Verify the Fixes

After applying the scripts, verify that the functions are working correctly:

```sql
-- Check if the functions exist with the right signatures
SELECT proname, proargtypes::regtype[] 
FROM pg_proc 
WHERE proname IN ('process_tradovate_csv_batch', 'process_topstepx_csv_batch');

-- Check column names in the trades table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'trades' 
AND column_name IN ('"buyFillId"', '"sellFillId"', 'buyfillid', 'sellfillid');
```

### Step 3: Test Data Import

Test importing data from both platforms:

1. **Tradovate CSV Upload**: Use the app to upload a sample Tradovate CSV file
2. **TopstepX CSV Upload**: Use the app to upload a sample TopstepX CSV file

## What the Fixes Do

### 1. Tradovate Function Fix

The `case_fix_tradovate_function.sql` script:

- Drops and recreates the `process_tradovate_csv_batch` function with proper case sensitivity
- Ensures all column references use the correct case with proper quoting
- Maintains backward compatibility with different function signatures
- Fixes JSON field extraction to handle various input formats
- **NEW**: Fixes duration field type mismatch by properly converting duration strings to interval data type

### 2. TopstepX Function Fix

The `case_fix_topstepx_function.sql` script:

- Creates a new `process_topstepx_csv_batch` function with proper case handling
- Ensures compatibility with the existing database schema
- Properly handles TopstepX-specific CSV fields
- **NEW**: Fixes duration field type mismatch by properly converting duration strings to interval data type

### 3. Data Migration Fix

The `fix_case_sensitivity_migration.sql` script:

- Updates existing data to fix case sensitivity issues
- Corrects any PNL calculation issues
- Ensures analytics are recalculated after the fixes

## Common Issues and Troubleshooting

### Column Name Issues

If you encounter errors related to column names:

```sql
-- Check the actual column names in the trades table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trades' 
ORDER BY ordinal_position;

-- Fix specific column names if needed
ALTER TABLE trades 
RENAME COLUMN buyfillid TO "buyFillId";

ALTER TABLE trades 
RENAME COLUMN sellfillid TO "sellFillId";
```

### Function Not Found

If you see function not found errors:

```sql
-- Verify that functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public'
AND routine_name LIKE '%csv%';
```

### Duration Format Issues

If you encounter errors related to the duration field like:

```
CASE types interval and text cannot be matched
```
or
```
CASE types text and interval cannot be matched
```

These errors happen when trying to mix interval and text data types in PostgreSQL. Our comprehensive fix:

1. Properly parses duration strings like "1min 10sec" or "15sec" into PostgreSQL interval data types
2. Ensures all duration values are consistently returned as interval types
3. Uses a multi-level fallback approach:
   - First tries to parse the duration string 
   - If that fails, calculates duration from entry and exit timestamps
   - If that's not possible, defaults to a safe interval value (1 second)
4. Never returns NULL or text values for the duration field

This ensures the database function will always insert a valid interval value for the duration field, preventing type mismatches that would cause errors.

## Technical Background

### Why Case Sensitivity Matters

PostgreSQL treats column names as case-sensitive when they are quoted (e.g., `"buyFillId"` vs `buyfillid`). The frontend code expected camelCase column names with double quotes, but some database functions were using lowercase without quotes.

### SQL Function Execution Flow

1. Frontend sends trade data in JSON format with camelCase properties
2. Database function extracts fields and inserts into trades table
3. Case mismatches caused data to be inserted incorrectly or not at all

## Documentation Updates

The frontend documentation has been updated to reflect these changes. Make sure to also check:

1. API documentation for updated function signatures
2. CSV import guidelines for users

## Contact

If you encounter further issues, please create a new issue in the GitHub repository or contact the development team. 