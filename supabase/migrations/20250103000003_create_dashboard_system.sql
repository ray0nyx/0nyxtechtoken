-- Create dashboard system tables
-- This migration creates tables for custom user dashboards

-- Create user_dashboards table
CREATE TABLE IF NOT EXISTS user_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  widgets JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '[]',
  time_range JSONB NOT NULL DEFAULT '{"type": "preset", "value": "30d"}',
  layout TEXT NOT NULL DEFAULT 'grid' CHECK (layout IN ('grid', 'freeform')),
  is_public BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboard_widgets table for reusable widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('kpi', 'chart', 'table', 'heatmap')),
  config JSONB NOT NULL DEFAULT '{}',
  data_source TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboard_templates table for preset templates
CREATE TABLE IF NOT EXISTS dashboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  widgets JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_dashboards_user_id ON user_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_updated_at ON user_dashboards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_is_public ON user_dashboards(is_public);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user_id ON dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(type);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_category ON dashboard_templates(category);

-- Enable RLS
ALTER TABLE user_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_dashboards
CREATE POLICY "Users can view their own dashboards" ON user_dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public dashboards" ON user_dashboards
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can insert their own dashboards" ON user_dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards" ON user_dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards" ON user_dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboard_widgets
CREATE POLICY "Users can view their own widgets" ON dashboard_widgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public widgets" ON dashboard_widgets
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can insert their own widgets" ON dashboard_widgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widgets" ON dashboard_widgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widgets" ON dashboard_widgets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboard_templates
CREATE POLICY "Anyone can view system templates" ON dashboard_templates
  FOR SELECT USING (is_system = TRUE);

CREATE POLICY "Users can view their own templates" ON dashboard_templates
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own templates" ON dashboard_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own templates" ON dashboard_templates
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own templates" ON dashboard_templates
  FOR DELETE USING (auth.uid() = created_by);

-- Insert default system templates
INSERT INTO dashboard_templates (name, description, category, widgets, is_system) VALUES
(
  'Performance Overview',
  'Key performance metrics and trends for trading analysis',
  'Performance',
  '[
    {
      "id": "total-pnl",
      "type": "kpi",
      "title": "Total P&L",
      "position": {"x": 0, "y": 0, "w": 2, "h": 1},
      "config": {
        "metric": "total_pnl",
        "format": "currency",
        "color": "green",
        "size": "medium"
      }
    },
    {
      "id": "win-rate",
      "type": "kpi",
      "title": "Win Rate",
      "position": {"x": 2, "y": 0, "w": 2, "h": 1},
      "config": {
        "metric": "win_rate",
        "format": "percentage",
        "color": "blue",
        "size": "medium"
      }
    },
    {
      "id": "monthly-returns",
      "type": "chart",
      "title": "Monthly Returns",
      "position": {"x": 0, "y": 1, "w": 4, "h": 3},
      "config": {
        "type": "line",
        "dataSource": "monthly_pnl",
        "xAxis": "month",
        "yAxis": "pnl",
        "colors": ["#8884d8"],
        "showLegend": true,
        "showGrid": true,
        "showTooltip": true
      }
    }
  ]'::jsonb,
  TRUE
),
(
  'Trading Activity',
  'Trading patterns and activity analysis',
  'Activity',
  '[
    {
      "id": "trades-heatmap",
      "type": "heatmap",
      "title": "Trades by Hour & Day",
      "position": {"x": 0, "y": 0, "w": 4, "h": 3},
      "config": {
        "type": "hour_day",
        "valueField": "count",
        "aggregation": "count",
        "colorScheme": "blue_red",
        "showValues": true,
        "showTooltip": true
      }
    },
    {
      "id": "daily-trades",
      "type": "chart",
      "title": "Daily Trade Count",
      "position": {"x": 4, "y": 0, "w": 4, "h": 3},
      "config": {
        "type": "bar",
        "dataSource": "daily_trades",
        "xAxis": "date",
        "yAxis": "count",
        "colors": ["#82ca9d"],
        "showLegend": false,
        "showGrid": true,
        "showTooltip": true
      }
    }
  ]'::jsonb,
  TRUE
),
(
  'Strategy Analysis',
  'Performance breakdown by strategy and asset',
  'Strategy',
  '[
    {
      "id": "strategy-pnl",
      "type": "chart",
      "title": "P&L by Strategy",
      "position": {"x": 0, "y": 0, "w": 3, "h": 3},
      "config": {
        "type": "pie",
        "dataSource": "strategy_performance",
        "xAxis": "strategy",
        "yAxis": "pnl",
        "colors": ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"],
        "showLegend": true,
        "showTooltip": true
      }
    },
    {
      "id": "strategy-heatmap",
      "type": "heatmap",
      "title": "Strategy vs Asset Performance",
      "position": {"x": 3, "y": 0, "w": 5, "h": 3},
      "config": {
        "type": "strategy_asset",
        "valueField": "pnl",
        "aggregation": "sum",
        "colorScheme": "green_red",
        "showValues": true,
        "showTooltip": true
      }
    }
  ]'::jsonb,
  TRUE
),
(
  'Risk Management',
  'Risk metrics and exposure analysis',
  'Risk',
  '[
    {
      "id": "max-drawdown",
      "type": "kpi",
      "title": "Max Drawdown",
      "position": {"x": 0, "y": 0, "w": 2, "h": 1},
      "config": {
        "metric": "max_drawdown",
        "format": "percentage",
        "color": "red",
        "size": "medium"
      }
    },
    {
      "id": "sharpe-ratio",
      "type": "kpi",
      "title": "Sharpe Ratio",
      "position": {"x": 2, "y": 0, "w": 2, "h": 1},
      "config": {
        "metric": "sharpe_ratio",
        "format": "decimal",
        "color": "blue",
        "size": "medium"
      }
    },
    {
      "id": "exposure-chart",
      "type": "chart",
      "title": "Exposure by Asset Class",
      "position": {"x": 0, "y": 1, "w": 4, "h": 3},
      "config": {
        "type": "bar",
        "dataSource": "asset_exposure",
        "xAxis": "asset_class",
        "yAxis": "exposure",
        "colors": ["#ff6b6b", "#4ecdc4", "#45b7d1"],
        "showLegend": false,
        "showGrid": true,
        "showTooltip": true
      }
    }
  ]'::jsonb,
  TRUE
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_dashboards_updated_at 
  BEFORE UPDATE ON user_dashboards 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at 
  BEFORE UPDATE ON dashboard_widgets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_templates_updated_at 
  BEFORE UPDATE ON dashboard_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
