# Database Migrations

This directory contains SQL migration files for the WagYu application database.

## Migrations

### fix_user_signup_database_error.sql

This migration fixes the "Database error saving new user" issue that occurs during user signup. The error was happening because of issues in the `handle_new_user` trigger function.

The migration:

1. Updates the `handle_new_user` function to be more robust in handling errors
2. Ensures proper creation of user records in the public.users table
3. Creates a pending subscription record for new users
4. Adds proper error handling to prevent the signup process from failing
5. Sets up a trigger to ensure user profiles are created

## How to Apply

To apply this migration:

1. Connect to your Supabase database using the SQL editor
2. Copy and paste the contents of the migration file
3. Execute the SQL statements

After applying this migration, new users should be able to sign up without encountering the "Database error saving new user" error. 