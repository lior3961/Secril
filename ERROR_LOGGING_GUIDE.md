# Error Logging System Guide

## Overview

This application now includes a comprehensive error logging system that persists logs to a Supabase database table, helping you overcome Vercel's log limitations and track errors effectively.

## Features

✅ **Database-persisted logs** - Errors only (optimized for Vercel free plan)  
✅ **Automatic request tracking** - IP address, user agent, request path, and user ID are captured  
✅ **Admin dashboard integration** - View and analyze logs from the admin panel  
✅ **Automatic cleanup** - Old logs can be automatically cleaned up  
✅ **Search and filter** - Find specific errors by date, level, path, or user  
✅ **Error statistics** - View error trends and most problematic endpoints  
✅ **Resource efficient** - Non-blocking, minimal overhead  

## Setup

### 1. Run the Database Migration

Run the migration to create the error logs table:

```bash
# In Supabase SQL Editor, run:
my-supa-app/backend/migrations/add_error_logs.sql
```

This creates:
- `error_logs` table with indexes for fast queries
- Row-level security policies (admin-only access)
- Automatic cleanup function

### 2. Deploy to Vercel

The logging system is automatically integrated and will start working once the migration is applied.

## Using the Logging System

### In Your Code

The logger is already integrated into all routes. To add logging to new routes:

```javascript
import { logger } from '../lib/logger.js';

// Log an error
logger.error('Failed to process payment', error, req, { orderId: 123 });

// Log a warning
logger.warn('Stock running low', req, { productId: 456, stock: 5 });

// Log info (saveToDb = true to persist critical events)
logger.info('Order completed', req, { orderId: 789 }, true);

// Log debug (development only)
logger.debug('Processing payment', { step: 1 });
```

### Logger Methods

| Method | When to Use | Saved to DB |
|--------|-------------|-------------|
| `error()` | Errors that need investigation | ✅ Always |
| `warn()` | Potential issues or warnings | ✅ Always |
| `info()` | Important events | ✅ If saveToDb=true |
| `debug()` | Development debugging | ❌ Never |

## Admin Endpoints

### 1. Get Error Logs

```bash
GET /api/admin/error-logs
```

**Query Parameters:**
- `level` - Filter by level (error, warn, info, debug, all)
- `limit` - Number of logs to return (default: 100)
- `offset` - Pagination offset (default: 0)
- `startDate` - Filter from date (ISO string)
- `endDate` - Filter to date (ISO string)
- `searchTerm` - Search in message or stack trace
- `userId` - Filter by user ID
- `requestPath` - Filter by request path

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://your-app.vercel.app/api/admin/error-logs?level=error&limit=50"
```

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "created_at": "2024-01-01T12:00:00Z",
      "level": "error",
      "message": "Payment verification failed",
      "error_details": { "code": "PAYMENT_FAILED" },
      "stack_trace": "Error: ...",
      "request_path": "/api/payments/verify",
      "request_method": "POST",
      "user_id": "user-uuid",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "additional_context": { "orderId": 123 }
    }
  ],
  "total": 234,
  "limit": 50,
  "offset": 0
}
```

### 2. Get Specific Error Log

```bash
GET /api/admin/error-logs/:id
```

Returns full details of a specific error log.

### 3. Get Error Statistics

```bash
GET /api/admin/error-logs/stats/summary?days=7
```

Returns error statistics for the last N days:

```json
{
  "period": "Last 7 days",
  "levelCounts": {
    "error": 45,
    "warn": 23,
    "info": 12,
    "debug": 0
  },
  "topErrorPaths": [
    { "path": "/api/products", "count": 15 },
    { "path": "/api/payments/verify", "count": 8 }
  ],
  "total": 80
}
```

### 4. Cleanup Old Logs

```bash
DELETE /api/admin/error-logs/cleanup
Content-Type: application/json

{
  "days": 30
}
```

Deletes logs older than the specified number of days (default: 30).

## Monitoring Best Practices

### 1. Regular Review

- Check error logs daily for critical issues
- Review the error statistics dashboard weekly
- Set up alerts for specific error patterns (future enhancement)

### 2. Search Patterns

**Find payment errors:**
```
GET /api/admin/error-logs?searchTerm=payment&level=error
```

**Find errors for a specific user:**
```
GET /api/admin/error-logs?userId=USER_UUID&level=error
```

**Find errors on a specific endpoint:**
```
GET /api/admin/error-logs?requestPath=/api/products&level=error
```

### 3. Maintenance

Run cleanup monthly to prevent the logs table from growing too large:

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 30}' \
  https://your-app.vercel.app/api/admin/error-logs/cleanup
```

## What Gets Logged Automatically

### Request Logging (Errors Only - Vercel Free Plan Optimized)
- Only failed requests (4xx, 5xx) are logged to save resources
- Successful requests (2xx, 3xx) are logged to console only (free)
- Non-blocking async writes don't slow down responses

### Error Logging
- All unhandled errors in route handlers
- Database errors (Supabase operations)
- External API failures (CardCom, etc.)
- Stock update conflicts
- Payment processing errors

### Context Captured
- User ID (if authenticated)
- Request path and method
- IP address and user agent
- Stack traces (in development)
- Additional context passed by the code

## Privacy Considerations

The logger automatically redacts sensitive information:
- Passwords
- API keys
- Tokens
- Secrets

Stack traces are only included in development mode for privacy.

## Troubleshooting

### Logs not appearing in database

1. Verify the migration was run successfully
2. Check Supabase logs for RLS policy errors
3. Ensure the service role key is configured correctly

### Too many logs

1. Adjust what gets saved by changing `saveToDb` parameter
2. Run cleanup more frequently
3. Consider implementing log rotation

### Performance concerns

The logging system uses "fire and forget" - database writes don't block requests. If performance issues occur:
1. Check database indexes are created
2. Consider implementing a log queue/batch insert
3. Reduce the amount of data in `additional_context`

## Future Enhancements

Potential improvements:
- Real-time alerts (email/SMS) for critical errors
- Error grouping and deduplication
- Performance metrics dashboard
- Automated error reports
- Integration with external monitoring tools (Sentry, LogRocket)

## Support

If you encounter issues with the logging system, check:
1. Database migration status
2. Supabase service role permissions
3. RLS policies on error_logs table
4. Console logs for logger errors

