'use client';

import React from 'react';
import { useMarketPrice, useHistoricalPrices, useMarket, useMarkets } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { polymarketClient } from '@/lib/api/polymarket';
import { useQuery } from '@tanstack/react-query';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
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
  const { selectedMarketId, getMarket } = useMarketStore();
  
  // Support both single marketId (legacy) and marketIds array (new)
  // If marketIds prop is provided, use it; otherwise fall back to marketId or selectedMarketId
  const hasMultiMarketSupport = propMarketIds !== undefined;
  const effectiveMarketIds = hasMultiMarketSupport 
    ? (propMarketIds || [])
    : (propMarketId || selectedMarketId ? [propMarketId || selectedMarketId!] : []);
  
  // For backward compatibility, also support single marketId
  const chartMarketId = effectiveMarketIds[0];
  
  const { data: currentPrice } = useMarketPrice(chartMarketId);
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [showAddMarketSelector, setShowAddMarketSelector] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);
  const [isSelectedMarketsMinimized, setIsSelectedMarketsMinimized] = useState(true);
  const [hiddenMarketIds, setHiddenMarketIds] = useState<Set<string>>(new Set());
  
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
  
  // Always fetch more data to allow scrolling beyond the selected time range
  // The timeRange is only used for initial zoom/focus, not for limiting data
  // For "ALL" time range, fetch all data; otherwise fetch 1 month to enable scrolling
  const dataFetchHours = timeRange === 'ALL' ? null : (24 * 30); // Fetch 1 month of data (720 hours), or ALL if selected
  
  // Fetch historical prices for all markets in the chart
  // We fetch more data than the selected time range to enable scrolling
  const { data: historicalPrices = [], isLoading } = useHistoricalPrices(chartMarketId, dataFetchHours);
  
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
  
  const markets = marketsData.data || [];
  const isLoadingMarket = marketsData.isLoading;
  
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
  const eventId = chartMarket?.eventId;
  const eventMarkets = useMemo(() => {
    if (!eventId || effectiveMarketIds.length > 1) return [];
    return allMarkets.filter(m => m.eventId === eventId && m.id !== chartMarketId);
  }, [eventId, allMarkets, effectiveMarketIds.length, chartMarketId]);
  
  const isPartOfEventGroup = eventId && (eventMarkets.length > 0 || allMarkets.filter(m => m.eventId === eventId).length > 1);
  
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
  
  // Handler to update the market for this specific chart (legacy single market)
  const handleMarketSelect = useCallback((marketId: string | null) => {
    if (hasMultiMarketSupport && onMarketIdsChange) {
      // Multi-market mode: add market to list
      if (marketId && !effectiveMarketIds.includes(marketId)) {
        const newMarketIds = [...effectiveMarketIds, marketId].slice(0, 15); // Limit to 15 markets
        onMarketIdsChange(newMarketIds);
      }
    } else if (onMarketChange) {
      // Legacy single market mode
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
    setShowAddMarketSelector(false);
  }, [onMarketChange, onMarketIdsChange, hasMultiMarketSupport, effectiveMarketIds]);
  
  // Handler to remove a market from multi-market chart
  const handleRemoveMarket = useCallback((marketIdToRemove: string) => {
    if (hasMultiMarketSupport && onMarketIdsChange) {
      const newMarketIds = effectiveMarketIds.filter(id => id !== marketIdToRemove);
      onMarketIdsChange(newMarketIds);
    }
  }, [onMarketIdsChange, hasMultiMarketSupport, effectiveMarketIds]);
  
  // Handler to show all outcomes in event group
  const handleShowAllOutcomes = useCallback((checked: boolean) => {
    if (checked && isPartOfEventGroup && onMarketIdsChange && chartMarketId) {
      // Add all markets from the event to the chart
      const allEventMarketIds = allMarkets.filter(m => m.eventId === eventId).map(m => m.id);
      onMarketIdsChange(allEventMarketIds);
      setShowAllOutcomes(true);
    } else if (!checked && isPartOfEventGroup && onMarketIdsChange && chartMarketId) {
      // Revert to just the original market
      onMarketIdsChange([chartMarketId]);
      setShowAllOutcomes(false);
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

  // Helper function to extract option name from market question
  const extractOptionName = useCallback((question: string | undefined): string => {
    if (!question) return '';
    
    // Pattern: "Will [NAME] win [EVENT]?" or "Will [NAME] be [EVENT]?"
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    
    let match = question.match(winPattern);
    if (!match) {
      match = question.match(bePattern);
    }
    
    // Extract the option name (first capture group)
    if (match && match.length >= 2) {
      return match[1].trim();
    }
    
    // Fallback: if no pattern matches, return the question up to the first question mark
    return question.split('?')[0].trim() || question;
  }, []);

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
        const marketName = (market as any)?.optionName || extractOptionName(market?.question) || market?.question || marketData.marketId.slice(0, 8);
        
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
      return allOutcomeData.map((outcome) => {
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
    }
    
    // Handle YES/NO markets (single market)
    let yesData: Array<{ timestamp: number; price: number; probability: number }> = [];
    let noData: Array<{ timestamp: number; price: number; probability: number }> = [];
    
    if (historicalPrices && historicalPrices.length > 0) {
      // Sort by timestamp
      const sorted = [...historicalPrices].sort((a, b) => a.timestamp - b.timestamp);
      
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
      
      yesData = sorted.map((p) => ({
        timestamp: p.timestamp,
        price: p.price,
        probability: p.probability,
      }));
      
      noData = sorted.map((p) => ({
        timestamp: p.timestamp,
        price: 1 - p.price,
        probability: (p as any).noProbability ?? (100 - p.probability),
      }));
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
  }, [historicalPrices, currentPrice, timeRange, hasMultipleOutcomes, allOutcomeData, effectiveMarketIds, multiMarketHistoricalPrices.data, markets, extractOptionName, hiddenMarketIds, allMarketsSeriesData]);
  
  // Check if we have any data
  const hasData = chartSeries.some(s => s.data.length > 0);

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
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleMarketSelectorClose}
          onSelect={handleMarketSelect}
        />
      </>
    );
  }

  const market = getMarket(chartMarketId);
  const timeRangeButtons: TimeRange[] = ['1H', '6H', '1D', '1W', '1M', 'ALL'];
  const isLoadingData = isLoading || isLoadingMarket || (hasMultipleOutcomes && isLoadingMultiOutcomes) || (effectiveMarketIds.length > 1 && multiMarketHistoricalPrices.isLoading);

  return (
    <div className="h-full flex flex-col">
      {/* Minimal header with controls */}
      <div className="flex flex-col px-4 py-2 border-b border-border bg-accent/10 flex-shrink-0 gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => hasMultiMarketSupport ? setShowAddMarketSelector(true) : handleMarketSelectorOpen()}
              className="p-1.5 hover:bg-accent/60 rounded-md transition-colors flex-shrink-0"
              title={hasMultiMarketSupport ? "Add market" : "Select market"}
              aria-label={hasMultiMarketSupport ? "Add market" : "Select market"}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {effectiveMarketIds.length === 1 ? (
              <span className="text-xs font-medium truncate text-foreground" title={chartMarket?.question}>
                {chartMarket?.question || 'Select market'}
              </span>
            ) : (
              <span className="text-xs font-medium truncate text-foreground" title={chartMarket?.eventTitle || chartMarket?.question}>
                {chartMarket?.eventTitle || chartMarket?.question || `${effectiveMarketIds.length} markets`}
              </span>
            )}
            {/* See all checkbox for event groups */}
            {isPartOfEventGroup && onMarketIdsChange && (
              <label className="flex items-center gap-1.5 ml-2 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={effectiveMarketIds.length > 1 || showAllOutcomes}
                  onChange={(e) => handleShowAllOutcomes(e.target.checked)}
                  className="w-3 h-3 rounded border-border accent-primary cursor-pointer"
                />
                <span>See all</span>
              </label>
            )}
          </div>
          
          {/* Time Range Selector - compact */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {timeRangeButtons.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-all duration-150 ${
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
        
        {/* Multi-market list - show event title if all markets are from same event */}
        {effectiveMarketIds.length > 1 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSelectedMarketsMinimized(!isSelectedMarketsMinimized)}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                title={isSelectedMarketsMinimized ? 'Expand selected markets' : 'Collapse selected markets'}
              >
                {isSelectedMarketsMinimized ? '▼' : '▲'}
                <span>Selected Markets ({effectiveMarketIds.length})</span>
              </button>
            </div>
            {!isSelectedMarketsMinimized && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {(() => {
                  // Check if all markets are from the same event
                  const firstMarket = markets.find(m => m?.id === effectiveMarketIds[0]);
                  const allSameEvent = firstMarket?.eventId && 
                    effectiveMarketIds.every(id => {
                      const m = markets.find(m => m?.id === id);
                      return m?.eventId === firstMarket.eventId;
                    });
                  
                  if (allSameEvent && firstMarket?.eventTitle) {
                    // Show event title instead of individual markets
                    return (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-accent/40 rounded-md">
                        <span className="truncate max-w-[200px]" title={firstMarket.eventTitle}>
                          {firstMarket.eventTitle}
                        </span>
                      </div>
                    );
                  }
                  
                  // Fallback: show individual markets if not all from same event
                  return effectiveMarketIds.map((marketId) => {
                    const m = markets.find(m => m?.id === marketId);
                    const marketName = (m as any)?.optionName || extractOptionName(m?.question) || m?.question || marketId.slice(0, 8);
                    const isHidden = hiddenMarketIds.has(marketId);
                    return (
                      <div
                        key={marketId}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all ${
                          isHidden ? 'bg-accent/20 opacity-50' : 'bg-accent/40'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleMarketVisibility(marketId)}
                          className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer hover:opacity-80"
                          title={isHidden ? 'Click to show' : 'Click to hide'}
                        >
                          <span className="truncate max-w-[120px]" title={marketName}>
                            {marketName}
                          </span>
                        </button>
                        {hasMultiMarketSupport && onMarketIdsChange && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMarket(marketId);
                            }}
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                            title="Remove market"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      
      <MarketSelector
        open={showMarketSelector || showAddMarketSelector}
        onOpenChange={(open) => {
          handleMarketSelectorClose(open);
          setShowAddMarketSelector(open);
        }}
        onSelect={handleMarketSelect}
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
            series={chartSeries}
            showLabels={true}
            timeRange={timeRange}
            onToggleMarket={handleToggleMarketVisibility}
            hiddenMarketIds={hiddenMarketIds}
            allMarketsSeriesData={allMarketsSeriesData}
          />
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ChartCard = React.memo(ChartCardComponent, (prevProps, nextProps) => {
  // Compare marketId for equality
  if (!prevProps || !nextProps) return false;
  return prevProps.marketId === nextProps.marketId;
});

