-- Migration: Fix pending_orders status constraint to include 'processing' status
-- Run this in your Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE pending_orders DROP CONSTRAINT IF EXISTS pending_orders_status_check;

-- Add the new constraint with 'processing' status included
ALTER TABLE pending_orders ADD CONSTRAINT pending_orders_status_check 
CHECK (status IN ('awaiting_payment', 'processing', 'payment_verified', 'expired', 'failed'));

-- Update any existing 'error' status to 'failed' (if any exist)
UPDATE pending_orders 
SET status = 'failed' 
WHERE status = 'error';

-- Add comment explaining the status flow
COMMENT ON COLUMN pending_orders.status IS 'Order status: awaiting_payment -> processing -> payment_verified (success) or failed/expired';
