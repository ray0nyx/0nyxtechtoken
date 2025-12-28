# Supabase Migrations

This directory contains SQL migrations for the Supabase database.

## How to Apply Migrations

### Option 1: Using the Supabase Dashboard

1. Log in to your Supabase dashboard at https://app.supabase.com
2. Navigate to your project
3. Go to the SQL Editor
4. Copy the contents of the migration file (e.g., `20240314_fix_user_registration.sql`)
5. Paste it into the SQL Editor
6. Click "Run" to execute the migration

### Option 2: Using the Supabase CLI

If you have the Supabase CLI installed and configured:

```bash
# Link your project (only needed once)
npx supabase link --project-ref your-project-ref

# Push the migrations
npx supabase db push
```

Replace `your-project-ref` with your actual Supabase project reference ID.

## Migration Files

- `20240314_fix_user_registration.sql`: Fixes user registration issues by ensuring all auth users have corresponding records in the public.users table and user_subscriptions table. Also updates the handle_new_user trigger function to be more robust.

## Troubleshooting

If you encounter any issues when applying migrations:

1. Check the Supabase logs in the dashboard
2. Verify that your database schema matches the expected schema in the migration
3. If necessary, modify the migration to match your current schema

For more information, refer to the [Supabase documentation on migrations](https://supabase.com/docs/guides/database/migrations).

## Fixing User Registration Issues

We've identified an issue with user registration where new users are not being properly saved to the database. The error occurs because the `confirmed_at` column in the `auth.users` table is a generated column that cannot be directly updated.

### How to Apply the Fix

#### Option 1: Using the Supabase Dashboard SQL Editor

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to the SQL Editor
4. Create a new query
5. Copy and paste the contents of the `20240315_fix_user_confirmation.sql` file
6. Run the query

#### Option 2: Using the Supabase CLI

If you have the Supabase CLI installed and your project linked, you can try to apply the migrations using:

```bash
npx supabase db push --include-all
```

However, if you encounter errors with other migrations, you may need to use Option 1 instead.

### What the Fix Does

1. Drops and recreates constraints on the `user_subscriptions` table to allow more values
2. Updates the `handle_new_user()` trigger function to be more robust
3. Creates an `auto_confirm_user()` function that uses the built-in Supabase function to confirm users instead of directly updating the `confirmed_at` column
4. Sets up triggers to ensure these functions run when new users are created

### Verifying the Fix

After applying the fix, try to register a new user. The registration should complete successfully, and you should see:

1. A new record in the `auth.users` table
2. A corresponding record in the `public.users` table
3. A subscription record in the `public.user_subscriptions` table

If you continue to experience issues, check the Supabase logs for more details. 