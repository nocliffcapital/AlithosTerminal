/**
 * API route middleware utilities
 * Provides rate limiting, error handling, and common middleware functions
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimiters, getRateLimitHeaders } from './rate-limit';

/**
 * Rate limit configuration for different route types
 */
export const rateLimitConfigs = {
  // Strict limits for write operations (create, update, delete)
  write: rateLimiters.strict, // 10 req/min

  // Standard limits for read operations
  read: rateLimiters.standard, // 60 req/min

  // Moderate limits for data-heavy endpoints
  data: rateLimiters.moderate, // 100 req/min

  // Generous limits for public endpoints
  public: rateLimiters.generous, // 200 req/min

  // User-based limits for authenticated endpoints
  authenticated: rateLimiters.userBased(60 * 1000, 120), // 120 req/min per user
};

/**
 * Apply rate limiting to API route
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  limiter: (request: Request) => ReturnType<typeof rateLimit> = rateLimitConfigs.read
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const result = limiter(request);

    if (!result.allowed) {
      const headers = getRateLimitHeaders(result.remaining, result.resetTime, result.retryAfter);

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Call handler
    const response = await handler(request, ...args);

    // Add rate limit headers to response
    const rateLimitHeaders = getRateLimitHeaders(result.remaining, result.resetTime);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Error handler wrapper for API routes
 */
export function withErrorHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      console.error('[API Error]', error);

      if (error instanceof Error) {
        return NextResponse.json(
          {
            error: 'Internal server error',
            details: error.message,
            ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error', details: 'Unknown error occurred' },
        { status: 500 }
      );
    }
  };
}

/**
 * Combine multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<(request: NextRequest, ...args: any[]) => Promise<NextResponse>>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    let response: NextResponse | null = null;

    for (const middleware of middlewares) {
      response = await middleware(request, ...args);
      // If middleware returns a response (like rate limit exceeded), stop chain
      if (response && response.status !== 200 && response.status !== 201) {
        return response;
      }
    }

    return response || NextResponse.json({ error: 'No handler' }, { status: 500 });
  };
}

/**
 * Helper to create rate-limited API route handlers
 * 
 * @example
 * export const GET = createRateLimitedHandler(
 *   rateLimitConfigs.read,
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ data: '...' });
 *   }
 * );
 */
export function createRateLimitedHandler(
  limiter: (request: Request) => ReturnType<typeof rateLimit>,
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return withErrorHandler(withRateLimit(handler, limiter));
}

