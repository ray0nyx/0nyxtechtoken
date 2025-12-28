-- Drop the existing journal_notes table
DROP TABLE IF EXISTS public.journal_notes CASCADE;

-- Create the journal_notes table with the correct schema
CREATE TABLE public.journal_notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
    date date NOT NULL,
    note_content text NOT NULL,
    tags text[],
    emotion varchar(50),
    pnl numeric,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Add RLS policies
ALTER TABLE public.journal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal notes"
    ON public.journal_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journal notes"
    ON public.journal_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal notes"
    ON public.journal_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal notes"
    ON public.journal_notes FOR DELETE
    USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.journal_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 