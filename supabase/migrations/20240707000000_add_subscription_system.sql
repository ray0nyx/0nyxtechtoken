-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2) NOT NULL,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT NOT NULL CHECK (status IN ('trial', 'trialing', 'active', 'canceled', 'expired')),
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  payment_method_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_developer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscription_invoices table
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  stripe_invoice_id TEXT,
  invoice_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features)
VALUES 
('Basic', 'Basic trading analytics and journal', 9.99, 99.99, '{"features": ["Basic analytics", "Trade journaling", "CSV import"]}'),
('Pro', 'Advanced trading analytics and journal', 19.99, 199.99, '{"features": ["Advanced analytics", "Trade journaling", "CSV import", "API access", "Strategy backtesting"]}');

-- Create function to automatically create a trial subscription for new users
CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    is_developer
  ) VALUES (
    NEW.id,
    'trial',
    NOW(),
    NOW() + INTERVAL '14 days',
    CASE 
      -- Developer and bypass user IDs
      WHEN NEW.email IN ('sevemadsen18@gmail.com', 'rayhan@arafatcapital.com', 'ramirezrayba@gmail.com') 
        OR NEW.id IN ('a541b0e8-b16f-4963-a764-dfb5bf95c972', '8538e0b7-6dcd-4673-b39f-00d273c7fc76') THEN true 
      ELSE false 
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create a trial subscription for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_trial();

-- Create function to check if a user's subscription is valid
CREATE OR REPLACE FUNCTION is_subscription_valid(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_record user_subscriptions;
BEGIN
  SELECT * INTO subscription_record
  FROM user_subscriptions
  WHERE user_id = user_uuid
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Developer always has access
  IF subscription_record.is_developer THEN
    RETURN TRUE;
  END IF;
  
  -- Check if subscription is active or in trial period
  RETURN (
    subscription_record.status = 'active' OR 
    (subscription_record.status = 'trial' AND subscription_record.trial_end_date > NOW()) OR
    (subscription_record.status = 'trialing' AND subscription_record.trial_end_date > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for subscription tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans
CREATE POLICY "Anyone can read subscription plans"
  ON subscription_plans FOR SELECT
  USING (true);

-- Policies for user_subscriptions
CREATE POLICY "Users can read their own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Developers can read all subscriptions"
  ON user_subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = auth.uid() AND is_developer = true
  ));

-- Policies for subscription_invoices
CREATE POLICY "Users can read their own invoices"
  ON subscription_invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Developers can read all invoices"
  ON subscription_invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = auth.uid() AND is_developer = true
  )); 