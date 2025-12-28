-- Create alerting and monitoring system tables
-- This migration creates tables for risk alerts, notification settings, and monitoring

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('greater_than', 'less_than', 'equals', 'not_equals')),
  threshold DECIMAL NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notification_channels TEXT[] DEFAULT '{"in_app"}' CHECK (notification_channels <@ ARRAY['email', 'push', 'in_app']),
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  current_value DECIMAL NOT NULL,
  threshold_value DECIMAL NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email BOOLEAN DEFAULT TRUE,
  push BOOLEAN DEFAULT TRUE,
  in_app BOOLEAN DEFAULT TRUE,
  email_frequency TEXT DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'hourly', 'daily')),
  quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00", "timezone": "UTC"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create risk_metrics_history table for tracking historical risk data
CREATE TABLE IF NOT EXISTS risk_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_exposure DECIMAL DEFAULT 0,
  net_exposure DECIMAL DEFAULT 0,
  gross_exposure DECIMAL DEFAULT 0,
  leverage DECIMAL DEFAULT 0,
  max_drawdown DECIMAL DEFAULT 0,
  current_drawdown DECIMAL DEFAULT 0,
  var_95 DECIMAL DEFAULT 0,
  var_99 DECIMAL DEFAULT 0,
  expected_shortfall DECIMAL DEFAULT 0,
  sharpe_ratio DECIMAL DEFAULT 0,
  sortino_ratio DECIMAL DEFAULT 0,
  calmar_ratio DECIMAL DEFAULT 0,
  concentration_risk DECIMAL DEFAULT 0,
  correlation_risk DECIMAL DEFAULT 0,
  volatility DECIMAL DEFAULT 0,
  win_rate DECIMAL DEFAULT 0,
  daily_pnl DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_active ON alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_history_user_id ON risk_metrics_history(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_history_date ON risk_metrics_history(date DESC);

-- Enable RLS
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_metrics_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_rules
CREATE POLICY "Users can view their own alert rules" ON alert_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert rules" ON alert_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert rules" ON alert_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert rules" ON alert_rules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for alerts
CREATE POLICY "Users can view their own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts" ON alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON alerts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notification_settings
CREATE POLICY "Users can view their own notification settings" ON notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings" ON notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings" ON notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification settings" ON notification_settings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for risk_metrics_history
CREATE POLICY "Users can view their own risk metrics history" ON risk_metrics_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own risk metrics history" ON risk_metrics_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own risk metrics history" ON risk_metrics_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own risk metrics history" ON risk_metrics_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_alert_rules_updated_at 
  BEFORE UPDATE ON alert_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at 
  BEFORE UPDATE ON alerts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at 
  BEFORE UPDATE ON notification_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up old alerts
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
  -- Delete resolved alerts older than 30 days
  DELETE FROM alerts 
  WHERE status = 'resolved' 
  AND resolved_at < NOW() - INTERVAL '30 days';
  
  -- Delete acknowledged alerts older than 7 days
  DELETE FROM alerts 
  WHERE status = 'acknowledged' 
  AND acknowledged_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to check and trigger alerts
CREATE OR REPLACE FUNCTION check_risk_alerts()
RETURNS void AS $$
DECLARE
  rule_record RECORD;
  current_value DECIMAL;
  should_trigger BOOLEAN;
  recent_alert_exists BOOLEAN;
BEGIN
  -- Loop through all active alert rules
  FOR rule_record IN 
    SELECT * FROM alert_rules 
    WHERE is_active = TRUE
  LOOP
    -- Get current value for the metric (this would be populated by the application)
    -- For now, we'll skip this as it requires real-time data
    CONTINUE;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to get alert summary
CREATE OR REPLACE FUNCTION get_alert_summary(user_uuid UUID)
RETURNS TABLE (
  total_alerts BIGINT,
  active_alerts BIGINT,
  critical_alerts BIGINT,
  high_alerts BIGINT,
  medium_alerts BIGINT,
  low_alerts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE status = 'active') as active_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active') as critical_alerts,
    COUNT(*) FILTER (WHERE severity = 'high' AND status = 'active') as high_alerts,
    COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'active') as medium_alerts,
    COUNT(*) FILTER (WHERE severity = 'low' AND status = 'active') as low_alerts
  FROM alerts 
  WHERE user_id = user_uuid
  AND triggered_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Insert default alert rules for new users
CREATE OR REPLACE FUNCTION create_default_alert_rules()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_rules (user_id, name, description, metric, operator, threshold, severity, notification_channels, cooldown_minutes)
  VALUES 
    (NEW.id, 'High Drawdown Alert', 'Alert when portfolio drawdown exceeds 15%', 'max_drawdown', 'greater_than', 15, 'high', ARRAY['email', 'push', 'in_app'], 60),
    (NEW.id, 'Leverage Warning', 'Warning when leverage exceeds 2.0x', 'leverage', 'greater_than', 2.0, 'medium', ARRAY['push', 'in_app'], 30),
    (NEW.id, 'Win Rate Drop', 'Alert when win rate drops below 40%', 'win_rate', 'less_than', 40, 'medium', ARRAY['email', 'in_app'], 120),
    (NEW.id, 'High Volatility', 'Alert when portfolio volatility exceeds 25%', 'volatility', 'greater_than', 25, 'high', ARRAY['email', 'push', 'in_app'], 60),
    (NEW.id, 'Concentration Risk', 'Alert when concentration risk exceeds 50%', 'concentration_risk', 'greater_than', 50, 'medium', ARRAY['in_app'], 240),
    (NEW.id, 'Daily Loss Limit', 'Alert when daily loss exceeds $5,000', 'daily_pnl', 'less_than', -5000, 'critical', ARRAY['email', 'push', 'in_app'], 15);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create default alert rules for new users
CREATE TRIGGER create_default_alert_rules_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_alert_rules();
