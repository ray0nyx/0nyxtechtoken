-- Marketplace System Migration
-- Creates tables for trading guides, signals, and algorithm marketplace

-- 1. Marketplace Categories
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES marketplace_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Marketplace Products (Guides, Templates, Scripts)
CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES marketplace_categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('guide', 'template', 'script', 'indicator', 'strategy')),
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_digital BOOLEAN DEFAULT true,
  file_urls JSONB DEFAULT '[]',
  preview_images JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  performance_data JSONB DEFAULT '{}',
  historical_performance JSONB DEFAULT '{}',
  risk_warning TEXT,
  disclaimer TEXT,
  requirements TEXT,
  installation_instructions TEXT,
  support_info TEXT,
  download_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Signal Subscriptions
CREATE TABLE IF NOT EXISTS signal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('monthly', 'yearly', 'lifetime')),
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Signal Broadcasts
CREATE TABLE IF NOT EXISTS signal_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('buy', 'sell', 'hold', 'alert')),
  entry_price DECIMAL(15,6),
  stop_loss DECIMAL(15,6),
  take_profit DECIMAL(15,6),
  timeframe TEXT,
  reasoning TEXT,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  confidence_score INTEGER CHECK (confidence_score >= 1 AND confidence_score <= 10),
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Algorithm Marketplace
CREATE TABLE IF NOT EXISTS algorithm_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  programming_language TEXT NOT NULL,
  framework TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  license_type TEXT NOT NULL CHECK (license_type IN ('single_use', 'commercial', 'enterprise', 'open_source')),
  file_urls JSONB DEFAULT '[]',
  documentation_url TEXT,
  github_url TEXT,
  requirements JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  backtest_results JSONB DEFAULT '{}',
  risk_metrics JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  download_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Marketplace Orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('guide', 'template', 'script', 'indicator', 'strategy', 'signal_subscription', 'algorithm')),
  product_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('one_time', 'subscription', 'license')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  platform_fee DECIMAL(10,2) DEFAULT 0,
  seller_payout DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'delivered', 'cancelled', 'refunded')),
  payment_intent_id TEXT,
  stripe_session_id TEXT,
  download_urls JSONB DEFAULT '[]',
  license_key TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Product Reviews
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_type TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT,
  pros TEXT[],
  cons TEXT[],
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Signal Performance Tracking
CREATE TABLE IF NOT EXISTS signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES signal_broadcasts(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  entry_price DECIMAL(15,6),
  exit_price DECIMAL(15,6),
  pnl DECIMAL(15,6),
  pnl_percentage DECIMAL(8,4),
  duration_hours INTEGER,
  status TEXT CHECK (status IN ('open', 'closed', 'stopped_out', 'take_profit')),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Marketplace Analytics
CREATE TABLE IF NOT EXISTS marketplace_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID,
  product_type TEXT,
  metric_type TEXT NOT NULL,
  metric_value DECIMAL(15,6) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Legal Disclaimers and Compliance
CREATE TABLE IF NOT EXISTS marketplace_disclaimers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  disclaimer_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version TEXT NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO marketplace_categories (name, description, icon) VALUES
('Trading Guides', 'Educational content and trading strategies', 'book'),
('Indicators', 'Technical analysis indicators and tools', 'chart'),
('Templates', 'Trading templates and checklists', 'file-text'),
('Scripts', 'Automated trading scripts and bots', 'code'),
('Signals', 'Real-time trading signals and alerts', 'bell'),
('Algorithms', 'Quantitative trading algorithms', 'cpu');

-- Insert default disclaimers
INSERT INTO marketplace_disclaimers (product_type, disclaimer_text, version, effective_date) VALUES
('guide', 'This educational content is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Trading involves risk and may not be suitable for all investors.', '1.0', CURRENT_DATE),
('signal', 'These signals are for informational purposes only and do not constitute investment advice. You must execute trades manually at your own risk. Past performance does not guarantee future results. Trading involves substantial risk of loss.', '1.0', CURRENT_DATE),
('algorithm', 'This software is provided as-is without warranty. Past performance does not guarantee future results. You are responsible for testing and validating any algorithm before use. Trading involves substantial risk of loss.', '1.0', CURRENT_DATE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_products_seller ON marketplace_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_category ON marketplace_products(category_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_type ON marketplace_products(product_type);
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_subscriber ON signal_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_signal_subscriptions_provider ON signal_subscriptions(signal_provider_id);
CREATE INDEX IF NOT EXISTS idx_signal_broadcasts_provider ON signal_broadcasts(provider_id);
CREATE INDEX IF NOT EXISTS idx_signal_broadcasts_created ON signal_broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_signal_performance_signal ON signal_performance(signal_id);

-- Enable RLS
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_disclaimers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Categories are public read
CREATE POLICY "Categories are publicly readable" ON marketplace_categories FOR SELECT USING (true);

-- Products are publicly readable when approved
CREATE POLICY "Approved products are publicly readable" ON marketplace_products FOR SELECT USING (status = 'approved');
CREATE POLICY "Sellers can manage their own products" ON marketplace_products FOR ALL USING (auth.uid() = seller_id);

-- Signal subscriptions
CREATE POLICY "Users can view their own subscriptions" ON signal_subscriptions FOR SELECT USING (auth.uid() = subscriber_id OR auth.uid() = signal_provider_id);
CREATE POLICY "Users can create subscriptions" ON signal_subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);

-- Signal broadcasts
CREATE POLICY "Providers can manage their own signals" ON signal_broadcasts FOR ALL USING (auth.uid() = provider_id);
CREATE POLICY "Subscribers can view signals from their providers" ON signal_broadcasts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM signal_subscriptions 
    WHERE subscriber_id = auth.uid() 
    AND signal_provider_id = provider_id 
    AND status = 'active'
  )
);

-- Algorithm listings
CREATE POLICY "Approved algorithms are publicly readable" ON algorithm_listings FOR SELECT USING (status = 'approved');
CREATE POLICY "Sellers can manage their own algorithms" ON algorithm_listings FOR ALL USING (auth.uid() = seller_id);

-- Orders
CREATE POLICY "Users can view their own orders" ON marketplace_orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Users can create orders" ON marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Reviews
CREATE POLICY "Reviews are publicly readable" ON marketplace_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Users can manage their own reviews" ON marketplace_reviews FOR ALL USING (auth.uid() = buyer_id);

-- Performance tracking
CREATE POLICY "Providers can view their signal performance" ON signal_performance FOR SELECT USING (auth.uid() = provider_id);

-- Analytics
CREATE POLICY "Sellers can view their own analytics" ON marketplace_analytics FOR SELECT USING (auth.uid() = seller_id);

-- Disclaimers are publicly readable
CREATE POLICY "Disclaimers are publicly readable" ON marketplace_disclaimers FOR SELECT USING (is_active = true);
