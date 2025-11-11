'use client';

import { useQuery } from '@tanstack/react-query';
import { Market } from '@/lib/api/polymarket';
import { extractNewsKeywords, keywordsToQuery, CoreKeywords } from '@/lib/utils/news-keywords';

export interface NewsArticle {
  title: string;
  url: string;
  publishedDate: string;
  author: string | null;
  domain: string;
  snippet?: string;
}

export interface NewsResponse {
  data: NewsArticle[];
  meta: {
    query: string;
    days: number;
    limit: number;
    totalResults?: number;
    searchTime?: string;
    excludeDomains?: string[];
    searchMethod?: 'neural' | 'fallback';
    queryProcessed?: string;
  };
}

export interface UseAdjacentNewsParams {
  market: Market | null; // Market object (changed from string | null)
  days?: number; // Number of days to look back (1-30, default: 7)
  limit?: number; // Maximum number of results (1-50, default: 10)
  excludeDomains?: string; // Comma-separated list of domains to exclude
  includeDomains?: string; // Comma-separated list of domains to include
  enabled?: boolean; // Whether the query should be enabled
}

/**
 * Hook to fetch news articles related to a market from NewsAPI.ai
 * Extracts keywords from market data and queries NewsAPI.ai
 * Docs: https://newsapi.ai/documentation
 */
export function useAdjacentNews(params: UseAdjacentNewsParams) {
  const { market, days = 7, limit = 10, excludeDomains, includeDomains, enabled = true } = params;

  // Extract structured keywords from market
  const keywords = market ? extractNewsKeywords(market) : { primary: [], secondary: [], related: [] };
  
  // Check if we have any keywords
  const hasKeywords = keywords.primary.length > 0 || keywords.secondary.length > 0 || keywords.related.length > 0;
  
  // Build core keywords (primary + secondary) for AND logic
  const coreKeywords = [...keywords.primary, ...keywords.secondary].filter(k => k && k.trim().length > 0);
  
  // Build related keywords for OR logic (optional)
  const relatedKeywords = keywords.related.filter(k => k && k.trim().length > 0);
  
  // For backward compatibility, also build a query string
  const keywordsQuery = keywordsToQuery(keywords);

  return useQuery({
    queryKey: ['adjacent-news', market?.id, coreKeywords.join(','), relatedKeywords.join(','), days, limit, excludeDomains, includeDomains],
    queryFn: async (): Promise<NewsResponse> => {
      if (!market) {
        throw new Error('Market is required');
      }

      if (!hasKeywords || coreKeywords.length === 0) {
        throw new Error('No keywords extracted from market');
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        coreKeywords: coreKeywords.join(','), // Use structured format
        days: days.toString(),
        limit: limit.toString(),
      });

      // Add related keywords if available
      if (relatedKeywords.length > 0) {
        queryParams.append('relatedKeywords', relatedKeywords.join(','));
      }

      if (excludeDomains) {
        queryParams.append('excludeDomains', excludeDomains);
      }

      if (includeDomains) {
        queryParams.append('includeDomains', includeDomains);
      }

      // Call our API route which proxies to NewsAPI.ai
      const apiUrl = `/api/newsapi-ai?${queryParams.toString()}`;
      
      console.log('[useAdjacentNews] Fetching news for market:', market.question);
      console.log('[useAdjacentNews] Extracted keywords (structured):', keywords);
      console.log('[useAdjacentNews] Core keywords:', coreKeywords);
      console.log('[useAdjacentNews] Related keywords:', relatedKeywords);
      console.log('[useAdjacentNews] Keywords query string (legacy):', keywordsQuery);

      const response = await fetch(apiUrl);

      // First check if response is OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }));
        const errorMessage = errorData.error || errorData.details || `Failed to fetch news: ${response.statusText}`;
        
        // If it's a 401 with "API key not configured", this is expected - don't log as error
        if (response.status === 401 && errorData.error === 'API key not configured') {
          // API key is optional - return empty response gracefully
          return {
            data: [],
            meta: {
              query: keywordsQuery,
              days,
              limit,
              totalResults: 0,
            },
          };
        }
        
        // Log other errors
        console.error('[useAdjacentNews] HTTP Error:', errorMessage, errorData);
        throw new Error(errorMessage);
      }

      // Parse response
      const data = await response.json().catch((parseError) => {
        console.error('[useAdjacentNews] JSON parse error:', parseError);
        throw new Error('Failed to parse response from news API');
      });

      // Check if response body contains an error (some APIs return errors with 200 status)
      if (data.error) {
        const errorMessage = data.error || data.details || 'Unknown error from news API';
        console.error('[useAdjacentNews] API Error:', errorMessage, data);
        throw new Error(errorMessage);
      }

      // Validate response structure
      if (!data.data || !Array.isArray(data.data)) {
        console.error('[useAdjacentNews] Invalid response structure:', data);
        throw new Error('Invalid response format from news API - missing data array');
      }

      console.log('[useAdjacentNews] ✅ Received', data.data?.length || 0, 'news articles');
      
      // Log debug info if available (development only)
      if (data.meta?.debug && process.env.NODE_ENV === 'development') {
        console.log('[useAdjacentNews] Debug info:', data.meta.debug);
      }
      
      return data;
    },
    enabled: enabled && !!market && hasKeywords && coreKeywords.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - news doesn't change as frequently as prices
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

