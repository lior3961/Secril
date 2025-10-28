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
    skipAuthRoutes = false, // Skip rate limiting for auth routes
    keyGenerator = (req) => {
      // Handle Vercel proxy headers properly
      const forwarded = req.headers['x-forwarded-for'];
      const realIp = req.headers['x-real-ip'];
      const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
      
      if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded.split(',')[0].trim();
      }
      if (realIp) return realIp;
      if (cfConnectingIp) return cfConnectingIp;
      
      // Fallback to Express IP detection
      return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    }
  } = options;

  return (req, res, next) => {
    // Skip rate limiting for auth routes if configured
    if (skipAuthRoutes && req.path.startsWith('/auth')) {
      console.log('🚫 Skipping rate limit for auth route:', req.path);
      return next();
    }
    
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    console.log('🔍 Rate limit check:', {
      path: req.path,
      method: req.method,
      key: key,
      max: max,
      windowMs: windowMs
    });

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
      
      console.log('🚫 Rate limit exceeded:', {
        path: req.path,
        key: key,
        requests: rateLimitData.requests.length,
        max: max,
        resetTime: resetTime.toISOString()
      });
      
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
  max: 20, // 20 login attempts per 15 minutes (more reasonable for development)
  message: 'יותר מדי ניסיונות התחברות, אנא המתן 15 דקות'
});

export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 signup attempts per hour (more reasonable for development)
  message: 'יותר מדי ניסיונות הרשמה, אנא המתן שעה'
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 payment attempts per 5 minutes
  message: 'יותר מדי ניסיונות תשלום, אנא המתן 5 דקות'
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes (increased for development)
  message: 'יותר מדי בקשות, אנא נסה שוב מאוחר יותר',
  skipAuthRoutes: true // Skip auth routes to avoid double rate limiting
});

// Development-friendly rate limiters (less restrictive)
export const devLoginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 login attempts per 5 minutes
  message: 'יותר מדי ניסיונות התחברות, אנא המתן 5 דקות'
});

export const devSignupRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 signup attempts per 15 minutes
  message: 'יותר מדי ניסיונות הרשמה, אנא המתן 15 דקות'
});

// Function to clear rate limits (for development/testing)
export function clearRateLimits() {
  rateLimitStore.clear();
  console.log('🧹 Rate limits cleared for development');
}

// Function to get current rate limit status (for debugging)
export function getRateLimitStatus(key) {
  const data = rateLimitStore.get(key);
  if (!data) return null;
  
  const now = Date.now();
  const windowStart = now - (15 * 60 * 1000); // 15 minutes
  const recentRequests = data.requests.filter(requestTime => requestTime > windowStart);
  
  return {
    key,
    requests: recentRequests.length,
    firstRequest: data.firstRequest,
    oldestRequest: recentRequests[0] || null,
    resetTime: recentRequests[0] ? new Date(recentRequests[0] + 15 * 60 * 1000) : null
  };
}
