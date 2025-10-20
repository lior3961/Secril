# Preventing 409 Conflict Errors

## Overview

This document explains the improvements made to prevent 409 (Conflict) errors in the application, particularly during payment processing and inventory management.

## What Causes 409 Errors?

409 errors occur when:
1. **Race conditions** - Multiple requests try to modify the same data simultaneously
2. **Duplicate processing** - The same operation is executed multiple times (e.g., double webhook calls)
3. **Stock conflicts** - Multiple users order the last item in stock at the same time
4. **Payment conflicts** - CardCom webhooks arrive multiple times for the same payment

## Solutions Implemented

### 1. Payment Processing Idempotency

**Problem:** CardCom webhooks could be called multiple times for the same payment, causing duplicate orders or stock deductions.

**Solution:** Implemented multi-layered idempotency checks in `backend/src/routes/payments.js`:

#### A. In-Memory Lock
```javascript
const processingLocks = new Map();

if (processingLocks.has(LowProfileId)) {
  logger.warn('Payment verification already in progress');
  return;
}
processingLocks.set(LowProfileId, true);
```

Prevents concurrent processing of the same payment in the same Node.js instance.

#### B. Database Status Lock
```javascript
// Mark as processing - only succeeds if status is 'awaiting_payment'
const { error: lockError } = await supabaseAdmin
  .from('pending_orders')
  .update({ status: 'processing' })
  .eq('low_profile_id', LowProfileId)
  .eq('status', 'awaiting_payment'); // Conditional update
```

Prevents multiple Vercel instances from processing the same payment.

#### C. Status Verification
```javascript
if (pendingOrder.status === 'payment_verified' || pendingOrder.status === 'completed') {
  logger.warn('Payment already processed');
  return;
}
```

Double-checks that payment hasn't been processed before proceeding.

#### D. Lock Release
```javascript
finally {
  processingLocks.delete(LowProfileId);
}
```

Always releases the in-memory lock, even if errors occur.

### 2. Optimistic Locking for Stock Updates

**Problem:** Multiple concurrent orders could deplete stock beyond available quantity.

**Solution:** Implemented optimistic locking with retry logic in `backend/src/routes/orders.js`:

```javascript
// Update only if stock hasn't changed
const { data: updated } = await supabaseAdmin
  .from('products')
  .update({ quantity_in_stock: newStock })
  .eq('id', product.id)
  .eq('quantity_in_stock', product.quantity_in_stock) // Lock condition
  .select();

// If no rows updated, stock changed (race condition detected)
if (!updated || updated.length === 0) {
  // Retry with new stock value
}
```

### 3. Exponential Backoff Retry

**Problem:** Transient conflicts should be retried, not failed immediately.

**Solution:** Added retry logic with exponential backoff:

```javascript
const maxRetries = 3;
let attempt = 0;

while (attempt < maxRetries && !success) {
  attempt++;
  try {
    // Attempt operation
  } catch (err) {
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

**Retry delays:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 3 seconds delay (max)

### 4. Better Error Responses

**Problem:** Users didn't know if they should retry failed requests.

**Solution:** Added retryable flag to error responses:

```javascript
return res.status(409).json({ 
  error: 'לא ניתן להשלים את ההזמנה כרגע. אנא נסה שנית.',
  retryable: true // Frontend can retry
});
```

## Testing the Improvements

### Test Duplicate Webhooks

```bash
# Call the same webhook multiple times quickly
for i in {1..5}; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"LowProfileId": "test-123"}' \
    https://your-app.vercel.app/api/payments/cardcom-webhook &
done
```

**Expected Result:** Only one order is created, others are gracefully skipped.

### Test Concurrent Stock Updates

```bash
# Multiple users order the last item simultaneously
# This would require load testing tools like Apache Bench or k6
```

**Expected Result:** One order succeeds, others get stock unavailable message.

## Monitoring 409 Errors

### Check Logs

```bash
GET /api/admin/error-logs?searchTerm=409&level=error
```

### Statistics

```bash
GET /api/admin/error-logs/stats/summary?days=7
```

Look for patterns in:
- Error frequency
- Affected endpoints
- Time of day patterns

## Best Practices Going Forward

### 1. Always Use Idempotency Keys

For any operation that modifies data:
- Generate unique idempotency key
- Store key with result
- Return cached result for duplicate requests

### 2. Use Optimistic Locking

For updates that depend on current state:
- Read current version/value
- Update only if version/value unchanged
- Retry if conflict detected

### 3. Implement Retry Logic

For transient failures:
- Use exponential backoff
- Set maximum retry attempts (3-5)
- Log retry attempts
- Inform user if all retries fail

### 4. Use Database Transactions

For multi-step operations:
```javascript
// Future enhancement: Use Supabase transactions
await supabase.rpc('create_order_transaction', {
  products: [...],
  userId: '...'
});
```

### 5. Monitor and Alert

- Set up alerts for high 409 error rates
- Review logs weekly for patterns
- Test high-concurrency scenarios

## Status Flow Diagram

### Payment Processing

```
awaiting_payment
    ↓
