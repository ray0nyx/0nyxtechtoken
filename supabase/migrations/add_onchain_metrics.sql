-- Create onchain_metrics table to store historical on-chain data
CREATE TABLE IF NOT EXISTS onchain_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blockchain TEXT NOT NULL CHECK (blockchain IN ('bitcoin', 'solana')),
  metric_name TEXT NOT NULL,
  value JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blockchain, metric_name, timestamp)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onchain_metrics_blockchain ON onchain_metrics(blockchain);
CREATE INDEX IF NOT EXISTS idx_onchain_metrics_name ON onchain_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_onchain_metrics_timestamp ON onchain_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_onchain_metrics_lookup ON onchain_metrics(blockchain, metric_name, timestamp DESC);

-- Enable RLS
ALTER TABLE onchain_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read metrics
CREATE POLICY "Authenticated users can read onchain metrics"
  ON onchain_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to get latest metric value
CREATE OR REPLACE FUNCTION get_latest_onchain_metric(
  p_blockchain TEXT,
  p_metric_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
  FROM onchain_metrics
  WHERE blockchain = p_blockchain
    AND metric_name = p_metric_name
  ORDER BY timestamp DESC
  LIMIT 1;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get metric history
CREATE OR REPLACE FUNCTION get_onchain_metric_history(
  p_blockchain TEXT,
  p_metric_name TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  metric_timestamp TIMESTAMPTZ,
  value JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.timestamp AS metric_timestamp,
    om.value
  FROM onchain_metrics om
  WHERE om.blockchain = p_blockchain
    AND om.metric_name = p_metric_name
    AND om.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY om.timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_onchain_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM onchain_metrics
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

