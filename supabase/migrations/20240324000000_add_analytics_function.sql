-- Create analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.analytics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    total_trades integer DEFAULT 0,
    winning_trades integer DEFAULT 0,
    losing_trades integer DEFAULT 0,
    win_rate numeric(5,2) DEFAULT 0,
    total_pnl numeric(20,2) DEFAULT 0,
    average_win numeric(20,2) DEFAULT 0,
    average_loss numeric(20,2) DEFAULT 0,
    largest_win numeric(20,2) DEFAULT 0,
    largest_loss numeric(20,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Add RLS policies to analytics table
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users"
    ON public.analytics
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create the populate_analytics_table function
CREATE OR REPLACE FUNCTION public.populate_analytics_table(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert or update analytics for the current date
    INSERT INTO public.analytics (
        user_id,
        date,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        total_pnl,
        average_win,
        average_loss,
        largest_win,
        largest_loss,
        updated_at
    )
    WITH trade_stats AS (
        SELECT
            COUNT(*) as total_trades,
            COUNT(CASE WHEN net_pnl > 0 THEN 1 END) as winning_trades,
            COUNT(CASE WHEN net_pnl < 0 THEN 1 END) as losing_trades,
            ROUND(
                (COUNT(CASE WHEN net_pnl > 0 THEN 1 END)::numeric / 
                NULLIF(COUNT(*), 0)::numeric * 100),
                2
            ) as win_rate,
            COALESCE(SUM(net_pnl), 0) as total_pnl,
            COALESCE(AVG(CASE WHEN net_pnl > 0 THEN net_pnl END), 0) as average_win,
            COALESCE(AVG(CASE WHEN net_pnl < 0 THEN net_pnl END), 0) as average_loss,
            COALESCE(MAX(CASE WHEN net_pnl > 0 THEN net_pnl END), 0) as largest_win,
            COALESCE(MIN(CASE WHEN net_pnl < 0 THEN net_pnl END), 0) as largest_loss
        FROM public.trades
        WHERE DATE(entry_date) = CURRENT_DATE
        AND user_id = user_uuid
    )
    SELECT
        user_uuid,
        CURRENT_DATE,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        total_pnl,
        average_win,
        average_loss,
        largest_win,
        largest_loss,
        now()
    FROM trade_stats
    ON CONFLICT (user_id, date) DO UPDATE
    SET
        total_trades = EXCLUDED.total_trades,
        winning_trades = EXCLUDED.winning_trades,
        losing_trades = EXCLUDED.losing_trades,
        win_rate = EXCLUDED.win_rate,
        total_pnl = EXCLUDED.total_pnl,
        average_win = EXCLUDED.average_win,
        average_loss = EXCLUDED.average_loss,
        largest_win = EXCLUDED.largest_win,
        largest_loss = EXCLUDED.largest_loss,
        updated_at = EXCLUDED.updated_at;
END;
$$; 