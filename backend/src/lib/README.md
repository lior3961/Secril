# Backend Utilities (lib)

This directory contains utility modules used throughout the backend application.

## Logger (`logger.js`)

Centralized logging utility that logs to both console and database.

### Features

- **Multi-destination logging:** Console + Database
- **Automatic request tracking:** IP, user agent, path, method
- **Log levels:** error, warn, info, debug
- **Sensitive data redaction:** Passwords, tokens, etc.
- **Fire-and-forget DB writes:** Non-blocking performance
- **Express middleware:** Request and error logging

### Usage Examples

#### Basic Logging

```javascript
import { logger } from '../lib/logger.js';

// Log an error
logger.error('Database connection failed', error, req);

// Log with context
logger.error('Payment failed', error, req, { 
  orderId: 123, 
  amount: 99.99 
});

// Log a warning
logger.warn('Stock running low', req, { 
  productId: 456, 
  remainingStock: 3 
});

// Log info (save to DB with 4th param = true)
logger.info('Order completed', req, { orderId: 789 }, true);

// Log debug (dev only, not saved to DB)
logger.debug('Processing step 1', { data: {...} });
```

#### In Express Routes

```javascript
router.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await fetchProducts();
    
    if (error) {
      logger.error('Failed to fetch products', error, req);
      return res.status(500).json({ error: 'Internal error' });
    }
    
    res.json({ products: data });
  } catch (error) {
    logger.error('Unexpected error', error, req);
    res.status(500).json({ error: 'Internal error' });
  }
});
```

#### Using Middleware

```javascript
import { requestLogger, errorLogger } from './lib/logger.js';

// Log all requests (already added in server.js)
app.use(requestLogger);

// Handle all errors (already added in server.js)
app.use(errorLogger);
```

### API Reference

#### `logger.error(message, error, req, additionalContext)`

Logs an error to console and database.

**Parameters:**
- `message` (string): Error message
- `error` (Error|null): Error object with stack trace
- `req` (Express.Request|null): Express request object
- `additionalContext` (object|null): Extra data to log

**Example:**
```javascript
logger.error('Payment verification failed', err, req, { 
  paymentId: 'xyz',
  amount: 100
});
```

#### `logger.warn(message, req, additionalContext)`

Logs a warning to console and database.

**Parameters:**
- `message` (string): Warning message
- `req` (Express.Request|null): Express request object
- `additionalContext` (object|null): Extra data to log

**Example:**
```javascript
logger.warn('Rate limit approaching', req, { 
  userId: '123',
  requestCount: 95
});
```

#### `logger.info(message, req, additionalContext, saveToDb)`

Logs info to console, optionally to database.

**Parameters:**
- `message` (string): Info message
- `req` (Express.Request|null): Express request object
- `additionalContext` (object|null): Extra data to log
- `saveToDb` (boolean): Whether to save to database (default: false)

**Example:**
```javascript
// Console only
logger.info('User logged in', req, { userId: '123' });

// Console + Database
logger.info('Order completed', req, { orderId: 456 }, true);
```

#### `logger.debug(message, additionalContext)`

Logs debug info to console (development only, never to DB).

**Parameters:**
- `message` (string): Debug message
- `additionalContext` (object|null): Extra data to log

**Example:**
```javascript
logger.debug('Cache hit', { key: 'products', ttl: 300 });
```

### Middleware

#### `requestLogger(req, res, next)`

Express middleware that logs all requests with timing.

**Logs to DB:** Only failed requests (status >= 400)

**Example:**
```javascript
app.use(requestLogger);
```

#### `errorLogger(err, req, res, next)`

Express error handler that logs unhandled errors.

**Always logs to DB**

**Example:**
```javascript
app.use(errorLogger);
```

### Log Levels

| Level | Console | Database | Use Case |
|-------|---------|----------|----------|
| error | ✅ Always | ✅ Always | Errors requiring attention |
| warn | ✅ Always | ✅ Always | Potential issues |
| info | ✅ Always | ⚠️ Optional | Important events |
| debug | ⚠️ Dev only | ❌ Never | Development debugging |

### Request Information Captured

When you pass `req` to a logger method, it automatically captures:

- `request_path` - The URL path
- `request_method` - HTTP method (GET, POST, etc.)
- `user_id` - Authenticated user ID (if available)
- `ip_address` - Client IP address
- `user_agent` - Browser/client info

### Security Features

#### Automatic Redaction

Sensitive fields are automatically redacted:
- `password`
- `token`
- `secret`
- `apiKey`
- `api_key`

**Example:**
```javascript
logger.error('Auth failed', null, req, {
  password: 'mypassword123',  // Logged as: '***REDACTED***'
  email: 'user@example.com'   // Logged normally
});
```

#### Stack Traces

