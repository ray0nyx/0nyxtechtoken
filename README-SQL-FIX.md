# SQL Fix for Journal Notes Table

To fix the API errors you're experiencing, you need to run the following SQL commands in the Supabase dashboard:

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to the SQL Editor
4. Create a new query
5. Paste the following SQL code:

```sql
-- Add note_content column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_notes' 
        AND column_name = 'note_content'
    ) THEN
        ALTER TABLE public.journal_notes ADD COLUMN note_content text;
        
        -- Copy data from note to note_content
        UPDATE public.journal_notes SET note_content = note;
    END IF;
END $$;

-- Remove the unique constraint on (user_id, date)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'journal_notes_user_id_date_key' 
        AND conrelid = 'public.journal_notes'::regclass
    ) THEN
        ALTER TABLE public.journal_notes DROP CONSTRAINT journal_notes_user_id_date_key;
    END IF;
END $$;

-- Add pnl column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_notes' 
        AND column_name = 'pnl'
    ) THEN
        ALTER TABLE public.journal_notes ADD COLUMN pnl numeric(20, 2);
    END IF;
END $$;

-- Add emotion column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_notes' 
        AND column_name = 'emotion'
    ) THEN
        ALTER TABLE public.journal_notes ADD COLUMN emotion text;
    END IF;
END $$;

-- Add tags column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_notes' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.journal_notes ADD COLUMN tags text[];
    END IF;
END $$;
```

6. Click "Run" to execute the SQL commands

## What This SQL Does

1. Adds a `note_content` column to the `journal_notes` table (which is used in the code)
2. Copies data from the existing `note` column to the new `note_content` column
3. Removes the unique constraint on `(user_id, date)` to allow multiple entries per day
4. Adds a `pnl` column to store profit/loss data
5. Adds `emotion` and `tags` columns to match the interface in the code

## Code Changes Already Made

1. Updated the `loadDailyPnL` function to use `net_pnl` instead of `pnl` when querying the trades table
2. Created a migration file to update the journal_notes table schema

After running this SQL, the API errors should be resolved and you should be able to create multiple journal entries per day. 