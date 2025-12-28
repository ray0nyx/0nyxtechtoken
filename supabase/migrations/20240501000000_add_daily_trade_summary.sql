-- Create daily_trade_summary table
CREATE TABLE IF NOT EXISTS public.daily_trade_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  total_trades INTEGER NOT NULL,
  daily_gross_pnl DECIMAL(10, 2) NOT NULL,
  daily_net_pnl DECIMAL(10, 2) NOT NULL,
  avg_trade_pnl DECIMAL(10, 2) NOT NULL,
  worst_trade DECIMAL(10, 2) NOT NULL,
  best_trade DECIMAL(10, 2) NOT NULL,
  winning_trades INTEGER NOT NULL,
  losing_trades INTEGER NOT NULL,
  avg_duration DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Add a unique constraint to prevent duplicate entries for the same date and user
  UNIQUE (user_id, trade_date)
);

-- Add RLS policies
ALTER TABLE public.daily_trade_summary ENABLE ROW LEVEL SECURITY;

-- Policy for users to view only their own summaries
CREATE POLICY "Users can view their own daily summaries"
  ON public.daily_trade_summary
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own summaries
CREATE POLICY "Users can insert their own daily summaries"
  ON public.daily_trade_summary
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own summaries
CREATE POLICY "Users can update their own daily summaries"
  ON public.daily_trade_summary
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for users to delete their own summaries
CREATE POLICY "Users can delete their own daily summaries"
  ON public.daily_trade_summary
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add this table to the public schema
GRANT ALL ON public.daily_trade_summary TO authenticated;
GRANT ALL ON public.daily_trade_summary TO service_role; 