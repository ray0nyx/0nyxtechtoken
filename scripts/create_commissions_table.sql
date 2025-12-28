-- Create commissions table for tracking affiliate commissions
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Stripe references
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Metadata
    description TEXT,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fk_commissions_referral FOREIGN KEY (referral_id) REFERENCES referrals(id),
    CONSTRAINT fk_commissions_affiliate FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_event_type ON commissions(event_type);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_stripe_subscription_id ON commissions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_commissions_stripe_invoice_id ON commissions(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_commissions_stripe_payment_intent_id ON commissions(stripe_payment_intent_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_commissions_updated_at
    BEFORE UPDATE ON commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_commissions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE commissions IS 'Tracks affiliate commissions for various payment events';
COMMENT ON COLUMN commissions.amount IS 'Commission amount in dollars';
COMMENT ON COLUMN commissions.event_type IS 'Type of event that triggered the commission (subscription_created, subscription_payment, one_time_payment, etc.)';
COMMENT ON COLUMN commissions.status IS 'Status of the commission (pending, paid, failed, cancelled)';
COMMENT ON COLUMN commissions.stripe_subscription_id IS 'Stripe subscription ID if related to subscription';
COMMENT ON COLUMN commissions.stripe_invoice_id IS 'Stripe invoice ID if related to invoice payment';
COMMENT ON COLUMN commissions.stripe_payment_intent_id IS 'Stripe payment intent ID if related to one-time payment'; 