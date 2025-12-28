-- Add missing analytics columns to user_trade_metrics table
-- The table exists but is missing the columns needed for analytics tracking

-- Add the missing columns
ALTER TABLE public.user_trade_metrics 
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS event_details jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS page_path text,
ADD COLUMN IF NOT EXISTS session_duration_sec integer,
ADD COLUMN IF NOT EXISTS client_info jsonb DEFAULT '{}'::jsonb;

-- Create indexes for better performance on the new columns
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_event_type ON public.user_trade_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_session_id ON public.user_trade_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_user_trade_metrics_created_at ON public.user_trade_metrics(created_at);

-- Update the table to make event_type NOT NULL for new records
-- First, set a default value for existing records
UPDATE public.user_trade_metrics 
SET event_type = 'legacy_metric' 
WHERE event_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.user_trade_metrics 
ALTER COLUMN event_type SET NOT NULL;
