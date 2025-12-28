# Trade Date Consistency Fix

## Issue

There's a discrepancy between the trades shown on the monthly calendar in the Analytics page and the trades shown on the Trades page. This happens because:

1. The `PnLCalendar` component in the Analytics page was fetching trades using the `exit_date` or `entry_date` fields to determine which month to display them in.

2. However, the analytics data (used for the monthly totals) is calculated using the `date` field in the `calculate_user_analytics` function.

3. In some cases, the `entry_date` and `exit_date` fields show different months than the `date` field, causing trades to appear in different months in different parts of the application.

## Solution

We've implemented a six-part solution:

1. **Frontend Fix**: Updated the `PnLCalendar` component to use the `date` field consistently, matching how the analytics are calculated.

2. **Database Fix**: Created a SQL script (`fix_trade_dates.sql`) to update the `date` field to match the `entry_date` field for all trades where they're inconsistent, and then refresh the analytics.

3. **Function Fix**: Created a SQL script (`fix_tradovate_analytics.sql`) to fix the `populate_tradovate_analytics` function that was failing due to a missing unique constraint.

4. **Trigger Fix**: Created a SQL script (`fix_tradovate_trigger.sql`) to fix the `update_tradovate_analytics_on_trade_change` trigger function that was calling the problematic function.

5. **Tradovate Upload Fix**: Created a SQL script (`fix_tradovate_upload.sql`) to fix the `process_tradovate_csv_batch` function issue by creating a new function with the expected signature.

6. **TopstepX Upload Fix**: Created a SQL script (`fix_topstepx_upload.sql`) to fix the `process_topstepx_csv_batch` function to handle errors better and ensure the frontend receives the correct success status.

## How to Run the Fix

To fix the date inconsistencies in the database:

1. Connect to your database using a SQL client or the command line.
2. Run the scripts in the following order:

```bash
# First, fix the trade dates
psql -U your_username -d your_database -f scripts/fix_trade_dates.sql

# Then, fix the analytics function
psql -U your_username -d your_database -f scripts/fix_tradovate_analytics.sql

# Then, fix the trigger function
psql -U your_username -d your_database -f scripts/fix_tradovate_trigger.sql

# Then, fix the Tradovate upload function
psql -U your_username -d your_database -f scripts/fix_tradovate_upload.sql

# Finally, fix the TopstepX upload function
psql -U your_username -d your_database -f scripts/fix_topstepx_upload.sql
```

Or copy and paste the contents of the scripts into your SQL client and execute them in the same order.

## Common Errors

### Missing Unique Constraint Error

If you see an error like:

