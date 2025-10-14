// Simple in-memory rate limiter for Vercel serverless functions
// Note: In production with multiple instances, consider using Redis or database-based rate limiting

const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.firstRequest > data.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 5, // limit each IP to 5 requests per windowMs
    message = 'יותר מדי בקשות, אנא נסה שוב מאוחר יותר',
    keyGenerator = (req) => req.ip || req.connection?.remoteAddress || 'unknown'
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit data for this key
    let rateLimitData = rateLimitStore.get(key);
    
    if (!rateLimitData) {
      rateLimitData = {
        requests: [],
        firstRequest: now
      };
      rateLimitStore.set(key, rateLimitData);
    }

    // Remove old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(
      requestTime => requestTime > windowStart
    );

    // Check if limit exceeded
    if (rateLimitData.requests.length >= max) {
      const resetTime = new Date(rateLimitData.requests[0] + windowMs);
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil((rateLimitData.requests[0] + windowMs - now) / 1000),
        resetTime: resetTime.toISOString()
      });
      return;
    }

    // Add current request
    rateLimitData.requests.push(now);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - rateLimitData.requests.length),
      'X-RateLimit-Reset': new Date(rateLimitData.requests[0] + windowMs).toISOString()
    });

    next();
  };
}

// Specific rate limiters for different endpoints
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'יותר מדי ניסיונות התחברות, אנא המתן 15 דקות'
});

export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signup attempts per hour
  message: 'יותר מדי ניסיונות הרשמה, אנא המתן שעה'
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 payment attempts per 5 minutes
  message: 'יותר מדי ניסיונות תשלום, אנא המתן 5 דקות'
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'יותר מדי בקשות, אנא נסה שוב מאוחר יותר'
});
