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