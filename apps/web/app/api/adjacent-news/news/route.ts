import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy Adjacent News API requests
 * This avoids CORS issues and keeps the API key secure on the server
 * Docs: https://docs.adj.news/api-news-market
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const market = searchParams.get('market');
    const days = searchParams.get('days') ?? '7';
    const limit = searchParams.get('limit') ?? '10';
    const excludeDomains = searchParams.get('excludeDomains');
    const includeDomains = searchParams.get('includeDomains');

    if (!market) {
      return NextResponse.json(
        { error: 'Market query parameter is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.ADJACENT_NEWS_API_KEY;
    if (!apiKey) {
      console.warn('[Adjacent News API] No API key found in environment. API calls will likely fail.');
      // Return a helpful error message if API key is missing
      return NextResponse.json(
        { 
          error: 'API key not configured',
          details: 'Please set ADJACENT_NEWS_API_KEY in your environment variables (.env.local)',
          hint: 'Get your API key from https://adj.news'
        },
        { status: 401 }
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      days,
      limit,
    });
    
    if (excludeDomains) {
      queryParams.append('excludeDomains', excludeDomains);
    }
    
    if (includeDomains) {
      queryParams.append('includeDomains', includeDomains);
    }

    // Call Adjacent News API
    // Note: The market parameter goes in the path, not query params
    const apiUrl = `https://api.data.adj.news/api/news/${encodeURIComponent(market)}?${queryParams.toString()}`;
    
    console.log('[Adjacent News API] Fetching news for market:', market);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData: any = { 
        error: `Adjacent News API error (${response.status}): ${response.statusText}` 
      };
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData.details = errorText;
      }
      
      console.error(`[Adjacent News API] Error:`, errorData);
      
      // Return a user-friendly error for 401 (unauthorized) and 403 (forbidden)
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { 
            error: 'API key missing or invalid. Please configure ADJACENT_NEWS_API_KEY in environment variables.',
            details: errorData 
          },
          { status: response.status }
        );
      }
      
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    
    // Check if the response contains an error (some APIs return errors with 200 status)
    if (data.error) {
      console.error(`[Adjacent News API] Error in response:`, data.error);
      return NextResponse.json(
        { 
          error: data.error || 'Unknown error from Adjacent News API',
          details: data.details || data 
        },
        { status: 400 }
      );
    }

    // Validate response structure
    if (!data.data || !Array.isArray(data.data)) {
      console.error(`[Adjacent News API] Invalid response structure:`, data);
      return NextResponse.json(
        { 
          error: 'Invalid response format from Adjacent News API',
          details: 'Response does not contain a data array'
        },
        { status: 502 }
      );
    }

    console.log(`[Adjacent News API] ✅ Successfully fetched ${data.data?.length || 0} news articles`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Adjacent News API] Error proxying news request:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - Adjacent News API took too long to respond' },
        { status: 504 }
      );
    }
    
    // If it's a network error (like CORS), return a helpful message
    if (error.message?.includes('fetch') || error.message?.includes('CORS')) {
      return NextResponse.json(
        { error: 'Network error - could not reach Adjacent News API', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news from Adjacent News API', details: error.toString() },
      { status: 500 }
    );
  }
}
