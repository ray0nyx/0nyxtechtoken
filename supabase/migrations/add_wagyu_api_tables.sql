-- Migration: Add WagyuTech API tables
-- Created: 2025-01-XX
-- Description: Tables for API keys, subscriptions, usage tracking, trading fees, and monitoring

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE, -- Hashed API key (never store plain text)
  key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "wgy_xxxx")
  name TEXT, -- User-friendly name for the key
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
  permissions JSONB DEFAULT '{}', -- Fine-grained permissions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  
  -- Indexes
  CONSTRAINT valid_rate_limits CHECK (rate_limit_per_minute > 0 AND rate_limit_per_hour > 0)
);

-- API Usage Logs
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API Subscriptions
CREATE TABLE IF NOT EXISTS public.api_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One active subscription per user
  UNIQUE(user_id, status) WHERE status = 'active'
);

-- Trading Fees
CREATE TABLE IF NOT EXISTS public.trading_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  order_id UUID, -- Reference to order/trade
  pair_symbol TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit')),
  order_amount DECIMAL(30, 18) NOT NULL, -- Order amount in base currency
  fee_amount DECIMAL(30, 18) NOT NULL, -- Fee amount in USD
  fee_percentage DECIMAL(5, 4) NOT NULL, -- Fee percentage (e.g., 0.0050 for 0.5%)
  user_tier TEXT NOT NULL, -- Tier at time of trade
  transaction_hash TEXT, -- Blockchain transaction hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monitoring Subscriptions
CREATE TABLE IF NOT EXISTS public.monitoring_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('pump_fun_migration', 'social_signal', 'new_token', 'liquidity_change', 'large_transaction')),
  filters JSONB DEFAULT '{}', -- Filter criteria (e.g., min_volume, tokens, etc.)
  webhook_url TEXT, -- Optional webhook for real-time notifications
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monitoring Events
CREATE TABLE IF NOT EXISTS public.monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.monitoring_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  token_symbol TEXT,
  token_address TEXT,
  pair_address TEXT,
  event_data JSONB NOT NULL, -- Flexible event data structure
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social Signals Cache
CREATE TABLE IF NOT EXISTS public.social_signals_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_symbol TEXT NOT NULL,
  token_address TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'telegram', 'reddit', 'discord')),
  signal_type TEXT NOT NULL, -- 'mention', 'sentiment', 'volume_spike', etc.
  signal_data JSONB NOT NULL,
  sentiment_score DECIMAL(3, 2), -- -1 to 1
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Index for quick lookups
  UNIQUE(token_symbol, platform, signal_type, created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON public.api_keys(tier);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON public.api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON public.api_usage_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_subscriptions_user_id ON public.api_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_subscriptions_status ON public.api_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_api_subscriptions_stripe_id ON public.api_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trading_fees_user_id ON public.trading_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_fees_created_at ON public.trading_fees(created_at);
CREATE INDEX IF NOT EXISTS idx_trading_fees_order_id ON public.trading_fees(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monitoring_subscriptions_user_id ON public.monitoring_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_subscriptions_type ON public.monitoring_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_subscriptions_active ON public.monitoring_subscriptions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_monitoring_events_subscription_id ON public.monitoring_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_created_at ON public.monitoring_events(created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_token_symbol ON public.monitoring_events(token_symbol) WHERE token_symbol IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_signals_token_symbol ON public.social_signals_cache(token_symbol);
CREATE INDEX IF NOT EXISTS idx_social_signals_platform ON public.social_signals_cache(platform);
CREATE INDEX IF NOT EXISTS idx_social_signals_created_at ON public.social_signals_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_social_signals_expires_at ON public.social_signals_cache(expires_at);

-- RLS Policies for api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for api_usage_logs
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API usage logs"
  ON public.api_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for api_subscriptions
ALTER TABLE public.api_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.api_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.api_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.api_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for trading_fees
ALTER TABLE public.trading_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trading fees"
  ON public.trading_fees FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for monitoring_subscriptions
ALTER TABLE public.monitoring_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own monitoring subscriptions"
  ON public.monitoring_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for monitoring_events
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monitoring events"
  ON public.monitoring_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.monitoring_subscriptions
      WHERE monitoring_subscriptions.id = monitoring_events.subscription_id
      AND monitoring_subscriptions.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_api_subscriptions_updated_at
  BEFORE UPDATE ON public.api_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_api_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION update_monitoring_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monitoring_subscriptions_updated_at
  BEFORE UPDATE ON public.monitoring_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_subscriptions_updated_at();

-- Function to clean up expired social signals
CREATE OR REPLACE FUNCTION cleanup_expired_social_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM public.social_signals_cache
  WHERE expires_at < now();
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE public.api_keys IS 'API keys for WagyuTech API authentication';
COMMENT ON TABLE public.api_usage_logs IS 'Logs all API requests for usage tracking and analytics';
COMMENT ON TABLE public.api_subscriptions IS 'User subscription tiers for API access';
COMMENT ON TABLE public.trading_fees IS 'Tracks trading fees charged to users';
COMMENT ON TABLE public.monitoring_subscriptions IS 'User subscriptions to on-chain and social monitoring events';
COMMENT ON TABLE public.monitoring_events IS 'Stores monitoring events (Pump.fun migrations, social signals, etc.)';
COMMENT ON TABLE public.social_signals_cache IS 'Cached social media signals for tokens';

COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key (never store plain text)';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters for display purposes (e.g., "wgy_xxxx")';
COMMENT ON COLUMN public.trading_fees.fee_percentage IS 'Fee percentage as decimal (0.0050 = 0.5%)';
