# Payment Status Constraint Fix

## Problem
Payment processing was failing with the error:
```
new row for relation "pending_orders" violates check constraint "pending_orders_status_check"
```

## Root Cause
The database constraint on the `pending_orders` table only allowed these statuses:
- `'awaiting_payment'`
- `'payment_verified'`
- `'expired'`
- `'failed'`

But the payment processing code was trying to set the status to:
- `'processing'` (line 287 in payments.js)
- `'error'` (line 463 in payments.js)

## ✅ Solution

### 1. Database Migration
Created `backend/migrations/fix_pending_orders_status_constraint.sql`:

```sql
-- Drop the existing constraint
ALTER TABLE pending_orders DROP CONSTRAINT IF EXISTS pending_orders_status_check;

-- Add the new constraint with 'processing' status included
ALTER TABLE pending_orders ADD CONSTRAINT pending_orders_status_check 
CHECK (status IN ('awaiting_payment', 'processing', 'payment_verified', 'expired', 'failed'));

-- Update any existing 'error' status to 'failed' (if any exist)
UPDATE pending_orders 
SET status = 'failed' 
WHERE status = 'error';
```

### 2. Code Fix
Updated `backend/src/routes/payments.js`:
- Changed `status: 'error'` to `status: 'failed'` (line 463)

## 🚀 How to Deploy the Fix

### Step 1: Run Database Migration
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run the migration script:
   ```sql
   -- Copy and paste the contents of fix_pending_orders_status_constraint.sql
   ```

### Step 2: Deploy Code Changes
```bash
git add .
git commit -m "Fix payment status constraint - add processing status"
git push
```

## 📊 Status Flow
The payment status now follows this flow:

1. **`awaiting_payment`** - Order created, waiting for payment
2. **`processing`** - Payment received, being processed
3. **`payment_verified`** - Payment successful, order created
4. **`failed`** - Payment failed or processing error
5. **`expired`** - Order expired (after 30 minutes)

## 🔍 What This Fixes

- ✅ Payment processing will no longer fail with constraint violations
- ✅ Status transitions work properly during payment verification
- ✅ Error handling uses valid status values
- ✅ Payment flow completes successfully

## 🧪 Testing

After applying the fix:

1. **Try making a purchase** - should work without constraint errors
2. **Check payment status** - should progress through: awaiting_payment → processing → payment_verified
3. **Check logs** - should not see constraint violation errors

## 📋 Expected Results

- Payment processing completes successfully
- Orders are created properly
- No more database constraint violations
- Payment status updates work correctly

The payment system should now work end-to-end without database constraint issues!
