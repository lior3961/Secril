-- Migration: Add pending_orders table for CardCom payment integration
-- Run this in your Supabase SQL Editor

-- Create pending_orders table to store order data before payment confirmation
CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  low_profile_id TEXT UNIQUE NOT NULL, -- CardCom transaction ID
  user_id UUID NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  products_arr JSONB NOT NULL, -- {products_ids: [uuid, uuid, ...]}
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'payment_verified', 'expired', 'failed')),
  payment_url TEXT, -- URL to CardCom payment page
  cardcom_data JSONB, -- Store CardCom response data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_orders_low_profile_id ON pending_orders(low_profile_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_user_id ON pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_expires_at ON pending_orders(expires_at);

-- Enable RLS
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view own pending orders" ON pending_orders;
CREATE POLICY "Users can view own pending orders" ON pending_orders
  FOR SELECT USING (user_id = auth.uid()::uuid);

DROP POLICY IF EXISTS "Service role can manage pending orders" ON pending_orders;
CREATE POLICY "Service role can manage pending orders" ON pending_orders
  FOR ALL USING (true);

-- Function to clean up expired pending orders
CREATE OR REPLACE FUNCTION cleanup_expired_pending_orders()
RETURNS void AS $$
BEGIN
  UPDATE pending_orders
  SET status = 'expired'
  WHERE status = 'awaiting_payment'
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to clean up expired orders
-- You can set this up in Supabase Dashboard under Database > Cron Jobs
-- SELECT cron.schedule('cleanup-expired-orders', '*/15 * * * *', 'SELECT cleanup_expired_pending_orders();');

COMMENT ON TABLE pending_orders IS 'Stores order information while waiting for CardCom payment confirmation';
COMMENT ON COLUMN pending_orders.low_profile_id IS 'CardCom LowProfileId - unique transaction identifier';
COMMENT ON COLUMN pending_orders.expires_at IS 'Pending orders expire after 30 minutes if payment is not completed';

