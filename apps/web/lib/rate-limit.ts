/**
 * Rate limiting utility for API routes
 * Uses in-memory storage (upgrade to Redis for distributed deployments)
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Custom key generator (default: IP address)
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (upgrade to Redis for production with multiple instances)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}, 60 * 1000); // Cleanup every minute

// Get client identifier (IP address or custom)
function getClientId(request: Request, keyGenerator?: (request: Request) => string): string {
  if (keyGenerator) {
    return keyGenerator(request);
  }

  // Default: Use IP address from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return ip;
}

// Get rate limit key (route + client ID)
function getRateLimitKey(request: Request, clientId: string): string {
  const url = new URL(request.url);
  const path = url.pathname;
  return `${path}:${clientId}`;
}

/**
 * Rate limiter middleware
 * Returns rate limit info and whether the request should be allowed
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const { windowMs, maxRequests, keyGenerator } = config;
  const clientId = getClientId(request, keyGenerator);
  const key = getRateLimitKey(request, clientId);
  const now = Date.now();

  // Get or create entry
  let entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Check if limit exceeded
  const allowed = entry.count < maxRequests;

  if (allowed) {
    entry.count += 1;
  }

  store.set(key, entry);

  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfter = !allowed ? Math.ceil((entry.resetTime - now) / 1000) : undefined;

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter,
  };
}

/**
 * Create rate limiter with preset configurations
 */
export const rateLimiters = {
  // Strict rate limit (10 requests per minute)
  strict: (request: Request) =>
    rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    }),

  // Standard rate limit (60 requests per minute)
  standard: (request: Request) =>
    rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
    }),

  // Moderate rate limit (100 requests per minute)
  moderate: (request: Request) =>
    rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    }),

  // Generous rate limit (200 requests per minute)
  generous: (request: Request) =>
    rateLimit(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
    }),

  // Custom rate limit for specific routes
  custom: (windowMs: number, maxRequests: number) => (request: Request) =>
    rateLimit(request, {
      windowMs,
      maxRequests,
    }),

  // User-based rate limit (requires userId in request)
  userBased: (windowMs: number, maxRequests: number) => (request: Request) => {
    // Try to get userId from request (could be in headers, query params, or body)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || request.headers.get('x-user-id') || 'anonymous';

    return rateLimit(request, {
      windowMs,
      maxRequests,
      keyGenerator: () => `user:${userId}`,
    });
  },
};

/**
 * Rate limit headers to add to response
 */
export function getRateLimitHeaders(
  remaining: number,
  resetTime: number,
  retryAfter?: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': '60', // Will be dynamic based on config
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
  };

  if (retryAfter !== undefined) {
    headers['Retry-After'] = String(retryAfter);
  }

  return headers;
}

/**
 * Cleanup function (call on server shutdown)
 */
export function cleanupRateLimitStore(): void {
  clearInterval(cleanupInterval);
  store.clear();
}

