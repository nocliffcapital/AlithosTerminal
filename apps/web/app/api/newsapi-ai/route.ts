import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy NewsAPI.ai requests
 * This avoids CORS issues and keeps the API key secure on the server
 * Docs: https://newsapi.ai/documentation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keywords = searchParams.get('keywords');
    const days = searchParams.get('days') ?? '7';
    const limit = searchParams.get('limit') ?? '10';
    const excludeDomains = searchParams.get('excludeDomains');
    const includeDomains = searchParams.get('includeDomains');

    if (!keywords) {
      return NextResponse.json(
        { error: 'Keywords query parameter is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.NEWSAPI_AI_API_KEY;
    if (!apiKey) {
      console.warn('[NewsAPI.ai] No API key found in environment. API calls will likely fail.');
      return NextResponse.json(
        { 
          error: 'API key not configured',
          details: 'Please set NEWSAPI_AI_API_KEY in your environment variables (.env.local)',
          hint: 'Get your API key from https://newsapi.ai'
        },
        { status: 401 }
      );
    }

    // NewsAPI.ai (Event Registry) endpoint structure
    // Based on documentation: https://newsapi.ai/documentation
    // Endpoint: https://eventregistry.org/api/v1/article/getArticles
    // API key should be in request body, not headers
    const baseUrl = 'https://eventregistry.org/api/v1/article/getArticles';

    console.log('[NewsAPI.ai] Fetching news for keywords:', keywords);
    console.log('[NewsAPI.ai] Using API key:', apiKey.substring(0, 8) + '...');

    const daysNum = parseInt(days, 10);

    // Event Registry supports keyword as string or string array
    // For better results, we'll use keywords as an array with OR logic
    // This allows Event Registry to find articles containing ANY of the keywords
    // This is more flexible than requiring ALL keywords (AND logic)
    const keywordArray = typeof keywords === 'string' 
      ? keywords.split(' ').filter(k => k.trim().length > 0)
      : Array.isArray(keywords) 
        ? keywords
        : [String(keywords)];

    // Build request body according to Event Registry API documentation
    // Use forceMaxDataTimeWindow for efficient token usage when possible
    const requestBody: any = {
      action: 'getArticles',
      keyword: keywordArray, // Use array instead of string
      keywordOper: 'or', // Use OR logic - articles containing ANY keyword
      articlesPage: 1,
      articlesCount: parseInt(limit, 10),
      articlesSortBy: 'date',
      articlesSortByAsc: false,
      resultType: 'articles',
      dataType: ['news', 'pr'],
      apiKey: apiKey, // API key in request body, not headers!
    };

    console.log('[NewsAPI.ai] Request body:', JSON.stringify(requestBody, null, 2));

    // Use forceMaxDataTimeWindow for efficient token usage (only valid values: 7 or 31)
    // This is more efficient than using dateStart/dateEnd
    if (daysNum <= 7) {
      requestBody.forceMaxDataTimeWindow = 7;
    } else if (daysNum <= 31) {
      requestBody.forceMaxDataTimeWindow = 31;
    } else {
      // For longer periods, use dateStart and dateEnd
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      requestBody.dateStart = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      requestBody.dateEnd = endDate.toISOString().split('T')[0];
    }

    // Add domain filtering if provided
    if (excludeDomains) {
      // Event Registry uses ignoreSourceUri for excluding domains
      const domains = excludeDomains.split(',').map(d => d.trim());
      requestBody.ignoreSourceUri = domains;
    }
    if (includeDomains) {
      // Event Registry uses sourceUri for including domains
      const domains = includeDomains.split(',').map(d => d.trim());
      requestBody.sourceUri = domains;
    }

    // Make POST request (Event Registry supports both GET and POST, but POST is recommended)
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData: any = { 
        error: `NewsAPI.ai API error (${response.status}): ${response.statusText}` 
      };
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData.details = errorText;
      }
      
      console.error(`[NewsAPI.ai] Error (${response.status}):`, errorData);
      console.error(`[NewsAPI.ai] Error text:`, errorText);
      console.error(`[NewsAPI.ai] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      // Return a user-friendly error for 401 (unauthorized) and 403 (forbidden)
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { 
            error: 'API key missing or invalid. Please configure NEWSAPI_AI_API_KEY in environment variables.',
            details: errorData,
            hint: 'Check the server console logs for more details about the API response',
            apiKeyPrefix: apiKey.substring(0, 8) + '...',
          },
          { status: response.status }
        );
      }

      // Handle rate limiting
      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please try again later.',
            details: errorData 
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    
    console.log('[NewsAPI.ai] Raw API response:', JSON.stringify(data, null, 2));
    console.log('[NewsAPI.ai] Response status:', response.status);
    
    // Check if the response contains an error (some APIs return errors with 200 status)
    if (data.error || data.status === 'error' || data.errorCode) {
      console.error(`[NewsAPI.ai] Error in response:`, data.error || data.message || data.errorCode);
      return NextResponse.json(
        { 
          error: data.error || data.message || data.errorCode || 'Unknown error from NewsAPI.ai',
          details: data 
        },
        { status: 400 }
      );
    }
    
    // Check if Event Registry returned a warning or info message
    if (data.warnings || data.info) {
      console.warn('[NewsAPI.ai] Warnings/Info:', data.warnings || data.info);
    }

    // Map Event Registry (NewsAPI.ai) response to our NewsResponse format
    // Event Registry response structure: { articles: { results: [...] }, totalResults: number }
    let articles: any[] = [];
    
    console.log('[NewsAPI.ai] Parsing response structure...');
    console.log('[NewsAPI.ai] data.articles:', JSON.stringify(data.articles, null, 2));
    console.log('[NewsAPI.ai] data.articles?.results:', data.articles?.results);
    console.log('[NewsAPI.ai] data.articles keys:', data.articles ? Object.keys(data.articles) : 'none');
    console.log('[NewsAPI.ai] data.articles.results type:', typeof data.articles?.results);
    console.log('[NewsAPI.ai] data.articles.results is array:', Array.isArray(data.articles?.results));
    
    if (data.articles && data.articles.results && Array.isArray(data.articles.results)) {
      // Event Registry format: { articles: { results: [...] } }
      articles = data.articles.results;
      console.log('[NewsAPI.ai] Found articles in data.articles.results:', articles.length);
    } else if (data.articles && Array.isArray(data.articles)) {
      // Alternative format: { articles: [...] }
      articles = data.articles;
      console.log('[NewsAPI.ai] Found articles in data.articles array:', articles.length);
    } else if (data.results && Array.isArray(data.results)) {
      // Format: { results: [...] }
      articles = data.results;
      console.log('[NewsAPI.ai] Found articles in data.results:', articles.length);
    } else if (Array.isArray(data)) {
      // Format: [...]
      articles = data;
      console.log('[NewsAPI.ai] Found articles in root array:', articles.length);
    } else if (data.data && Array.isArray(data.data)) {
      // Format: { data: [...] }
      articles = data.data;
      console.log('[NewsAPI.ai] Found articles in data.data:', articles.length);
    } else {
      console.warn('[NewsAPI.ai] No articles found in response. Response structure:', Object.keys(data));
    }

    // Map Event Registry articles to our NewsArticle format
    const mappedArticles = articles.map((article: any) => {
      // Event Registry article structure:
      // - title: string
      // - url: string
      // - date: string (YYYY-MM-DD or ISO format)
      // - time: string (HH:MM:SS)
      // - body: string (article content)
      // - source: { title: string, uri: string }
      // - author: string or array
      const title = article.title || '';
      const url = article.url || article.link || '';
      // Combine date and time if both exist
      let publishedDate = article.date || article.publishedAt || '';
      if (article.time && publishedDate) {
        publishedDate = `${publishedDate}T${article.time}`;
      } else if (article.time) {
        publishedDate = article.time;
      }
      // Handle author (can be string or array)
      const author = Array.isArray(article.author) 
        ? article.author[0] || null 
        : article.author || null;
      // Source can be object with title/uri or just a string
      const domain = article.source?.title || article.source?.uri || article.source || article.domain || '';
      // Use body for snippet, limit to 200 chars
      const snippet = article.body 
        ? (article.body.length > 200 ? article.body.substring(0, 200) + '...' : article.body)
        : article.description || article.snippet || article.summary || '';

      return {
        title,
        url,
        publishedDate,
        author,
        domain,
        snippet,
      };
    }).filter((article: any) => article.title && article.url); // Filter out invalid articles

    // Build response in our format
    // Event Registry response includes totalResults in articles object
    // Check both data.articles.totalResults and data.totalResults
    const totalResults = data.articles?.totalResults ?? data.totalResults ?? data.total ?? mappedArticles.length;
    
    console.log('[NewsAPI.ai] Total results from API:', totalResults);
    console.log('[NewsAPI.ai] data.articles.totalResults:', data.articles?.totalResults);
    console.log('[NewsAPI.ai] data.totalResults:', data.totalResults);
    
    const responseData = {
      data: mappedArticles,
      meta: {
        query: keywords,
        days: parseInt(days, 10),
        limit: parseInt(limit, 10),
        totalResults: totalResults,
        searchTime: data.searchTime || new Date().toISOString(),
        ...(excludeDomains && { excludeDomains: excludeDomains.split(',').map(d => d.trim()) }),
        ...(includeDomains && { includeDomains: includeDomains.split(',').map(d => d.trim()) }),
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            keywordsReceived: keywords,
            keywordArray: keywordArray,
            keywordOper: 'or',
            requestBody: requestBody,
            rawResponseStructure: {
              hasArticles: !!data.articles,
              hasResults: !!data.results,
              articlesType: typeof data.articles,
              articlesKeys: data.articles ? Object.keys(data.articles) : [],
              articlesResultsType: data.articles?.results ? typeof data.articles.results : 'none',
              articlesResultsLength: data.articles?.results ? (Array.isArray(data.articles.results) ? data.articles.results.length : 'not array') : 'none',
              totalResultsFromAPI: data.articles?.totalResults ?? data.totalResults ?? 'unknown',
              totalResultsValue: data.articles?.totalResults,
              totalResultsValue2: data.totalResults,
              sampleArticle: data.articles?.results?.[0] || 'none',
            },
            fullResponseKeys: Object.keys(data),
          },
        }),
      },
    };

    console.log(`[NewsAPI.ai] ✅ Successfully fetched ${mappedArticles.length} news articles`);
    
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[NewsAPI.ai] Error proxying news request:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout - NewsAPI.ai took too long to respond' },
        { status: 504 }
      );
    }
    
    // If it's a network error (like CORS), return a helpful message
    if (error.message?.includes('fetch') || error.message?.includes('CORS')) {
      return NextResponse.json(
        { error: 'Network error - could not reach NewsAPI.ai', details: error.message },
        { status: 502 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news from NewsAPI.ai', details: error.toString() },
      { status: 500 }
    );
  }
}

