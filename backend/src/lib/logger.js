import { supabaseAdmin } from '../supabase.js';

/**
 * Centralized logging utility that logs to both console and database
 * This helps overcome Vercel's log limitations
 */

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Log to database asynchronously (fire and forget)
   */
  async logToDatabase(level, message, options = {}) {
    try {
      const {
        error,
        errorDetails,
        stackTrace,
        requestPath,
        requestMethod,
        userId,
        ipAddress,
        userAgent,
        additionalContext
      } = options;

      // Prepare error details
      let errorDetailsJson = errorDetails;
      if (error && typeof error === 'object') {
        errorDetailsJson = {
          message: error.message,
          code: error.code,
          name: error.name,
          ...errorDetails
        };
      }

      const logEntry = {
        level,
        message,
        error_details: errorDetailsJson || null,
        stack_trace: stackTrace || (error?.stack) || null,
        request_path: requestPath || null,
        request_method: requestMethod || null,
        user_id: userId || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        additional_context: additionalContext || null
      };

      // Insert into database (fire and forget - don't await)
      supabaseAdmin
        .from('error_logs')
        .insert(logEntry)
        .then(({ error: dbError }) => {
          if (dbError) {
            console.error('[Logger] Failed to write to database:', dbError.message);
          }
        })
        .catch(err => {
          console.error('[Logger] Database logging error:', err);
        });

    } catch (err) {
      // Never let logging errors crash the application
      console.error('[Logger] Logging failed:', err);
    }
  }

  /**
   * Extract request information from Express request object
   */
  extractRequestInfo(req) {
    if (!req) return {};
    
    return {
      requestPath: req.path || req.url,
      requestMethod: req.method,
      userId: req.user?.id || req.adminUser?.id || null,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    };
  }

  /**
   * Log an error
   */
  error(message, error = null, req = null, additionalContext = null) {
    const timestamp = new Date().toISOString();
    
    // Console log
    console.error(`[${timestamp}] ERROR:`, message);
    if (error) {
      console.error('Error details:', error);
      if (error.stack && this.isDevelopment) {
        console.error('Stack trace:', error.stack);
      }
    }
    if (additionalContext) {
      console.error('Context:', additionalContext);
    }

    // Database log
    const requestInfo = this.extractRequestInfo(req);
    this.logToDatabase(LOG_LEVELS.ERROR, message, {
      error,
      stackTrace: error?.stack,
      additionalContext,
      ...requestInfo
    });
  }

  /**
   * Log a warning
   */
  warn(message, req = null, additionalContext = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN:`, message);
    if (additionalContext) {
      console.warn('Context:', additionalContext);
    }

    const requestInfo = this.extractRequestInfo(req);
    this.logToDatabase(LOG_LEVELS.WARN, message, {
      additionalContext,
      ...requestInfo
    });
  }

  /**
   * Log info (only log critical info to database to save space)
   */
  info(message, req = null, additionalContext = null, saveToDb = false) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO:`, message);
    if (additionalContext && this.isDevelopment) {
      console.log('Context:', additionalContext);
    }

    // Only save critical info to database to avoid filling it up
    if (saveToDb) {
      const requestInfo = this.extractRequestInfo(req);
      this.logToDatabase(LOG_LEVELS.INFO, message, {
        additionalContext,
        ...requestInfo
      });
    }
  }

  /**
   * Log debug info (only in development)
   */
  debug(message, additionalContext = null) {
    if (this.isDevelopment) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] DEBUG:`, message);
      if (additionalContext) {
        console.log('Context:', additionalContext);
      }
    }
  }

  /**
   * Log API request (for monitoring)
   */
  apiRequest(req, responseStatus, responseTime = null) {
    // Only log failed requests (4xx, 5xx) to save resources on Vercel free plan
    if (responseStatus >= 400) {
      const message = `${req.method} ${req.path} - ${responseStatus}`;
      const context = {
        method: req.method,
        path: req.path,
        status: responseStatus,
        responseTime: responseTime,
        query: req.query,
        body: this.sanitizeBody(req.body)
      };
      
      // Log to console and database for errors
      if (responseStatus >= 500) {
        console.error(`[ERROR] ${message}`, context);
      } else {
        console.warn(`[WARN] ${message}`, context);
      }
      
      this.logToDatabase(
        responseStatus >= 500 ? 'error' : 'warn',
        message,
        { additionalContext: context, ...this.extractRequestInfo(req) }
      );
    }
  }

  /**
   * Sanitize request body to remove sensitive data
   */
  sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Express middleware to log requests and errors
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.apiRequest(req, res.statusCode, duration);
  });
  
  next();
}

/**
 * Express error handler middleware
 */
export function errorLogger(err, req, res, next) {
  logger.error('Unhandled error', err, req);
  
  // Send error response
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

