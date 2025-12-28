-- Drop existing tables and functions
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.broker_connections CASCADE;
DROP TABLE IF EXISTS public.journal_notes CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;

-- Create timestamp functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trades table
CREATE TABLE public.trades (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users NOT NULL,
    symbol text NOT NULL,
    position text NOT NULL CHECK (position IN ('long', 'short')),
    entry_date timestamp with time zone NOT NULL,
    exit_date timestamp with time zone,
    entry_price numeric(20, 2) NOT NULL,
    exit_price numeric(20, 2),
    quantity integer NOT NULL CHECK (quantity > 0),
    strategy text NOT NULL DEFAULT 'Default',
    broker text NOT NULL DEFAULT 'Unknown',
    notes text,
    tags text[],
    fees numeric(20, 2) DEFAULT 0,
    net_pnl numeric(20, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN position = 'long' THEN (exit_price - entry_price) * quantity - COALESCE(fees, 0)
            WHEN position = 'short' THEN (entry_price - exit_price) * quantity - COALESCE(fees, 0)
        END
    ) STORED,
    broker_trade_id text UNIQUE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS to trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades"
    ON public.trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
    ON public.trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
    ON public.trades FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
    ON public.trades FOR DELETE
    USING (auth.uid() = user_id);

-- Create trades indexes
CREATE INDEX trades_user_id_idx ON public.trades(user_id);
CREATE INDEX trades_entry_date_idx ON public.trades(entry_date);
CREATE INDEX trades_symbol_idx ON public.trades(symbol);

-- Add trades updated_at trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Create broker_connections table
CREATE TABLE public.broker_connections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    broker_name text NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, broker_name)
);

-- Add RLS to broker_connections
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own broker connections"
    ON public.broker_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own broker connections"
    ON public.broker_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broker connections"
    ON public.broker_connections FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broker connections"
    ON public.broker_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Create journal_notes table
CREATE TABLE public.journal_notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Add RLS to journal_notes
ALTER TABLE public.journal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal notes"
    ON public.journal_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journal notes"
    ON public.journal_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal notes"
    ON public.journal_notes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal notes"
    ON public.journal_notes FOR DELETE
    USING (auth.uid() = user_id);

-- Add journal_notes updated_at trigger
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.journal_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 