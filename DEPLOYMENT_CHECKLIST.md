# Deployment Checklist - Error Logging & 409 Prevention

## Pre-Deployment

- [ ] Review changes in `IMPROVEMENTS_SUMMARY.md`
- [ ] Understand new features in `ERROR_LOGGING_GUIDE.md`
- [ ] Read about 409 fixes in `PREVENTING_409_ERRORS.md`

## Database Setup

### Step 1: Run Migration

1. Open Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Copy contents of: `backend/migrations/add_error_logs.sql`
4. Execute the SQL
5. Verify table created:
   ```sql
   SELECT COUNT(*) FROM error_logs;
   ```

**Expected result:** Query succeeds (returns 0)

### Step 2: Verify RLS Policies

```sql
-- Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'error_logs';
```

**Expected result:** 1 policy for SELECT (admin only)

### Step 3: Test Logging

```sql
-- Insert test log
INSERT INTO error_logs (level, message) VALUES ('info', 'Test log');

-- Verify
SELECT * FROM error_logs WHERE message = 'Test log';

-- Clean up
DELETE FROM error_logs WHERE message = 'Test log';
```

## Code Deployment

### Step 1: Commit Changes

```bash
cd my-supa-app
git add .
git commit -m "Add error logging system and 409 prevention"
```

### Step 2: Push to Repository

```bash
git push origin main
```

### Step 3: Verify Vercel Deployment

1. Check Vercel dashboard for deployment status
2. Wait for build to complete
3. Check for build errors

## Post-Deployment Testing

### Test 1: Basic Logging

```bash
# Make a request to trigger logging
curl https://your-app.vercel.app/api/products

# Check logs were created
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-app.vercel.app/api/admin/error-logs?limit=10
```

**Expected:** Recent logs appear

### Test 2: Error Logging

```bash
# Trigger an error (invalid request)
curl -X POST https://your-app.vercel.app/api/products

# Check error was logged
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://your-app.vercel.app/api/admin/error-logs?level=error&limit=5"
```

**Expected:** Error appears in logs

### Test 3: Stats Endpoint

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-app.vercel.app/api/admin/error-logs/stats/summary
```

**Expected:** Returns statistics with counts

### Test 4: Payment Idempotency (Manual)

1. Create a test payment
2. Trigger webhook manually (if possible)
3. Check logs for duplicate processing prevention
4. Verify only one order was created

### Test 5: Stock Conflict Handling

1. Set a product to stock = 1
2. Try to order it (should succeed)
3. Try to order again (should fail with stock message)
4. Check logs for stock conflict handling

## Verification Checklist

### Database
- [ ] `error_logs` table exists
- [ ] Table has proper indexes
- [ ] RLS policies active
- [ ] Test insert/select works

### API Endpoints
- [ ] `GET /api/admin/error-logs` returns data
- [ ] `GET /api/admin/error-logs/stats/summary` returns stats
- [ ] Logs contain request information
- [ ] Error details are captured

### Error Handling
- [ ] Errors are logged to database
- [ ] Stack traces included (in dev)
- [ ] User information captured
- [ ] Request path logged

### 409 Prevention
- [ ] Duplicate webhooks don't create duplicate orders
- [ ] Stock conflicts handled gracefully
- [ ] Retry logic works
- [ ] Error messages are clear

## Monitoring Setup

### Day 1
- [ ] Check error logs every 2 hours
- [ ] Look for unexpected errors
- [ ] Verify logging is working
- [ ] Test all endpoints

### Week 1
- [ ] Check error logs daily
- [ ] Review error statistics
- [ ] Look for patterns
- [ ] Adjust if needed

### Ongoing
- [ ] Weekly statistics review
- [ ] Monthly log cleanup
- [ ] Monitor error trends
- [ ] Update documentation

## Rollback Plan (If Needed)

### If Errors Occur

1. **Check logs first:**
   ```bash
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     "https://your-app.vercel.app/api/admin/error-logs?level=error&limit=20"
   ```

2. **Identify issue:**
   - Database connection?
   - Missing environment variables?
   - Code errors?

3. **Quick fixes:**
   ```bash
   # Disable logging temporarily (in code)
   # Comment out in server.js:
   // app.use(requestLogger);
   ```

4. **Full rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

### Database Rollback

If you need to remove the error_logs table:

```sql
-- Remove policies
DROP POLICY IF EXISTS "Admins can view error logs" ON error_logs;

-- Drop table
DROP TABLE IF EXISTS error_logs;

-- Remove cleanup function
DROP FUNCTION IF EXISTS cleanup_old_error_logs();
```

## Common Issues

### Issue: Logs not appearing

**Check:**
```sql
-- Verify table exists
SELECT * FROM error_logs LIMIT 1;

-- Check service role permissions
-- In Supabase Dashboard → Settings → API
```

**Solution:** Verify `SUPABASE_SERVICE_ROLE` env var is set in Vercel

### Issue: RLS preventing writes

**Check:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'error_logs';
```

**Solution:** Logger uses service role which bypasses RLS

### Issue: Too many logs

**Quick fix:**
```bash
# Clean up immediately
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 1}' \
  https://your-app.vercel.app/api/admin/error-logs/cleanup
```

### Issue: Performance problems

**Check:**
```sql
-- Verify indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'error_logs';
```

**Solution:** Re-run migration to create indexes

## Success Criteria

✅ **Database:** error_logs table created and accessible  
✅ **API:** All new endpoints respond correctly  
✅ **Logging:** Errors captured in database  
✅ **Stats:** Statistics endpoint returns data  
✅ **409s:** Reduced significantly (< 0.1%)  
✅ **Performance:** No noticeable slowdown  
✅ **Monitoring:** Can track errors effectively  

## Support

### Documentation
- `IMPROVEMENTS_SUMMARY.md` - Overview
- `ERROR_LOGGING_GUIDE.md` - Logging details
- `PREVENTING_409_ERRORS.md` - 409 error details

### Files Changed
- `backend/migrations/add_error_logs.sql`
- `backend/src/lib/logger.js`
- `backend/src/server.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/payments.js`
- `backend/src/routes/orders.js`
- `backend/src/routes/products.js`

### Testing Locally

```bash
# Start backend locally
cd backend
npm install
npm run dev

# Test endpoints
curl http://localhost:4000/api/products
curl http://localhost:4000/health
```

## Final Checklist

Before marking deployment complete:

- [ ] Database migration successful
- [ ] Code deployed to Vercel
- [ ] All tests passed
- [ ] No linting errors
- [ ] Logs appearing in database
- [ ] Admin endpoints working
- [ ] Error statistics available
- [ ] 409 errors reduced
- [ ] Documentation reviewed
- [ ] Team informed of changes

## Next Steps

After successful deployment:

1. **Monitor closely** for first 24 hours
2. **Review logs** daily for first week
3. **Set up alerts** (future enhancement)
4. **Create admin UI** for log viewing (optional)
5. **Share access** with team members

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Verified By:** _________________  
**Notes:** _________________

