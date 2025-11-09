'use client';

import { useQuery } from '@tanstack/react-query';
import { Market } from '@/lib/api/polymarket';
import { extractNewsKeywords, keywordsToQuery } from '@/lib/utils/news-keywords';

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

  // Extract keywords from market
  const keywords = market ? extractNewsKeywords(market) : [];
  const keywordsQuery = keywordsToQuery(keywords);

  return useQuery({
    queryKey: ['adjacent-news', market?.id, keywordsQuery, days, limit, excludeDomains, includeDomains],
    queryFn: async (): Promise<NewsResponse> => {
      if (!market) {
        throw new Error('Market is required');
      }

      if (keywords.length === 0) {
        throw new Error('No keywords extracted from market');
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        keywords: keywordsQuery,
        days: days.toString(),
        limit: limit.toString(),
      });

      if (excludeDomains) {
        queryParams.append('excludeDomains', excludeDomains);
      }

      if (includeDomains) {
        queryParams.append('includeDomains', includeDomains);
      }

      // Call our API route which proxies to NewsAPI.ai
      const apiUrl = `/api/newsapi-ai?${queryParams.toString()}`;
      
      console.log('[useAdjacentNews] Fetching news for market:', market.question);
      console.log('[useAdjacentNews] Extracted keywords:', keywords);
      console.log('[useAdjacentNews] Keywords query string:', keywordsQuery);

      const response = await fetch(apiUrl);

      // First check if response is OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }));
        const errorMessage = errorData.error || errorData.details || `Failed to fetch news: ${response.statusText}`;
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
    enabled: enabled && !!market && keywords.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - news doesn't change as frequently as prices
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