Stack traces are only included:
- In development mode (NODE_ENV !== 'production')
- When error object is provided
- Removed in production for security

### Performance

#### Non-Blocking

Database writes are fire-and-forget:
```javascript
// This doesn't wait for DB write to complete
logger.error('Something failed', error, req);
// Code continues immediately
```

#### Minimal Overhead

- Console logging: < 1ms
- DB write (async): ~5-10ms (non-blocking)
- Request middleware: < 5ms
- Total impact: Negligible

### Database Schema

Logs are stored in the `error_logs` table:

```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  level VARCHAR(20),          -- error, warn, info, debug
  message TEXT,
  error_details JSONB,        -- Error object details
  stack_trace TEXT,           -- Stack trace (dev only)
  request_path VARCHAR(500),  -- API path
  request_method VARCHAR(10), -- HTTP method
  user_id UUID,               -- User (if authenticated)
  ip_address VARCHAR(45),     -- Client IP
  user_agent TEXT,            -- Client browser/app
  additional_context JSONB    -- Custom context data
);
```

### Best Practices

#### 1. Always Log Errors

```javascript
try {
  // Code that might fail
} catch (error) {
  logger.error('Operation failed', error, req, { 
    operation: 'processPayment',
    orderId: 123
  });
  throw error; // Or handle appropriately
}
```

#### 2. Add Context

```javascript
// Bad: Generic error
logger.error('Database error', error, req);

// Good: Specific context
logger.error('Failed to fetch user profile', error, req, {
  userId: 'abc123',
  table: 'profiles'
});
```

#### 3. Use Appropriate Levels

```javascript
// Error: Something broke
logger.error('Payment failed', error, req);

// Warn: Something might be wrong
logger.warn('API response slow', req, { duration: 5000 });

// Info: Important event (save critical ones)
logger.info('Order completed', req, { orderId: 123 }, true);

// Debug: Development only
logger.debug('Cache state', { hits: 10, misses: 2 });
```

#### 4. Don't Over-Log

```javascript
// Bad: Too much noise
for (let i = 0; i < 1000; i++) {
  logger.info('Processing item ' + i); // 1000 logs!
}

// Good: Summary logging
logger.info('Processed items', req, { 
  count: 1000, 
  duration: 5000 
}, true);
```

#### 5. Clean Context Data

```javascript
// Bad: Sensitive data
logger.error('Auth failed', error, req, {
  password: user.password, // Don't log passwords!
  creditCard: user.card    // Don't log credit cards!
});

// Good: Safe data only
logger.error('Auth failed', error, req, {
  userId: user.id,
  email: user.email,
  attemptCount: 3
});
```

### Common Patterns

#### Database Operations

```javascript
const { data, error } = await supabase
  .from('orders')
  .select('*');

if (error) {
  logger.error('Database query failed', error, req, {
    table: 'orders',
    operation: 'select'
  });
  return res.status(500).json({ error: 'Internal error' });
}
```

#### External API Calls

```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    logger.error('External API failed', null, req, {
      api: 'example.com',
      status: response.status,
      statusText: response.statusText
    });
  }
} catch (error) {
  logger.error('External API connection failed', error, req, {
    api: 'example.com'
  });
}
```

#### Business Logic Errors

```javascript
if (product.stock < orderQuantity) {
  logger.warn('Insufficient stock', req, {
    productId: product.id,
    available: product.stock,
    requested: orderQuantity
  });
  return res.status(400).json({ 
    error: 'Insufficient stock' 
  });
}
```

### Troubleshooting

#### Logs not appearing in database

**Check:**
1. Migration ran? `SELECT * FROM error_logs LIMIT 1`
2. Service role set? Check `SUPABASE_SERVICE_ROLE` env var
3. RLS policies? Should allow service role to insert

**Solution:**
```sql
-- Verify table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'error_logs';

-- Check permissions
SELECT * FROM pg_policies 
WHERE tablename = 'error_logs';
```

#### Console.error for logger itself

If you see "Logger failed" errors:
1. Check database connection
2. Verify table schema
3. Check for database errors in Supabase logs

**Note:** Logger errors never crash your app, they just log to console.

### Future Enhancements

Planned improvements:
- [ ] Log aggregation and batching
- [ ] Real-time log streaming
- [ ] Structured logging formats (JSON)
- [ ] Integration with external services (Sentry)
- [ ] Custom log formatters
- [ ] Log sampling for high-traffic endpoints

### Related Files

- Migration: `backend/migrations/add_error_logs.sql`
- Admin endpoints: `backend/src/routes/admin.js`
- Server setup: `backend/src/server.js`
- Documentation: `ERROR_LOGGING_GUIDE.md`

### Support

For issues or questions:
1. Check `ERROR_LOGGING_GUIDE.md`
2. Review Supabase logs
3. Verify environment variables
4. Test locally first

