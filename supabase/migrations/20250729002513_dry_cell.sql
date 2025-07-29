/*
  # Stripe Payment Integration and Access Control System

  1. New Tables
    - `payment_transactions` - Track all payment transactions
    - `subscription_tiers` - Define subscription levels and features
    - `user_subscriptions` - Track user subscription status
    - `payment_webhooks` - Log Stripe webhook events

  2. Security
    - Enable RLS on all new tables
    - Add policies for user access control
    - Add payment verification functions

  3. Access Control
    - Payment status verification
    - Feature access based on subscription tiers
    - Automatic access revocation for failed payments
*/

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  amount integer NOT NULL, -- Amount in pence/cents
  currency text DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending',
  payment_type text NOT NULL, -- 'guest_access', 'subscription', 'one_time'
  claim_id text REFERENCES claims(case_number) ON DELETE SET NULL,
  guest_email text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT payment_transactions_status_check 
    CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
  CONSTRAINT payment_transactions_type_check 
    CHECK (payment_type IN ('guest_access', 'subscription', 'one_time'))
);

-- Subscription Tiers Table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  price_monthly integer NOT NULL, -- Price in pence/cents
  price_yearly integer, -- Optional yearly pricing
  max_claims integer DEFAULT 10,
  max_guests_per_claim integer DEFAULT 5,
  max_evidence_per_claim integer DEFAULT 100,
  features jsonb DEFAULT '{}', -- Additional features as JSON
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES subscription_tiers(id),
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT user_subscriptions_status_check 
    CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete'))
);

-- Payment Webhooks Table (for Stripe webhook logging)
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed boolean DEFAULT false,
  error_message text,
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Update claim_shares to include payment verification
ALTER TABLE claim_shares 
ADD COLUMN IF NOT EXISTS payment_transaction_id uuid REFERENCES payment_transactions(id),
ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_verified boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_id ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_claim_id ON payment_transactions(claim_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_claim_shares_payment_verified ON claim_shares(payment_verified);

-- Insert default subscription tiers
INSERT INTO subscription_tiers (tier_name, display_name, description, price_monthly, price_yearly, max_claims, max_guests_per_claim, max_evidence_per_claim, features) VALUES
('free', 'Free Tier', 'Basic access with limited features', 0, 0, 2, 1, 20, '{"chat": false, "video": false, "whiteboard": false, "export": false}'),
('basic', 'Basic Plan', 'Perfect for individual legal professionals', 999, 9990, 10, 5, 100, '{"chat": true, "video": false, "whiteboard": true, "export": true}'),
('professional', 'Professional Plan', 'Advanced features for legal teams', 2999, 29990, 50, 20, 500, '{"chat": true, "video": true, "whiteboard": true, "export": true, "priority_support": true}'),
('enterprise', 'Enterprise Plan', 'Unlimited access for large organizations', 9999, 99990, -1, -1, -1, '{"chat": true, "video": true, "whiteboard": true, "export": true, "priority_support": true, "custom_branding": true}')
ON CONFLICT (tier_name) DO NOTHING;

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_transactions
CREATE POLICY "Users can view their own payment transactions"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment transactions"
  ON payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for subscription_tiers (public read)
CREATE POLICY "Anyone can view active subscription tiers"
  ON subscription_tiers FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for payment_webhooks (admin only - no policies for regular users)

-- Function to check if user has valid subscription
CREATE OR REPLACE FUNCTION has_valid_subscription(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_tiers st ON us.tier_id = st.id
    WHERE us.user_id = $1 
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  );
END;
$$;

-- Function to get user's subscription tier
CREATE OR REPLACE FUNCTION get_user_subscription_tier(user_id uuid)
RETURNS subscription_tiers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier subscription_tiers;
BEGIN
  SELECT st.* INTO tier
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = $1 
  AND us.status = 'active'
  AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY st.price_monthly DESC
  LIMIT 1;
  
  -- If no active subscription, return free tier
  IF tier IS NULL THEN
    SELECT * INTO tier FROM subscription_tiers WHERE tier_name = 'free';
  END IF;
  
  RETURN tier;
END;
$$;

-- Function to verify payment for claim access
CREATE OR REPLACE FUNCTION verify_claim_access_payment(claim_id text, guest_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM claim_shares cs
    JOIN payment_transactions pt ON cs.payment_transaction_id = pt.id
    WHERE cs.claim_id = $1 
    AND cs.shared_with_id = $2
    AND cs.payment_verified = true
    AND pt.status = 'succeeded'
    AND (cs.access_expires_at IS NULL OR cs.access_expires_at > now())
  );
END;
$$;

-- Function to check feature access based on subscription
CREATE OR REPLACE FUNCTION has_feature_access(user_id uuid, feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier subscription_tiers;
  features jsonb;
BEGIN
  tier := get_user_subscription_tier($1);
  features := tier.features;
  
  -- Check if feature exists and is enabled
  RETURN COALESCE((features ->> feature_name)::boolean, false);
END;
$$;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_transactions_updated_at 
  BEFORE UPDATE ON payment_transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_tiers_updated_at 
  BEFORE UPDATE ON subscription_tiers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at 
  BEFORE UPDATE ON user_subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();