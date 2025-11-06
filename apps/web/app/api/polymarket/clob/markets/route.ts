import { NextRequest, NextResponse } from 'next/server';

const CLOB_API_BASE = process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com';

/**
 * API route to proxy Polymarket CLOB API markets requests
 * This avoids CORS issues when calling from the browser
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conditionId = searchParams.get('conditionId');
    const active = searchParams.get('active') ?? 'true';
    const limit = searchParams.get('limit') ?? '1000';
    
    // If conditionId is provided, fetch specific market
    if (conditionId) {
      const clobUrl = `${CLOB_API_BASE}/markets/${conditionId}`;
      console.log('[CLOB API] Fetching market by conditionId:', conditionId);
      
      const response = await fetch(clobUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[CLOB API] Market fetch failed (${response.status}):`, errorText);
        return NextResponse.json(
          { error: `CLOB API error (${response.status}): ${response.statusText}`, details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }
    
    // Otherwise, fetch markets list
    const clobUrl = `${CLOB_API_BASE}/markets?active=${active}&limit=${limit}`;
    console.log('[CLOB API] Fetching markets list:', clobUrl);
    
    const response = await fetch(clobUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[CLOB API] Markets list fetch failed (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `CLOB API error (${response.status}): ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[CLOB API] ✅ Successfully fetched ${Array.isArray(data) ? data.length : 0} markets from CLOB API`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[CLOB API] Error proxying CLOB request:', error);
    
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








