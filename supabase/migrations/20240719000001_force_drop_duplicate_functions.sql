-- Use a DO block to drop all versions of process_tradovate_csv_row regardless of parameter signature
DO $$
DECLARE
    func record;
BEGIN
    -- Find all functions named process_tradovate_csv_row and drop them
    FOR func IN 
        SELECT ns.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        INNER JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE p.proname = 'process_tradovate_csv_row'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', 
                       func.schema_name, 
                       func.function_name, 
                       func.args);
        RAISE NOTICE 'Dropped function %I.%I(%s)', 
                     func.schema_name, 
                     func.function_name, 
                     func.args;
    END LOOP;
END $$;

-- Now create a fresh version of the function
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
    
    -- If account_id is NULL, try to find a default account for the user or create a default one
    IF v_account_id IS NULL THEN
        -- Try to find an existing account
        SELECT id INTO v_account_id
        FROM accounts
        WHERE user_id = p_user_id
        LIMIT 1;
        
        -- If no account found, create a default one
        IF v_account_id IS NULL THEN
            INSERT INTO accounts (
                user_id,
                name,
                platform
            ) VALUES (
                p_user_id,
                'Default Account',
                'tradovate'
            )
            RETURNING id INTO v_account_id;
        END IF;
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