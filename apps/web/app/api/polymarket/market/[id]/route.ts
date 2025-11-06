import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy Polymarket Gamma API market requests
 * This avoids CORS issues when calling from the browser
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Market ID is required' }, { status: 400 });
    }

    // Gamma API accepts:
    // 1. Numeric ID: /markets/12
    // 2. Slug: /markets/will-joe-biden-win
    // 3. ConditionId: might need to use as query param or different endpoint
    // Let's try the conditionId first, then fallback to searching
    
    let gammaApiUrl = `https://gamma-api.polymarket.com/markets/${id}`;
    
    // If ID looks like a condition ID (hex address starting with 0x), try query param approach
    // Otherwise try direct path first
    if (id.startsWith('0x') && id.length > 20) {
      // Try conditionId as query parameter
      gammaApiUrl = `https://gamma-api.polymarket.com/markets?conditionId=${id}`;
    }
    
    const response = await fetch(gammaApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    // If direct path failed and it's a conditionId, try to search in markets list
    if (!response.ok && response.status === 422 && id.startsWith('0x')) {
      console.log(`[API] Direct lookup failed, searching markets for conditionId: ${id}`);
      // Try to get markets and filter by conditionId
      const searchResponse = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=100', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (searchResponse.ok) {
        const markets = await searchResponse.json();
        const market = Array.isArray(markets) 
          ? markets.find((m: any) => m.conditionId?.toLowerCase() === id.toLowerCase())
          : null;
        
        if (market) {
          return NextResponse.json(market);
        }
      }
      
      // If still not found, return the original 422 error
      const errorText = await response.text().catch(() => '');
      let errorData: any = { error: `Gamma API error (${response.status}): ${response.statusText}` };
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData.details = errorText;
      }
      return NextResponse.json(errorData, { status: response.status });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData: any = { error: `Gamma API error (${response.status}): ${response.statusText}` };
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData.details = errorText;
      }
      
      // Log error for debugging
      console.error(`[API] Gamma API error for market ${id}:`, errorData);
      
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API] Error proxying market request:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - Gamma API took too long to respond' },
        { status: 504 }
      );
    }
    
    // If it's a network error (like CORS), return a helpful message
    if (error.message?.includes('fetch') || error.message?.includes('CORS')) {
      return NextResponse.json(
        { error: 'Network error - could not reach Gamma API', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market from Gamma API', details: error.toString() },
      { status: 500 }
    );
  }
}

