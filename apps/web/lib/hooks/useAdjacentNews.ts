'use client';

import { useQuery } from '@tanstack/react-query';

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
  market: string | null; // Market query (can be market question, topic, or keywords)
  days?: number; // Number of days to look back (1-30, default: 7)
  limit?: number; // Maximum number of results (1-50, default: 10)
  excludeDomains?: string; // Comma-separated list of domains to exclude
  includeDomains?: string; // Comma-separated list of domains to include
  enabled?: boolean; // Whether the query should be enabled
}

/**
 * Hook to fetch news articles related to a market from Adjacent News API
 * Docs: https://docs.adj.news/api-news-market
 */
export function useAdjacentNews(params: UseAdjacentNewsParams) {
  const { market, days = 7, limit = 10, excludeDomains, includeDomains, enabled = true } = params;

  return useQuery({
    queryKey: ['adjacent-news', market, days, limit, excludeDomains, includeDomains],
    queryFn: async (): Promise<NewsResponse> => {
      if (!market) {
        throw new Error('Market query is required');
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        days: days.toString(),
        limit: limit.toString(),
      });

      if (excludeDomains) {
        queryParams.append('excludeDomains', excludeDomains);
      }

      if (includeDomains) {
        queryParams.append('includeDomains', includeDomains);
      }

      // Call our API route which proxies to Adjacent News API
      const apiUrl = `/api/adjacent-news/news?market=${encodeURIComponent(market)}&${queryParams.toString()}`;
      
      console.log('[useAdjacentNews] Fetching news for market:', market);

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
      
      return data;
    },
    enabled: enabled && !!market,
    staleTime: 5 * 60 * 1000, // 5 minutes - news doesn't change as frequently as prices
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

