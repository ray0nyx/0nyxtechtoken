-- Create whale_alerts table for tracking large transactions
CREATE TABLE IF NOT EXISTS whale_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blockchain TEXT NOT NULL CHECK (blockchain IN ('solana', 'bitcoin')),
  tx_hash TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(28, 18) NOT NULL,
  usd_value DECIMAL(20, 2),
  token_symbol TEXT,
  token_address TEXT,
  direction TEXT CHECK (direction IN ('inflow', 'outflow', 'transfer')),
  from_label TEXT,
  to_label TEXT,
  from_category TEXT,
  to_category TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blockchain, tx_hash, from_address, to_address)
);

-- Create user whale alert subscriptions
CREATE TABLE IF NOT EXISTS whale_alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_usd_value DECIMAL(20, 2) DEFAULT 100000,
  categories TEXT[] DEFAULT ARRAY['exchange', 'whale', 'smart_money'],
  blockchains TEXT[] DEFAULT ARRAY['solana', 'bitcoin'],
  notify_email BOOLEAN DEFAULT false,
  notify_in_app BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create user notifications table
CREATE TABLE IF NOT EXISTS whale_alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES whale_alerts(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whale_alerts_blockchain ON whale_alerts(blockchain);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_timestamp ON whale_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_usd_value ON whale_alerts(usd_value DESC);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_from_category ON whale_alerts(from_category);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_to_category ON whale_alerts(to_category);
CREATE INDEX IF NOT EXISTS idx_whale_alert_subscriptions_user_id ON whale_alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_whale_alert_notifications_user_id ON whale_alert_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_whale_alert_notifications_read ON whale_alert_notifications(is_read);

-- Enable RLS
ALTER TABLE whale_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whale_alert_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whale_alerts (public read)
CREATE POLICY "Anyone can view whale alerts"
  ON whale_alerts FOR SELECT
  USING (true);

-- Service role can insert whale alerts
CREATE POLICY "Service role can manage whale alerts"
  ON whale_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for whale_alert_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON whale_alert_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
  ON whale_alert_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON whale_alert_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON whale_alert_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for whale_alert_notifications
CREATE POLICY "Users can view their own notifications"
  ON whale_alert_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can create notifications"
  ON whale_alert_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update their own notifications"
  ON whale_alert_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to create notifications for subscribed users
CREATE OR REPLACE FUNCTION notify_whale_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notifications for users who have subscriptions matching this alert
  INSERT INTO whale_alert_notifications (user_id, alert_id)
  SELECT 
    user_id,
    NEW.id
  FROM whale_alert_subscriptions
  WHERE is_active = true
    AND NEW.usd_value >= min_usd_value
    AND NEW.blockchain = ANY(blockchains)
    AND (
      NEW.from_category = ANY(categories) 
      OR NEW.to_category = ANY(categories)
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create notifications
CREATE TRIGGER whale_alert_notification_trigger
  AFTER INSERT ON whale_alerts
  FOR EACH ROW
  EXECUTE FUNCTION notify_whale_alert();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_whale_alert_subscriptions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_whale_alert_subscriptions_timestamp_trigger
  BEFORE UPDATE ON whale_alert_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_whale_alert_subscriptions_timestamp();

