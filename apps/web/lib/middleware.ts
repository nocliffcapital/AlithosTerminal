import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimitConfigs } from './middleware-api';
import { getRateLimitHeaders } from './rate-limit';

export function middleware(request: NextRequest) {
  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Apply rate limiting based on route type
    const path = request.nextUrl.pathname;
    
    // Determine rate limit based on route
    let limiter = rateLimitConfigs.read; // Default to read limit
    
    // Write operations (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      limiter = rateLimitConfigs.write;
    }
    
    // Specific routes that need different limits
    if (path.includes('/alerts') || path.includes('/workspaces') || path.includes('/positions')) {
      limiter = rateLimitConfigs.authenticated;
    }
    
    // Public proxy routes (polymarket API, etc.)
    if (path.includes('/polymarket') || path.includes('/adjacent-news')) {
      limiter = rateLimitConfigs.public;
    }

    // Apply rate limiting
    // NextRequest extends Request, so it's compatible with rate limiter
    const rateLimitResult = limiter(request as Request);
    
    if (!rateLimitResult.allowed) {
      const headers = getRateLimitHeaders(
        rateLimitResult.remaining,
        rateLimitResult.resetTime,
        rateLimitResult.retryAfter
      );

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    const rateLimitHeaders = getRateLimitHeaders(
      rateLimitResult.remaining,
      rateLimitResult.resetTime
    );
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

