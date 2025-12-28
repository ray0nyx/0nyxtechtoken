-- Migration: Add risk acknowledgments and price alerts tables
-- Created: 2025-01-XX
-- Description: Tables for tracking user risk acknowledgments and price alerts

-- User risk acknowledgments table
CREATE TABLE IF NOT EXISTS public.user_risk_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledgment_type TEXT NOT NULL, -- 'meme_coin_risk', 'trading_agreement', 'general_risk', etc.
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  version TEXT, -- Version of the agreement/terms
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one acknowledgment per type per user (can update)
  UNIQUE(user_id, acknowledgment_type)
);

-- Price alerts table
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_symbol TEXT NOT NULL, -- e.g., 'BONK/SOL'
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  threshold_price DECIMAL(30, 18) NOT NULL, -- Support very small prices for meme coins
  is_active BOOLEAN DEFAULT true,
  notification_method TEXT DEFAULT 'email' CHECK (notification_method IN ('email', 'push', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  
  -- Indexes for performance
  CONSTRAINT valid_threshold CHECK (threshold_price > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_risk_acknowledgments_user_id 
  ON public.user_risk_acknowledgments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_risk_acknowledgments_type 
  ON public.user_risk_acknowledgments(acknowledgment_type);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id 
  ON public.price_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active 
  ON public.price_alerts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_price_alerts_pair_symbol 
  ON public.price_alerts(pair_symbol);

CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered 
  ON public.price_alerts(triggered_at) WHERE triggered_at IS NULL;

-- RLS Policies for user_risk_acknowledgments
ALTER TABLE public.user_risk_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own risk acknowledgments"
  ON public.user_risk_acknowledgments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk acknowledgments"
  ON public.user_risk_acknowledgments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own risk acknowledgments"
  ON public.user_risk_acknowledgments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for price_alerts
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own price alerts"
  ON public.price_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price alerts"
  ON public.price_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own price alerts"
  ON public.price_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own price alerts"
  ON public.price_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_risk_acknowledgments
CREATE TRIGGER update_user_risk_acknowledgments_updated_at
  BEFORE UPDATE ON public.user_risk_acknowledgments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.user_risk_acknowledgments IS 'Tracks user acknowledgments of risk warnings and agreements';
COMMENT ON TABLE public.price_alerts IS 'Stores user price alerts for cryptocurrency pairs';
COMMENT ON COLUMN public.user_risk_acknowledgments.acknowledgment_type IS 'Type of acknowledgment: meme_coin_risk, trading_agreement, general_risk, etc.';
COMMENT ON COLUMN public.price_alerts.threshold_price IS 'Price threshold in base currency (supports very small values for meme coins)';