processing (lock acquired)
    ↓
payment_verified (order created)
    ↓
completed
```

**Failed States:**
- `failed` - Payment declined
- `error` - System error during processing

### Stock Update Flow

```
Check Stock → Lock Stock → Create Order → Update Stock
     ↓            ↓            ↓              ↓
  Available?   Locked?    Success?      Updated?
     ↓            ↓            ↓              ↓
    Yes         Yes          Yes            Yes
     ↓            ↓            ↓              ↓
  Continue    Continue     Commit         Success
     ↓            ↓            
    No           No           
     ↓            ↓            
   Error       Retry        
```

## Common Scenarios and Solutions

### Scenario 1: CardCom Sends Duplicate Webhooks

**Detection:**
- Same `LowProfileId` received multiple times
- Within seconds of each other

**Handling:**
1. First request: Processes normally
2. Subsequent requests: Detected by status check, returns early
3. All requests: Log event with warning level

**User Impact:** None - seamless deduplication

### Scenario 2: Two Users Order Last Item

**Detection:**
- Optimistic lock fails (stock changed)
- Retry detects insufficient stock

**Handling:**
1. First user: Order succeeds
2. Second user: Gets "out of stock" error
3. Both: Transaction logged

**User Impact:** Second user sees clear error message

### Scenario 3: Webhook Arrives During Order Creation

**Detection:**
- Status is already 'processing' or 'payment_verified'

**Handling:**
1. Webhook: Skips processing, logs warning
2. Original request: Completes normally

**User Impact:** None

## Performance Considerations

### In-Memory Locks

**Pros:**
- Fast (no database query)
- No database load

**Cons:**
- Only works within same Node.js instance
- Lost on server restart (acceptable for short-lived operations)

**Solution:** Combined with database status checks for cross-instance locking.

### Retry Delays

The exponential backoff prevents:
- Thundering herd problem
- Database overload
- Wasted retries

Maximum delay (3 seconds) keeps user experience reasonable.

### Database Load

Optimistic locking requires:
- 1 extra SELECT (to get current value)
- Conditional UPDATE (no extra load)
- Retry SELECT on conflict (only when needed)

Total overhead: Minimal, only on conflicts.

## Future Improvements

### 1. Distributed Locks

For better multi-instance coordination:
```javascript
// Use Redis for distributed locks
const lock = await redis.set('lock:payment:' + id, 'locked', 'NX', 'EX', 30);
if (!lock) return; // Another instance has lock
```

### 2. Message Queue

For webhook processing:
```javascript
// Queue webhook for processing
await queue.add('process-payment', { LowProfileId });
// Worker processes with guaranteed single execution
```

### 3. Database Transactions

Use Supabase RPC functions for atomic operations:
```sql
CREATE OR REPLACE FUNCTION create_order_atomic(...)
RETURNS void AS $$
BEGIN
  -- Check and update stock
  -- Create order
  -- All or nothing
END;
$$ LANGUAGE plpgsql;
```

### 4. Circuit Breaker

Prevent cascading failures:
```javascript
if (errorRate > threshold) {
  return res.status(503).json({ 
    error: 'Service temporarily unavailable',
    retryAfter: 60 
  });
}
```

## Troubleshooting

### High 409 Error Rate

**Check:**
1. Webhook configuration - is CardCom sending duplicates?
2. Frontend code - is it making duplicate requests?
3. Load patterns - is there unusual traffic?

**Actions:**
1. Review error logs for patterns
2. Check webhook delivery logs in CardCom dashboard
3. Verify frontend isn't double-submitting

### Stock Depletion Issues

**Check:**
1. Are retry counts excessive?
2. Is optimistic locking working?
3. Are there race conditions in stock checks?

**Actions:**
1. Review stock update logs
2. Verify database indexes on products table
3. Consider implementing stock reservations

### Payment Processing Delays

**Check:**
1. Are retries taking too long?
2. Is CardCom API slow?
3. Are there database locks?

**Actions:**
1. Review payment processing duration logs
2. Check CardCom API status
3. Optimize database queries

## Summary

The implemented solutions significantly reduce 409 errors by:

✅ Preventing duplicate webhook processing  
✅ Handling concurrent stock updates gracefully  
✅ Implementing automatic retry with backoff  
✅ Providing clear error messages to users  
✅ Logging all conflicts for monitoring  

The system now handles race conditions elegantly while maintaining data consistency and good user experience.

