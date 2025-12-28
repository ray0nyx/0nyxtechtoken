-- Create user_trade_metrics table for analytics tracking
-- This table stores user interaction events and session data

CREATE TABLE IF NOT EXISTS public.user_trade_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id text,
    event_type text NOT NULL,
    event_details jsonb DEFAULT '{}'::jsonb,
    page_path text,
    session_duration_sec integer,
    client_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_user_id ON public.user_trade_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_event_type ON public.user_trade_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_created_at ON public.user_trade_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_session_id ON public.user_trade_metrics(session_id);

-- Enable RLS
ALTER TABLE public.user_trade_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only access their own trade metrics" 
ON public.user_trade_metrics
FOR ALL
USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role can access all trade metrics" 
ON public.user_trade_metrics
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_trade_metrics_updated_at 
    BEFORE UPDATE ON public.user_trade_metrics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