```
ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

This means the database is missing a unique constraint that the function is trying to use. The `fix_trade_dates.sql` script attempts to add this constraint, but if it fails, you should run the `fix_tradovate_analytics.sql` and `fix_tradovate_trigger.sql` scripts which provide alternative implementations that don't rely on the constraint.

### Function Not Found Error

If you see an error like:

```
404 (Not Found) - Could not find the function public.process_tradovate_csv_batch
```

This means the function signature expected by the client doesn't match the one in the database. Run the `fix_tradovate_upload.sql` script to create a new function with the expected signature.

### Parameter Name Error

If you see an error like:

```
ERROR: 42P13: cannot change name of input parameter "p_user_id"
```

This happens when trying to create a function with the same name but different parameter order. The updated `fix_tradovate_upload.sql` script handles this by creating a wrapper function with a different name first, and then creating the client-facing function that calls the wrapper.

### TopstepX Upload Error

If you see an error like:

```
Failed to process any trades. Errors: Failed to process trade at index 0; Failed to process trade at index 1...
```

But the console shows that trades were successfully processed, run the `fix_topstepx_upload.sql` script to fix the error handling in the `process_topstepx_csv_batch` function.

## Verification

After running the fix:

1. The trades on the monthly calendar in the Analytics page should match the trades on the Trades page.
2. The PnL values should be consistent across all views.
3. Adding or modifying trades should not produce any errors related to analytics calculations.
4. Uploading Tradovate CSV files should work without errors.
5. Uploading TopstepX CSV files should work without showing errors when trades are successfully processed.

## Prevention

To prevent this issue in the future:

1. Always use the `date` field for date-based calculations and filtering.
2. When importing trades, ensure the `date` field is set correctly.
3. Consider adding database constraints or triggers to keep the date fields in sync.
4. Use try-catch blocks in database functions to handle errors gracefully.
5. When changing function signatures, create wrapper functions to maintain backward compatibility.
6. Ensure that error handling in database functions properly communicates success/failure status to the frontend.

# TraderLog Fixes

This directory contains SQL scripts to fix various issues with the TraderLog application.

## Tradovate Analytics Fix

There is a discrepancy between trades shown on the monthly calendar in the Analytics page and those on the Trades page. This is due to inconsistencies between the `date` and `entry_date` fields in the trades table.

### The Solution

The solution is a six-part approach:

1. **Frontend Fix**: Update the `PnLCalendar` component to use `entry_date` instead of `date` when fetching trades.
2. **Database Fix**: Update the `date` field in the trades table to match the `entry_date` field.
3. **Function Fix**: Implement an alternative version of the `populate_tradovate_analytics` function that deletes existing records before inserting new ones.
4. **Trigger Fix**: Modify the `update_tradovate_analytics_on_trade_change` trigger function to include error handling.
5. **Upload Fix**: Create a wrapper function for `process_tradovate_csv_batch` to handle parameter ordering correctly.
6. **TopstepX Fix**: Create a wrapper function for `process_topstepx_csv_batch` to handle parameter ordering correctly.

### Running the Fix

1. Connect to your database using `psql` or any SQL client.
2. Run the following scripts in order:
   ```
   psql -U your_username -d your_database -f fix_trade_dates.sql
   psql -U your_username -d your_database -f fix_tradovate_analytics.sql
   psql -U your_username -d your_database -f fix_tradovate_trigger.sql
   psql -U your_username -d your_database -f fix_tradovate_upload.sql
   psql -U your_username -d your_database -f fix_topstepx_upload.sql
   ```

Alternatively, you can copy and paste the contents of each script into your SQL client and execute them in sequence.

### Common Errors

1. **Unique Constraint Error**: If you see an error about a unique constraint violation, it means there are duplicate entries in the analytics table. The fix scripts handle this by deleting existing records before inserting new ones.

2. **Function Not Found Error**: If you see an error about a function not being found, it means the function doesn't exist or has a different signature. The fix scripts create wrapper functions to handle this.

3. **Date Discrepancy**: If trades are showing up in the Trades page but not in the Analytics calendar, it's because the `date` field doesn't match the `entry_date` field. The `fix_trade_dates.sql` script fixes this.

### Verification

After applying the fixes, you should verify that:

1. The trades on the monthly calendar in the Analytics page match those on the Trades page.
2. You can upload new trades from Tradovate and TopstepX without errors.
3. The analytics data is updated correctly when trades are added or modified.

### Prevention

To prevent these issues from recurring:

1. Always use the `entry_date` field for date-related operations in both the frontend and backend.
2. Ensure that the `date` field is set to match the `entry_date` field when inserting or updating trades.
3. Use proper error handling in database functions and triggers.
4. Test uploads with small batches of data before processing large datasets.

## Account Creation Fix

Some users may not have accounts created, which prevents them from uploading trades. The `create_accounts.sql` script creates default accounts for all users who don't have them.

### Running the Account Fix

1. Connect to your database using `psql` or any SQL client.
2. Run the following script:
   ```
   psql -U your_username -d your_database -f create_accounts.sql
   ```

### Verification

After applying the account fix, you should verify that:

1. All users have at least one account.
2. Users can upload trades to their accounts.
3. The analytics data is updated correctly when trades are added. 