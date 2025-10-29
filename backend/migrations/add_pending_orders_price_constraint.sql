-- Migration: Add price constraint to pending_orders table
-- This ensures consistency with the orders table

ALTER TABLE pending_orders ADD CONSTRAINT pending_orders_price_check 
CHECK (price >= 0);
