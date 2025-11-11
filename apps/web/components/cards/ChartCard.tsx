'use client';

import React from 'react';
import { useMarketPrice, useHistoricalPrices, useMarket, useMarkets } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useMarketStore } from '@/stores/market-store';
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { polymarketClient } from '@/lib/api/polymarket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
import { CardMarketContext } from '@/components/layout/Card';
import { convertHistoricalPricesToLightweight, chartColors } from '@/lib/charts/utils';

interface OutcomeData {
  tokenId: string;
  outcome: string;
  historicalPrices: Array<{ timestamp: number; price: number }>;
  color: string;
}

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

interface ChartCardProps {
  marketId?: string; // Optional marketId prop from card config (legacy support)
  marketIds?: string[]; // Optional marketIds array prop from card config (new multi-market support)
  onMarketChange?: (marketId: string | null) => void; // Callback to update card props (legacy)
  onMarketIdsChange?: (marketIds: string[]) => void; // Callback to update card props (new)
}

function ChartCardComponent({ marketId: propMarketId, marketIds: propMarketIds, onMarketChange, onMarketIdsChange }: ChartCardProps = {}) {
  const { getMarket } = useMarketStore();
  const { setMarketQuestion } = React.useContext(CardMarketContext);
  
  // Support both single marketId (legacy) and marketIds array (new)
  // Use props only - don't fall back to global state to avoid shared state issues
  // Handle both undefined and empty array cases
  // When loading from DB, a card might have marketId set but not marketIds, so we need to handle both
  const hasMultiMarketSupport = propMarketIds !== undefined && Array.isArray(propMarketIds);
  const effectiveMarketIds = hasMultiMarketSupport 
    ? (propMarketIds || [])
    : (propMarketId ? [propMarketId] : []);
  
  // For backward compatibility, also support single marketId
  // Ensure we have at least one market ID to fetch data
  // If we have marketIds array, use first one; otherwise use marketId prop directly
  const chartMarketId = effectiveMarketIds.length > 0 
    ? effectiveMarketIds[0] 
    : (propMarketId || null);
  
  // All hooks must be called unconditionally - call them even if chartMarketId is null
  // This ensures hooks are always called in the same order
  const queryClient = useQueryClient(); // Must be called before other hooks
  const { data: currentPrice } = useMarketPrice(chartMarketId || null);
  
  // Get data freshness timestamp
  const dataUpdatedAt = currentPrice?.timestamp ? new Date(currentPrice.timestamp) : undefined;
  
  // Subscribe to real-time price updates for instant price updates (only if we have a market)
  useRealtimePrice(chartMarketId || null, 'YES');
  
  // Fetch current prices for all markets in multi-market view
  const multiMarketPrices = useQuery({
    queryKey: ['multi-market-prices', effectiveMarketIds],
    queryFn: async () => {
      if (effectiveMarketIds.length <= 1) return [];
      const pricePromises = effectiveMarketIds.map(marketId => 
        polymarketClient.getMarketPrice(marketId).catch(() => null)
      );
      return await Promise.all(pricePromises);
    },
    enabled: effectiveMarketIds.length > 1,
    staleTime: 5 * 60 * 1000, // 5 minutes (increased from 30 seconds)
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchInterval: false, // Disable polling - rely on realtime updates
  });
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('All'); // 'All', 'Yes', 'No', or outcome name
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [showAddMarketSelector, setShowAddMarketSelector] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);
  const [isSelectedMarketsMinimized, setIsSelectedMarketsMinimized] = useState(true);
  const [hiddenMarketIds, setHiddenMarketIds] = useState<Set<string>>(new Set());
  const [hasSetDefaultOutcome, setHasSetDefaultOutcome] = useState(false); // Track if we've set the default outcome
  
  // Fetch all markets to find event groups
  const { data: allMarkets = [] } = useMarkets({ active: true });
  
  // Memoize handlers to prevent Dialog re-renders
  const handleMarketSelectorOpen = useCallback(() => {
    setShowMarketSelector(true);
  }, []);
  
  const handleMarketSelectorClose = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);
  
  // Calculate hours based on time range
  const getHoursForRange = (range: TimeRange): number | null => {
    switch (range) {
      case '1H': return 1;
      case '6H': return 6;
      case '1D': return 24;
      case '1W': return 24 * 7;
      case '1M': return 24 * 30;
      case 'ALL': return null;
      default: return 24;
    }
  };
  
  // Helper functions for interval and fidelity
  const getIntervalForHours = (hours: number): string => {
    if (hours <= 1) return '1h';
    if (hours <= 6) return '6h';
    if (hours <= 24) return '1d';
    if (hours <= 168) return '1w';
    if (hours <= 720) return '1m';
    return 'max';
  };
  
  const getFidelityForHours = (hours: number): number | undefined => {
    if (hours <= 1) return 1;
    if (hours <= 6) return 5;
    if (hours <= 24) return 15;
    if (hours <= 168) return 60;
    if (hours <= 720) return 240;
    return 1440;
  };
  
  const hours = getHoursForRange(timeRange);
  
  // Always fetch ALL data, timeRange is only used for initial zoom/focus, not for limiting data
  // This allows users to scroll/pan to see all historical data regardless of selected timeframe
  const dataFetchHours = null; // Always fetch all data
  
  // OPTIMIZATION: Prefetch common time ranges for instant switching
  useEffect(() => {
    if (!chartMarketId) return;
    
    // Helper functions for interval/fidelity (duplicated from usePolymarketData.ts)
    const getIntervalForHours = (hours: number): string => {
      if (hours <= 1) return '1h';
      if (hours <= 6) return '6h';
      if (hours <= 24) return '1d';
      if (hours <= 168) return '1w';  // 7 days
      if (hours <= 720) return '1m';  // 30 days
      return 'max';
    };
    
    const getFidelityForHours = (hours: number): number => {
      if (hours <= 1) return 1;      // 1-minute intervals for 1 hour
      if (hours <= 6) return 5;      // 5-minute intervals for 6 hours  
      if (hours <= 24) return 15;    // 15-minute intervals for 1 day
      if (hours <= 168) return 60;   // 1-hour intervals for 1 week
      if (hours <= 720) return 240;  // 4-hour intervals for 1 month
      return 1440;                   // Daily intervals for ALL
    };
    
    // Prefetch common time ranges (1D, 1W, 1M, 3M in hours)
    const timeRanges = [24, 168, 720, 2160]; // 1D, 1W, 1M, 3M in hours
    
    timeRanges.forEach((hours) => {
      queryClient.prefetchQuery({
        queryKey: ['historical-prices', chartMarketId, hours],
        queryFn: async () => {
          const interval = getIntervalForHours(hours);
          const fidelity = getFidelityForHours(hours);
          const prices = await polymarketClient.getHistoricalPrices(chartMarketId, interval, fidelity);
          return prices?.map((item) => ({
            timestamp: item.timestamp,
            price: item.price,
            probability: item.price * 100,
            noProbability: (1 - item.price) * 100,
          })) || [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
      });
    });
  }, [chartMarketId, queryClient]);
  
  // Fetch historical prices for all markets in the chart
  // We fetch more data than the selected time range to enable scrolling
  const { data: historicalPrices = [], isLoading } = useHistoricalPrices(chartMarketId || null, dataFetchHours);
  
  // Fetch full market data for all markets to ensure tokens are populated
  const marketsData = useQuery({
    queryKey: ['markets-data', effectiveMarketIds],
    queryFn: async () => {
      const marketPromises = effectiveMarketIds.map(async (marketId) => {
        const fetchedMarket = await polymarketClient.getMarket(marketId);
        const storedMarket = getMarket(marketId);
        return fetchedMarket || storedMarket;
      });
      return await Promise.all(marketPromises);
    },
    enabled: effectiveMarketIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  const fetchedMarkets = marketsData.data || [];
  const isLoadingMarket = marketsData.isLoading;
  
  // Use markets from allMarkets if available (has eventId/eventTitle), otherwise fall back to fetchedMarkets
  // This ensures we have the full market data with eventId populated
  const markets = useMemo(() => {
    if (effectiveMarketIds.length === 0) return [];
    
    return effectiveMarketIds.map(marketId => {
      // First, try to find market in allMarkets (has eventId/eventTitle populated)
      const marketFromAllMarkets = allMarkets.find(m => m.id === marketId);
      if (marketFromAllMarkets) return marketFromAllMarkets;
      
      // Fall back to fetched market
      const fetchedMarket = fetchedMarkets.find(m => m?.id === marketId);
      return fetchedMarket || null;
    }).filter(Boolean) as typeof fetchedMarkets;
  }, [effectiveMarketIds, allMarkets, fetchedMarkets]);
  
  // For backward compatibility, use first market
  const chartMarket = markets[0];
  
  // Helper function to detect if a market is multi-outcome (same logic as MarketDiscoveryCard)
  const isMultiOutcomeMarket = (market: typeof chartMarket): boolean => {
    if (!market) return false;
    
    // Check tokens array
    if (market.tokens && market.tokens.length > 2) {
      return true;
    }
    
    // Check clobTokenIds array
    if (market.clobTokenIds && market.clobTokenIds.length > 2) {
      return true;
    }
    
    // Check question pattern
    const question = market.question?.toLowerCase() || '';
    if (question.startsWith('who will') || question.startsWith('who will be')) {
      return true;
    }
    
    // Check keywords
    const multiOutcomeKeywords = ['who will win', 'who will be', 'who will have', 'top grossing', 'largest company', 'drivers champion', 'mvp', 'cy young'];
    if (multiOutcomeKeywords.some(keyword => question.includes(keyword))) {
      return true;
    }
    
    return false;
  };
  
  // Check if market has multiple outcomes
  const hasMultipleOutcomes = isMultiOutcomeMarket(chartMarket);
  
  // Check if this market is part of an event group (multimarket)
  // Use same detection method as MarketTradeCard: check for both eventId AND eventTitle
  const eventId = chartMarket?.eventId;
  const hasEventInfo = eventId && (chartMarket as any).eventTitle;
  const eventMarkets = useMemo(() => {
    if (!eventId || effectiveMarketIds.length > 1) return [];
    return allMarkets.filter(m => m.eventId === eventId && m.id !== chartMarketId);
  }, [eventId, allMarkets, effectiveMarketIds.length, chartMarketId]);
  
  // Show toggle if market has eventId AND eventTitle (same as MarketTradeCard)
  const isPartOfEventGroup = !!hasEventInfo && (eventMarkets.length > 0 || allMarkets.filter(m => m.eventId === eventId).length > 1);
  
  // Helper function to extract market title/name from question
  // When market is part of an event, removes event context to show just the distinguishing part
  const extractOptionName = useCallback((question: string | undefined, eventTitle?: string): string => {
    if (!question) return '';
    
    // If we have an event title, try to extract what's unique about this market
    if (eventTitle) {
      // Remove the event title from the question to get the distinguishing part
      // For example: "Will Bitcoin reach $250,000 by December 31, 2025?" with event "What price will Bitcoin hit in 2025?"
      // Should extract "$250,000" or "250,000"
      
      // Normalize both strings for comparison (lowercase, remove punctuation)
      const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const normalizedQuestion = normalize(question);
      const normalizedEventTitle = normalize(eventTitle);
      
      // Extract key words from event title (remove common words)
      const eventWords = normalizedEventTitle.split(' ').filter(w => 
        w.length > 2 && !['will', 'what', 'who', 'when', 'where', 'how', 'the', 'and', 'or', 'in', 'by', 'for', 'to'].includes(w)
      );
      
      // Remove event-related words from question
      let remaining = normalizedQuestion;
      eventWords.forEach(word => {
        remaining = remaining.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
      });
      remaining = remaining.replace(/\s+/g, ' ').trim();
      
      // If we successfully removed event context, extract the unique part
      if (remaining.length > 0 && remaining !== normalizedQuestion) {
        // Try to extract the key distinguishing part (price, name, etc.)
        // Look for price patterns: $X, X, Xk, Xm, etc.
        const priceMatch = question.match(/(\$?[\d,]+(?:\.\d+)?[kmb]?)/i);
        if (priceMatch) {
          return priceMatch[1].trim();
        }
        
        // Look for dates
        const dateMatch = question.match(/(\w+\s+\d{1,2},?\s+\d{4})/i);
        if (dateMatch) {
          return dateMatch[1].trim();
        }
        
        // Extract what's left after removing event words
        const uniquePart = question.split(/\s+/).filter(word => {
          const normalizedWord = normalize(word);
          return !eventWords.some(ew => normalizedWord.includes(ew) || ew.includes(normalizedWord));
        }).join(' ').replace(/\?/g, '').trim();
        
        if (uniquePart.length > 0 && uniquePart.length < question.length) {
          return uniquePart;
        }
      }
    }
    
    // Fallback: Extract key information from question patterns
    // Pattern: Extract price if present
    const pricePattern = /(\$?[\d,]+(?:\.\d+)?[kmb]?)/i;
    const priceMatch = question.match(pricePattern);
    if (priceMatch) {
      return priceMatch[1].trim();
    }
    
    // No pattern matching - return everything before the question mark, cleaned up
    const beforeQuestionMark = question.split('?')[0]?.trim();
    if (beforeQuestionMark && beforeQuestionMark.length < question.length) {
      return beforeQuestionMark;
    }
    
    return question;
  }, []);
  
  // Set market question in context for navbar display
  // Always show the actual market question, not the event title
  React.useEffect(() => {
    if (!setMarketQuestion) return;
    
    // Defer state update to avoid render warnings
    requestAnimationFrame(() => {
      // Only set for single market (show in navbar)
      if (effectiveMarketIds.length === 1 && chartMarket) {
        // Always show the full question
        setMarketQuestion(chartMarket.question || null);
      } else if (effectiveMarketIds.length > 1) {
        // Multi-market - show first market's question
        const firstMarket = markets[0];
        if (firstMarket && firstMarket.question) {
          setMarketQuestion(firstMarket.question);
        } else {
          setMarketQuestion(`${effectiveMarketIds.length} markets`);
        }
      } else {
        setMarketQuestion(null);
      }
    });
  }, [chartMarket, effectiveMarketIds.length, markets, setMarketQuestion]);

  // Set default outcome to the winning one (probability > 50%) when price data is first available
  React.useEffect(() => {
    // Only set default once per market, and only if we haven't set it yet
    if (hasSetDefaultOutcome || !chartMarketId || effectiveMarketIds.length !== 1) return;
    
    // For YES/NO markets: check current price
    if (!hasMultipleOutcomes && currentPrice) {
      const yesProb = currentPrice.probability || 0;
      if (yesProb > 50) {
        setSelectedOutcome('Yes');
        setHasSetDefaultOutcome(true);
      } else if (yesProb < 50) {
        setSelectedOutcome('No');
        setHasSetDefaultOutcome(true);
      }
      // If exactly 50%, keep 'All'
    }
    
    // For multi-outcome markets: find outcome with highest probability
    if (hasMultipleOutcomes && chartMarket?.tokens && chartMarket.tokens.length > 0) {
      // Find the outcome with the highest probability
      const winningToken = chartMarket.tokens.reduce((prev, current) => {
        const prevPrice = prev.price || 0;
        const currentPrice = current.price || 0;
        return currentPrice > prevPrice ? current : prev;
      });
      
      if (winningToken && winningToken.price > 0.5) {
        setSelectedOutcome(winningToken.outcome);
        setHasSetDefaultOutcome(true);
      }
    }
  }, [chartMarketId, currentPrice, hasMultipleOutcomes, chartMarket, effectiveMarketIds.length, hasSetDefaultOutcome]);

  // Reset hasSetDefaultOutcome when market changes
  React.useEffect(() => {
    setHasSetDefaultOutcome(false);
    // Reset to 'All' when market changes so we can set the new default
    setSelectedOutcome('All');
  }, [chartMarketId]);
  
  // Fetch historical prices for all outcomes if this is a multi-outcome market
  // Use dataFetchHours (1 month) instead of hours (selected time range) to enable scrolling
  const interval = useMemo(() => {
    if (dataFetchHours === null) return 'max';
    if (dataFetchHours <= 1) return '1h';
    if (dataFetchHours <= 6) return '6h';
    if (dataFetchHours <= 24) return '1d';
    if (dataFetchHours <= 168) return '1w';
    if (dataFetchHours <= 720) return '1m';
    return 'max';
  }, [dataFetchHours]);
  
  const fidelity = useMemo(() => {
    if (dataFetchHours === null) return undefined;
    if (dataFetchHours <= 1) return 1;
    if (dataFetchHours <= 6) return 5;
    if (dataFetchHours <= 24) return 15;
    if (dataFetchHours <= 168) return 60;
    if (dataFetchHours <= 720) return 240;
    return 1440;
  }, [dataFetchHours]);
  
  // Fetch historical prices for each outcome token
  const { data: allOutcomeData = [], isLoading: isLoadingMultiOutcomes } = useQuery({
    queryKey: ['multi-outcome-historical', chartMarketId, interval, fidelity, chartMarket?.tokens?.length],
    queryFn: async () => {
      if (!hasMultipleOutcomes) return [];
      
      // If market is detected as multi-outcome but tokens aren't populated yet, try to fetch market again
      let marketWithTokens = chartMarket;
      if (hasMultipleOutcomes && (!chartMarket?.tokens || chartMarket.tokens.length <= 2)) {
        console.log('[ChartCard] Multi-outcome market detected but tokens not populated, fetching full market data...');
        try {
          const enrichedMarket = await polymarketClient.getMarket(chartMarketId || '');
          if (enrichedMarket && enrichedMarket.tokens && enrichedMarket.tokens.length > 2) {
            marketWithTokens = enrichedMarket;
          }
        } catch (error) {
          console.error('[ChartCard] Error fetching enriched market data:', error);
        }
      }
      
      if (!marketWithTokens?.tokens || marketWithTokens.tokens.length <= 2) {
        console.warn('[ChartCard] Multi-outcome market detected but tokens not available');
        return [];
      }
      
      const colors = [
        '#10b981', // green
        '#ef4444', // red
        '#3b82f6', // blue
        '#f59e0b', // amber
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#06b6d4', // cyan
        '#84cc16', // lime
        '#f97316', // orange
        '#6366f1', // indigo
      ];
      
      const outcomeDataPromises = marketWithTokens.tokens.map(async (token, index) => {
        try {
          const historicalPrices = await polymarketClient.getHistoricalPrices(
            token.token_id,
            interval,
            fidelity,
            true // tokenIdOnly = true
          );
          
          return {
            tokenId: token.token_id,
            outcome: token.outcome,
            historicalPrices: historicalPrices || [],
            color: colors[index % colors.length],
          };
        } catch (error) {
          console.error(`[ChartCard] Error fetching historical prices for ${token.outcome}:`, error);
          return {
            tokenId: token.token_id,
            outcome: token.outcome,
            historicalPrices: [],
            color: colors[index % colors.length],
          };
        }
      });
      
      return await Promise.all(outcomeDataPromises);
    },
    enabled: !!hasMultipleOutcomes && !!chartMarketId,
    staleTime: 60000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
  
  // Handler to update the market for this specific chart
  // Always use marketIds array for chart cards (even for single market)
  const handleMarketSelect = useCallback((marketId: string | null) => {
    if (onMarketIdsChange) {
      // Always use marketIds array for chart cards
      if (marketId) {
        // When selecting a market, always set it as the only market (replace existing)
        // This ensures the chart loads immediately when a market is selected
        onMarketIdsChange([marketId]);
      } else {
        onMarketIdsChange([]);
      }
    } else if (onMarketChange) {
      // Fallback to legacy single market mode if onMarketIdsChange not available
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
    setShowAddMarketSelector(false);
  }, [onMarketChange, onMarketIdsChange]);

  // Handler to select all markets in a group
  const handleSelectAll = useCallback((marketIds: string[]) => {
    if (onMarketIdsChange && marketIds.length > 0) {
      onMarketIdsChange(marketIds);
      setShowMarketSelector(false);
      setShowAddMarketSelector(false);
    }
  }, [onMarketIdsChange]);
  
  // Handler to remove a market from multi-market chart
  const handleRemoveMarket = useCallback((marketIdToRemove: string) => {
    if (hasMultiMarketSupport && onMarketIdsChange) {
      const newMarketIds = effectiveMarketIds.filter(id => id !== marketIdToRemove);
      onMarketIdsChange(newMarketIds);
    }
  }, [onMarketIdsChange, hasMultiMarketSupport, effectiveMarketIds]);
  
  // Handler to toggle between showing all markets in event group or just single market
  const handleShowAllOutcomes = useCallback((showAll: boolean) => {
    if (isPartOfEventGroup && onMarketIdsChange && chartMarketId) {
      if (showAll) {
        // Add all markets from the event to the chart
        const allEventMarketIds = allMarkets.filter(m => m.eventId === eventId).map(m => m.id);
        onMarketIdsChange(allEventMarketIds);
        setShowAllOutcomes(true);
      } else {
        // Revert to just the original market
        onMarketIdsChange([chartMarketId]);
        setShowAllOutcomes(false);
      }
    }
  }, [isPartOfEventGroup, allMarkets, eventId, onMarketIdsChange, chartMarketId]);

  // Fetch historical prices for all markets (for multi-market support)
  // Use dataFetchHours (1 month) instead of hours (selected time range) to enable scrolling
  const multiMarketHistoricalPrices = useQuery({
    queryKey: ['multi-market-historical', effectiveMarketIds, dataFetchHours],
    queryFn: async () => {
      if (effectiveMarketIds.length <= 1) return [];
      
      const pricePromises = effectiveMarketIds.map(async (marketId) => {
        try {
          const prices = await polymarketClient.getHistoricalPrices(
            marketId,
            dataFetchHours === null ? 'max' : getIntervalForHours(dataFetchHours),
            dataFetchHours === null ? undefined : getFidelityForHours(dataFetchHours)
          );
          return { marketId, prices: prices || [] };
        } catch (error) {
          console.error(`[ChartCard] Error fetching historical prices for ${marketId}:`, error);
          return { marketId, prices: [] };
        }
      });
      
      return await Promise.all(pricePromises);
    },
    enabled: effectiveMarketIds.length > 1,
    staleTime: 10 * 60 * 1000,
  });


  // Toggle market visibility
  const handleToggleMarketVisibility = useCallback((marketId: string) => {
    setHiddenMarketIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(marketId)) {
        newSet.delete(marketId);
      } else {
        newSet.add(marketId);
      }
      return newSet;
    });
  }, []);

  // Helper function to extend series to the latest timestamp
  const extendSeriesToLatestTime = useCallback((seriesData: SeriesData[]): SeriesData[] => {
    if (seriesData.length === 0) return seriesData;
    
    // Find the latest timestamp across all series
    let latestTime = 0;
    seriesData.forEach((series) => {
      if (series.data.length > 0) {
        const lastTime = Number(series.data[series.data.length - 1].time);
        if (lastTime > latestTime) {
          latestTime = lastTime;
        }
      }
    });
    
    if (latestTime === 0) return seriesData;
    
    // Extend each series to the latest timestamp
    return seriesData.map((series) => {
      if (series.data.length === 0) return series;
      
      const lastPoint = series.data[series.data.length - 1];
      const lastTime = Number(lastPoint.time);
      
      // If this series doesn't end at the latest time, add a point at the latest time
      if (lastTime < latestTime) {
        return {
          ...series,
          data: [
            ...series.data,
            {
              time: latestTime as any,
              value: lastPoint.value, // Use the last value
            },
          ],
        };
      }
      
      return series;
    });
  }, []);

  // Create all markets data for legend (including hidden ones)
  const allMarketsSeriesData = useMemo<SeriesData[]>(() => {
    if (effectiveMarketIds.length > 1 && multiMarketHistoricalPrices.data) {
      const marketColors = [
        '#10b981', // green
        '#ef4444', // red
        '#3b82f6', // blue
        '#f59e0b', // amber
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#06b6d4', // cyan
        '#84cc16', // lime
        '#f97316', // orange
        '#6366f1', // indigo
        '#14b8a6', // teal
        '#a855f7', // violet
        '#f43f5e', // rose
        '#22c55e', // emerald
        '#3b82f6', // sky
      ];
      
      const series = multiMarketHistoricalPrices.data.map((marketData, index) => {
        const market = markets.find(m => m?.id === marketData.marketId);
        const marketName = (market as any)?.optionName || extractOptionName(market?.question, (market as any)?.eventTitle) || market?.question || marketData.marketId.slice(0, 8);
        
        const data = convertHistoricalPricesToLightweight(
          marketData.prices.map((price) => ({
            timestamp: price.timestamp,
            price: price.price,
            probability: price.price * 100,
          }))
        );
        
        return {
          data,
          color: marketColors[index % marketColors.length],
          label: marketName,
          marketId: marketData.marketId,
        };
      });
      
      // Extend all series to the latest timestamp so all lines end at the same point
      return extendSeriesToLatestTime(series);
    }
    return [];
  }, [effectiveMarketIds, multiMarketHistoricalPrices.data, markets, extractOptionName, extendSeriesToLatestTime]);

  // Transform data to Lightweight Charts format - enable progressive loading
  const chartSeries = useMemo<SeriesData[]>(() => {
    // Handle multiple markets (each market as a separate line)
    if (effectiveMarketIds.length > 1 && multiMarketHistoricalPrices.data) {
      // Filter out hidden markets from chart
      return allMarketsSeriesData.filter((series) => !hiddenMarketIds.has(series.marketId || ''));
    }
    
    // Handle multi-outcome markets (single market with multiple outcomes)
    if (hasMultipleOutcomes && allOutcomeData.length > 0) {
      const allSeries = allOutcomeData.map((outcome) => {
        // Convert historical prices to Lightweight Charts format
        const data = convertHistoricalPricesToLightweight(
          outcome.historicalPrices.map((price) => ({
            timestamp: price.timestamp,
            price: price.price,
            probability: price.price * 100, // Convert to percentage
          }))
        );
        
        return {
          data,
          color: outcome.color,
          label: outcome.outcome,
        };
      });
      
      // Filter by selected outcome
      if (selectedOutcome === 'All') {
        return allSeries;
      }
      return allSeries.filter(series => series.label === selectedOutcome);
    }
    
    // Handle YES/NO markets (single market)
    let yesData: Array<{ timestamp: number; price: number; probability: number }> = [];
    let noData: Array<{ timestamp: number; price: number; probability: number }> = [];
    
    if (historicalPrices && historicalPrices.length > 0) {
      // Sort by timestamp
      const sorted = [...historicalPrices].sort((a, b) => a.timestamp - b.timestamp);
      
      // CRITICAL FIX: Validate data consistency - ensure historical prices match current price
      // If the last historical price is very different from current price, it might be from a different market
      if (currentPrice && sorted.length > 0) {
        const lastPoint = sorted[sorted.length - 1];
        const lastPrice = lastPoint.probability != null ? lastPoint.probability : (lastPoint.price * 100);
        const currentProb = currentPrice.probability;
        const priceDifference = Math.abs(lastPrice - currentProb);
        
        // If prices differ by more than 50%, it's likely from a different market
        // This is a safety check to prevent showing incorrect data
        if (priceDifference > 50) {
          console.warn(`[ChartCard] Historical prices don't match current price (diff: ${priceDifference.toFixed(1)}%). Clearing historical data to prevent incorrect display.`);
          // Clear historical data if it doesn't match - this prevents showing wrong market's data
          // The chart will show only current price until correct historical data loads
          sorted.length = 0;
        }
      }
      
      // Add current price if recent
      const now = Date.now();
      if (currentPrice && sorted.length > 0) {
        const lastPoint = sorted[sorted.length - 1];
        const timeSinceLastPoint = now - lastPoint.timestamp;
        if (timeSinceLastPoint > 60 * 1000) {
          sorted.push({
            timestamp: now,
            price: currentPrice.probability / 100,
            probability: currentPrice.probability,
          } as any);
        }
      }
      
      yesData = sorted.map((p) => {
        // Ensure probability is always calculated correctly
        // Use probability if available and valid, otherwise calculate from price
        const probability = (p.probability != null && !isNaN(p.probability) && isFinite(p.probability))
          ? p.probability
          : (p.price != null && !isNaN(p.price) && isFinite(p.price) ? p.price * 100 : 0);
        
        return {
          timestamp: p.timestamp,
          price: p.price,
          probability: Math.max(0, Math.min(100, probability)), // Clamp to 0-100
        };
      });
      
      noData = sorted.map((p) => {
        // Calculate NO probability - ensure it's always valid
        const yesProb = (p.probability != null && !isNaN(p.probability) && isFinite(p.probability))
          ? p.probability
          : (p.price != null && !isNaN(p.price) && isFinite(p.price) ? p.price * 100 : 0);
        
        const noProb = (p as any).noProbability != null && !isNaN((p as any).noProbability) && isFinite((p as any).noProbability)
          ? (p as any).noProbability
          : (100 - yesProb);
        
        return {
          timestamp: p.timestamp,
          price: 1 - (p.price || 0),
          probability: Math.max(0, Math.min(100, noProb)), // Clamp to 0-100
        };
      });
    } else if (currentPrice) {
      // If no historical data, use current price
      const now = Date.now();
      yesData = [{
        timestamp: now,
        price: currentPrice.probability / 100,
        probability: currentPrice.probability,
      }];
      noData = [{
        timestamp: now,
        price: 1 - currentPrice.probability / 100,
        probability: 100 - currentPrice.probability,
      }];
    }
    
    // Filter by selected outcome for YES/NO markets
    if (selectedOutcome === 'All') {
      return [
        {
          data: convertHistoricalPricesToLightweight(yesData),
          color: chartColors.yes,
          label: 'Yes',
        },
        {
          data: convertHistoricalPricesToLightweight(noData),
          color: chartColors.no,
          label: 'No',
        },
      ];
    } else if (selectedOutcome === 'Yes') {
      return [
        {
          data: convertHistoricalPricesToLightweight(yesData),
          color: chartColors.yes,
          label: 'Yes',
        },
      ];
    } else if (selectedOutcome === 'No') {
      return [
        {
          data: convertHistoricalPricesToLightweight(noData),
          color: chartColors.no,
          label: 'No',
        },
      ];
    }
    
    return [];
  }, [historicalPrices, currentPrice, timeRange, hasMultipleOutcomes, allOutcomeData, effectiveMarketIds, multiMarketHistoricalPrices.data, markets, extractOptionName, hiddenMarketIds, allMarketsSeriesData, selectedOutcome]);
  
  // Get current probabilities for visible series
  // MUST be called before early return to maintain hook order
  const currentProbabilities = useMemo(() => {
    if (!chartMarketId) return null; // Early return if no market
    if (!currentPrice && effectiveMarketIds.length === 1) return null;
    
    // Get market for this useMemo (don't define outside to avoid dependency issues)
    const chartMarket = markets[0];
    
    // For single market
    if (effectiveMarketIds.length === 1) {
      if (hasMultipleOutcomes && allOutcomeData.length > 0) {
        // Multi-outcome: get current prices from market tokens
        if (chartMarket?.tokens) {
          return chartMarket.tokens
            .filter(token => {
              if (selectedOutcome === 'All') return true;
              return token.outcome === selectedOutcome;
            })
            .map(token => ({
              label: token.outcome,
              probability: token.price * 100,
              color: allOutcomeData.find(o => o.outcome === token.outcome)?.color || chartColors.yes,
            }));
        }
      } else {
        // YES/NO market
        const yesProb = currentPrice?.probability || 0;
        const noProb = 100 - yesProb;
        const probs: Array<{ label: string; probability: number; color: string }> = [];
        
        if (selectedOutcome === 'All' || selectedOutcome === 'Yes') {
          probs.push({ label: 'Yes', probability: yesProb, color: chartColors.yes });
        }
        if (selectedOutcome === 'All' || selectedOutcome === 'No') {
          probs.push({ label: 'No', probability: noProb, color: chartColors.no });
        }
        return probs;
      }
    }
    
    // For multi-market: get current prices for each visible market
    if (effectiveMarketIds.length > 1 && multiMarketHistoricalPrices.data) {
      return markets
        .filter(m => effectiveMarketIds.includes(m?.id || '') && !hiddenMarketIds.has(m?.id || ''))
        .map((m) => {
          const marketName = (m as any)?.optionName || extractOptionName(m?.question, (m as any)?.eventTitle) || m?.question || m?.id?.slice(0, 8);
          // Get price from multiMarketPrices by matching marketId
          const marketIndex = effectiveMarketIds.findIndex(id => id === m?.id);
          const marketPrice = multiMarketPrices.data?.[marketIndex];
          const prob = marketPrice?.probability || (m?.outcomePrices?.YES ? m.outcomePrices.YES * 100 : 0);
          const index = effectiveMarketIds.findIndex(id => id === m?.id);
          const colors = [
            '#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
            '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7',
            '#f43f5e', '#22c55e', '#3b82f6'
          ];
          return {
            label: marketName,
            probability: prob,
            color: colors[index % colors.length],
          };
        });
    }
    
    return null;
  }, [currentPrice, effectiveMarketIds, hasMultipleOutcomes, allOutcomeData, selectedOutcome, markets, multiMarketHistoricalPrices.data, multiMarketPrices.data, hiddenMarketIds, extractOptionName]);

  // Check if we have any data
  const hasData = chartSeries.some(s => s.data.length > 0);
  const timeRangeButtons: TimeRange[] = ['1H', '6H', '1D', '1W', '1M', 'ALL'];
  const isLoadingData = isLoading || isLoadingMarket || (hasMultipleOutcomes && isLoadingMultiOutcomes) || (effectiveMarketIds.length > 1 && multiMarketHistoricalPrices.isLoading);

  // Early return check - must be after all hooks are called
  // All hooks (including useMemo above) must be called before this return
  if (!chartMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view chart"
          description="Choose a market from the selector below to display its historical price data"
          action={{
            label: 'Select Market',
            onClick: handleMarketSelectorOpen,
            icon: Search,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleMarketSelectorClose}
          onSelect={handleMarketSelect}
          onSelectAll={hasMultiMarketSupport ? handleSelectAll : undefined}
        />
      </>
    );
  }

  const market = getMarket(chartMarketId);

  return (
    <div className="h-full flex flex-col">
      {/* Compact inline header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-accent/20 flex-shrink-0">
        {/* Left side: Controls and probabilities */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {/* Data Freshness Indicator */}
          {dataUpdatedAt && (
            <DataFreshnessIndicator 
              timestamp={dataUpdatedAt} 
              thresholdSeconds={30}
              showAge={true}
            />
          )}
          {/* Outcome Selector - only show for single market */}
          {effectiveMarketIds.length === 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-1.5 py-0.5 text-xs font-medium rounded transition-all duration-200 flex items-center gap-1 ${
                    selectedOutcome !== 'All'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                  title="Select outcome to display"
                >
                  <span>{selectedOutcome}</span>
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuItem
                  onClick={() => setSelectedOutcome('All')}
                  className={selectedOutcome === 'All' ? 'bg-accent' : ''}
                >
                  <span className="text-xs">All</span>
                </DropdownMenuItem>
                {hasMultipleOutcomes && allOutcomeData.length > 0 ? (
                  allOutcomeData.map((outcome) => (
                    <DropdownMenuItem
                      key={outcome.outcome}
                      onClick={() => setSelectedOutcome(outcome.outcome)}
                      className={selectedOutcome === outcome.outcome ? 'bg-accent' : ''}
                    >
                      <span className="text-xs">{outcome.outcome}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => setSelectedOutcome('Yes')}
                      className={selectedOutcome === 'Yes' ? 'bg-accent' : ''}
                    >
                      <span className="text-xs">Yes</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSelectedOutcome('No')}
                      className={selectedOutcome === 'No' ? 'bg-accent' : ''}
                    >
                      <span className="text-xs">No</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Current Probabilities - scrollable when many markets */}
          {currentProbabilities && currentProbabilities.length > 0 && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
              {currentProbabilities.map((prob, idx) => (
                <div key={idx} className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded bg-background/50 border border-border/30">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: prob.color }}
                  />
                  <span className="text-xs font-mono font-semibold whitespace-nowrap" style={{ color: prob.color }}>
                    {prob.label.length > 8 ? prob.label.slice(0, 8) + '...' : prob.label}: {prob.probability.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
          
          {/* Multi-market controls */}
          {effectiveMarketIds.length > 1 && hasMultiMarketSupport && (
            <button
              onClick={() => setShowAddMarketSelector(true)}
              className="p-1 hover:bg-accent/60 rounded transition-colors flex-shrink-0"
              title="Add market"
            >
              <Search className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {effectiveMarketIds.length === 1 && isPartOfEventGroup && onMarketIdsChange && eventId && (
            <button
              onClick={() => {
                const allEventMarketIds = allMarkets.filter(m => m.eventId === eventId).map(m => m.id);
                if (allEventMarketIds.length > 1 && onMarketIdsChange) {
                  onMarketIdsChange(allEventMarketIds);
                }
              }}
              className="text-xs text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 hover:bg-accent/50 rounded transition-colors duration-200"
              title="Show all markets"
            >
              All
            </button>
          )}
          {effectiveMarketIds.length > 1 && isPartOfEventGroup && onMarketIdsChange && (
            <button
              onClick={() => handleShowAllOutcomes(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 hover:bg-accent/50 rounded transition-colors duration-200"
            >
              Single
            </button>
          )}
          
          {/* Multi-market count badge */}
          {effectiveMarketIds.length > 1 && (
            <div className="text-xs text-muted-foreground px-1.5 py-0.5 bg-accent/30 rounded">
              {effectiveMarketIds.length} markets
            </div>
          )}
        </div>
        
        {/* Right side: Time Range Selector */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {timeRangeButtons.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-1.5 py-0.5 text-xs font-medium rounded transition-all duration-200 ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
              title={`${range} time range`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <MarketSelector
        open={showMarketSelector || showAddMarketSelector}
        onOpenChange={(open) => {
          handleMarketSelectorClose(open);
          setShowAddMarketSelector(open);
        }}
        onSelect={handleMarketSelect}
        onSelectAll={hasMultiMarketSupport ? handleSelectAll : undefined}
      />

      {/* Chart - takes most of the space */}
      <div className="flex-1 min-h-0 relative">
        {isLoadingData && !hasData ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="md" text="Loading market data..." />
          </div>
        ) : !hasData ? (
          <EmptyState
            title="No price data available"
            description="Historical price data could not be loaded for this market"
            className="p-4"
          />
        ) : (
          <LightweightChartCard
            series={chartSeries.filter((s) => {
              // Ensure series has valid color and data array (can be empty)
              return s && 
                     s.color && 
                     typeof s.color === 'string' && 
                     s.color.trim() !== '' &&
                     Array.isArray(s.data);
            })}
            showLabels={true}
            timeRange={timeRange}
            onToggleMarket={handleToggleMarketVisibility}
            hiddenMarketIds={hiddenMarketIds}
            allMarketsSeriesData={allMarketsSeriesData?.filter((s) => {
              // Ensure series has valid color and data array (can be empty)
              return s && 
                     s.color && 
                     typeof s.color === 'string' && 
                     s.color.trim() !== '' &&
                     Array.isArray(s.data);
            })}
          />
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ChartCard = React.memo(ChartCardComponent, (prevProps, nextProps) => {
  // Compare both marketId and marketIds for equality
  if (!prevProps || !nextProps) return false;
  
  // Compare marketId
  if (prevProps.marketId !== nextProps.marketId) return false;
  
  // Compare marketIds array - check length and each element
  const prevMarketIds = prevProps.marketIds || [];
  const nextMarketIds = nextProps.marketIds || [];
  if (prevMarketIds.length !== nextMarketIds.length) return false;
  
  // Deep compare marketIds array elements
  for (let i = 0; i < prevMarketIds.length; i++) {
    if (prevMarketIds[i] !== nextMarketIds[i]) return false;
  }
  
  return true;
});

