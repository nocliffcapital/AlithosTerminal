import { NextRequest, NextResponse } from 'next/server';

const CLOB_API_BASE = process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com';

/**
 * API route to proxy Polymarket CLOB API book requests
 * This avoids CORS issues when calling from the browser
 * Supports L1 authentication headers passed from the client
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('token_id');
    
    if (!tokenId) {
      return NextResponse.json(
        { error: 'token_id parameter is required' },
        { status: 400 }
      );
    }
    
    // Build CLOB API URL
    const clobUrl = `${CLOB_API_BASE}/book?token_id=${tokenId}`;
    // Suppress repeated log messages
    
    // Get L1 auth headers from request (if provided)
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Forward L1 authentication headers if present
    const authHeaders = [
      'x-polymarket-signature',
      'x-polymarket-signature-expiration',
      'x-polymarket-signature-address',
    ];
    
    authHeaders.forEach(headerName => {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        headers[headerName] = headerValue;
      }
    });
    
    // Make request to CLOB API
    const response = await fetch(clobUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      // Only log first occurrence of errors to avoid spam
      const errorKey = `orderbook-${response.status}-${tokenId.substring(0, 10)}`;
      if (!(global as any).__orderbook_errors || !(global as any).__orderbook_errors[errorKey]) {
        (global as any).__orderbook_errors = (global as any).__orderbook_errors || {};
        (global as any).__orderbook_errors[errorKey] = true;
        console.warn(`[CLOB API] Orderbook fetch failed (${response.status}):`, errorText.substring(0, 200));
      }
      return NextResponse.json(
        { error: `CLOB API error (${response.status}): ${response.statusText}`, details: errorText.substring(0, 500) },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Suppress success logs to reduce console noise
    return NextResponse.json(data);
  } catch (error: any) {
    // Only log error details once per tokenId to avoid spam
    const errorKey = `orderbook-error-${tokenId?.substring(0, 10) || 'unknown'}`;
    if (!(global as any).__orderbook_errors || !(global as any).__orderbook_errors[errorKey]) {
      (global as any).__orderbook_errors = (global as any).__orderbook_errors || {};
      (global as any).__orderbook_errors[errorKey] = true;
      console.error('[CLOB API] Error proxying orderbook request:', error.message || error);
    }
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - CLOB API took too long to respond.', details: error.message },
        { status: 504 }
      );
    }
    
    if (error.message?.includes('fetch') || error.message?.includes('CORS') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return NextResponse.json(
        { error: 'Network error - could not reach CLOB API.', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch from CLOB API.', details: error.toString() },
      { status: 500 }
    );
  }
}

