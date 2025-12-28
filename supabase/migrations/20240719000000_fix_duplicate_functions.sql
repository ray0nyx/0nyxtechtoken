-- First, drop all existing process_tradovate_csv_row functions
DROP FUNCTION IF EXISTS public.process_tradovate_csv_row(uuid, text, timestamp without time zone, timestamp without time zone, text, text, text, text, text, text, text, timestamp without time zone, timestamp without time zone, interval, uuid);

-- Create a single correct version of the function
CREATE OR REPLACE FUNCTION public.process_tradovate_csv_row(
    p_user_id uuid,
    p_symbol text,
    p_entry_date timestamp without time zone,
    p_exit_date timestamp without time zone,
    p_quantity text,
    p_position text,
    p_entry_price text,
    p_buy_fill_id text,
    p_sell_fill_id text,
    p_exit_price text,
    p_fees text,
    p_bought_timestamp timestamp without time zone,
    p_sold_timestamp timestamp without time zone,
    p_duration interval,
    p_account_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_trade_id UUID;
    v_quantity NUMERIC;
    v_entry_price NUMERIC;
    v_exit_price NUMERIC;
    v_fees NUMERIC;
    v_pnl NUMERIC;
    v_position_type TEXT;
    v_account_id UUID := p_account_id;
BEGIN
    -- Convert text inputs to numeric values
    BEGIN
        v_quantity := p_quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_quantity := 1;
    END;
    
    BEGIN
        v_entry_price := p_entry_price::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_entry_price := 0;
    END;
    
    BEGIN
        v_exit_price := p_exit_price::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_exit_price := 0;
    END;
    
    BEGIN
        v_fees := p_fees::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_fees := 0;
    END;
    
    -- Normalize position type
    v_position_type := LOWER(p_position);
    IF v_position_type NOT IN ('long', 'short') THEN
        v_position_type := 'long';
    END IF;
    
    -- Calculate P&L based on position type
    IF v_position_type = 'long' THEN
        v_pnl := (v_exit_price - v_entry_price) * v_quantity - v_fees;
    ELSE
        v_pnl := (v_entry_price - v_exit_price) * v_quantity - v_fees;
    END IF;
    
    -- If account_id is NULL, try to find a default account for the user
    IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = p_user_id
        LIMIT 1;
    END IF;
    
    -- Insert the trade into the trades table
    INSERT INTO trades (
        user_id,
        account_id,
        symbol,
        entry_date,
        exit_date,
        quantity,
        position,
        entry_price,
        exit_price,
        fees,
        pnl,
        buy_fill_id,
        sell_fill_id,
        bought_timestamp,
        sold_timestamp,
        duration,
        platform,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        v_account_id,
        p_symbol,
        p_entry_date,
        p_exit_date,
        v_quantity,
        v_position_type,
        v_entry_price,
        v_exit_price,
        v_fees,
        v_pnl,
        p_buy_fill_id,
        p_sell_fill_id,
        p_bought_timestamp,
        p_sold_timestamp,
        p_duration,
        'tradovate',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_trade_id;
    
    -- Update analytics for the user
    PERFORM update_analytics_for_user(p_user_id);
    
    RETURN v_trade_id;
END;
$$;

-- Create the accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT,
    platform TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy to allow users to access their own accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_user_policy ON public.accounts;
CREATE POLICY account_user_policy ON public.accounts 
    FOR ALL 
    TO authenticated 
    USING (user_id = auth.uid());

-- Allow querying on accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated; 