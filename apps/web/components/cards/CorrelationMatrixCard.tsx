'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarkets, useHistoricalPrices } from '@/lib/hooks/usePolymarketData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Check, ChevronDown, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface CorrelationPair {
  market1: string;
  market2: string;
  correlation: number;
}

type TimeRange = '1D' | '7D' | '30D' | 'ALL';

function CorrelationMatrixCardComponent() {
  const { markets, getPrice } = useMarketStore();
  const { data: allMarkets } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationPair[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [isCalculating, setIsCalculating] = useState(false);

  // Get hours for time range
  const getHoursForRange = (range: TimeRange): number | null => {
    switch (range) {
      case '1D': return 24;
      case '7D': return 24 * 7;
      case '30D': return 24 * 30;
      case 'ALL': return null;
      default: return 24 * 7;
    }
  };

  // Calculate Pearson correlation coefficient between two price series
  const calculatePearsonCorrelation = (prices1: number[], prices2: number[]): number => {
    if (prices1.length !== prices2.length || prices1.length < 2) return 0;

    const n = prices1.length;
    
    // Calculate means
    const mean1 = prices1.reduce((sum, p) => sum + p, 0) / n;
    const mean2 = prices2.reduce((sum, p) => sum + p, 0) / n;

    // Calculate numerator (covariance)
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (prices1[i] - mean1) * (prices2[i] - mean2);
    }

    // Calculate denominators (standard deviations)
    let sumSqDiff1 = 0;
    let sumSqDiff2 = 0;
    for (let i = 0; i < n; i++) {
      sumSqDiff1 += Math.pow(prices1[i] - mean1, 2);
      sumSqDiff2 += Math.pow(prices2[i] - mean2, 2);
    }

    const denominator = Math.sqrt(sumSqDiff1 * sumSqDiff2);
    
    if (denominator === 0) return 0;
    
    // Pearson correlation coefficient
    const correlation = numerator / denominator;
    
    // Clamp to [-1, 1] range
    return Math.max(-1, Math.min(1, correlation));
  };

  // Fetch historical prices for each selected market
  const hoursForRange = getHoursForRange(timeRange);
  
  // Store historical data in state (fetched via useEffect to avoid hooks in loops)
  const [historicalDataMap, setHistoricalDataMap] = useState<Map<string, any[]>>(new Map());
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, boolean>>(new Map());

  // Fetch historical data for each selected market
  // We'll use a custom hook pattern that works with dynamic lists
  useEffect(() => {
    if (selectedMarkets.length === 0) {
      setHistoricalDataMap(new Map());
      setLoadingMap(new Map());
      setErrorMap(new Map());
      return;
    }

    // Reset maps for new markets
    const newDataMap = new Map<string, any[]>();
    const newLoadingMap = new Map<string, boolean>();
    const newErrorMap = new Map<string, boolean>();
    
    selectedMarkets.forEach((marketId) => {
      newDataMap.set(marketId, []);
      newLoadingMap.set(marketId, true);
      newErrorMap.set(marketId, false);
    });
    
    setHistoricalDataMap(newDataMap);
    setLoadingMap(newLoadingMap);
    setErrorMap(newErrorMap);

    // Fetch data for each market
    selectedMarkets.forEach(async (marketId) => {
      try {
        setLoadingMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, true);
          return updated;
        });
        setErrorMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, false);
          return updated;
        });

        // Use the polymarket client directly to fetch historical prices
        const { polymarketClient } = await import('@/lib/api/polymarket');
        let interval: string;
        let fidelity: number | undefined;
        
        if (hoursForRange === null) {
          interval = 'max';
        } else {
          const getIntervalForHours = (hours: number): string => {
            if (hours <= 1) return '1h';
            if (hours <= 6) return '6h';
            if (hours <= 24) return '1d';
            if (hours <= 168) return '1w';
            if (hours <= 720) return '1m';
            return 'max';
          };
          const getFidelityForHours = (hours: number): number => {
            if (hours <= 1) return 1;
            if (hours <= 6) return 5;
            if (hours <= 24) return 15;
            if (hours <= 168) return 60;
            if (hours <= 720) return 240;
            return 1440;
          };
          interval = getIntervalForHours(hoursForRange);
          fidelity = getFidelityForHours(hoursForRange);
        }

        const historicalPrices = await polymarketClient.getHistoricalPrices(marketId, interval, fidelity);
        
        if (historicalPrices && historicalPrices.length > 0) {
          const formattedData = historicalPrices.map((item) => ({
            timestamp: item.timestamp,
            price: item.price,
            probability: item.price * 100,
            noProbability: (1 - item.price) * 100,
          }));

          setHistoricalDataMap((prev) => {
            const updated = new Map(prev);
            updated.set(marketId, formattedData);
            return updated;
          });
        } else {
          setHistoricalDataMap((prev) => {
            const updated = new Map(prev);
            updated.set(marketId, []);
            return updated;
          });
        }

        setLoadingMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, false);
          return updated;
        });
      } catch (error) {
        console.error(`[CorrelationMatrixCard] Error fetching historical data for ${marketId}:`, error);
        setErrorMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, true);
          return updated;
        });
        setLoadingMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, false);
          return updated;
        });
        setHistoricalDataMap((prev) => {
          const updated = new Map(prev);
          updated.set(marketId, []);
          return updated;
        });
      }
    });

    // Cleanup function to cancel any pending requests
    return () => {
      // Cancel any pending async operations if component unmounts
    };
  }, [selectedMarkets, hoursForRange, timeRange]);

  // Check if any historical data is loading or has errors
  const isLoadingHistorical = Array.from(loadingMap.values()).some((loading) => loading);
  const hasErrors = Array.from(errorMap.values()).some((hasError) => hasError);
  const errorMarkets = Array.from(errorMap.entries())
    .filter(([_, hasError]) => hasError)
    .map(([marketId]) => marketId);

  // Align price series by timestamp and calculate correlations
  const computeCorrelations = useMemo(() => {
    if (selectedMarkets.length < 2) {
      return [];
    }

    // Get historical data for all markets from the map
    const historicalData = selectedMarkets.map((marketId) => {
      return {
        marketId,
        data: historicalDataMap.get(marketId) || [],
      };
    });

    // Check if we have enough data
    const hasData = historicalData.every((h) => h.data.length > 0);
    if (!hasData) {
      return [];
    }

    // Align price series by timestamp (find common timestamps)
    // Use a time window approach: group timestamps within a small window (e.g., 1 minute)
    const TIME_WINDOW_MS = 60 * 1000; // 1 minute window
    
    // Collect all timestamps and create time buckets
    const allTimestamps = new Set<number>();
    historicalData.forEach((h) => {
      h.data.forEach((point: any) => {
        if (point && typeof point.timestamp === 'number' && !isNaN(point.timestamp)) {
          // Round to nearest time window for alignment
          const bucketTime = Math.floor(point.timestamp / TIME_WINDOW_MS) * TIME_WINDOW_MS;
          allTimestamps.add(bucketTime);
        }
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    if (sortedTimestamps.length < 2) {
      // Not enough data points for correlation
      return [];
    }

    // Create aligned price arrays for each market
    const alignedPrices = historicalData.map((h) => {
      // Create a map of timestamp -> price for quick lookup
      const priceMap = new Map<number, number>();
      h.data.forEach((point: any) => {
        if (point && typeof point.timestamp === 'number' && !isNaN(point.timestamp)) {
          const bucketTime = Math.floor(point.timestamp / TIME_WINDOW_MS) * TIME_WINDOW_MS;
          const price = point.price ?? (point.probability ? point.probability / 100 : null);
          if (price !== null && !isNaN(price) && price >= 0 && price <= 1) {
            // Use the latest price for each bucket if multiple exist
            if (!priceMap.has(bucketTime) || point.timestamp > (h.data.find((p: any) => {
              const pBucket = Math.floor(p.timestamp / TIME_WINDOW_MS) * TIME_WINDOW_MS;
              return pBucket === bucketTime;
            })?.timestamp || 0)) {
              priceMap.set(bucketTime, price);
            }
          }
        }
      });

      // Interpolate missing values (use forward fill - carry last known value forward)
      let lastPrice = 0.5; // Default fallback
      return sortedTimestamps.map((ts) => {
        if (priceMap.has(ts)) {
          lastPrice = priceMap.get(ts)!;
          return lastPrice;
        }
        // Forward fill: use last known price
        return lastPrice;
      });
    });

    // Filter out markets with insufficient data (all zeros or all same value)
    const validPrices = alignedPrices.filter((prices) => {
      if (prices.length < 2) return false;
      const uniqueValues = new Set(prices);
      return uniqueValues.size > 1; // Need at least 2 different values
    });

    if (validPrices.length < 2) {
      return [];
    }

    // Calculate correlations for all pairs using valid prices
    const pairs: CorrelationPair[] = [];
    for (let i = 0; i < validPrices.length; i++) {
      for (let j = i + 1; j < validPrices.length; j++) {
        // Ensure both price arrays have the same length
        const minLength = Math.min(validPrices[i].length, validPrices[j].length);
        const prices1 = validPrices[i].slice(0, minLength);
        const prices2 = validPrices[j].slice(0, minLength);
        
        const correlation = calculatePearsonCorrelation(prices1, prices2);
        
        // Only include if correlation is valid (not NaN)
        if (!isNaN(correlation) && isFinite(correlation)) {
          pairs.push({
            market1: selectedMarkets[i],
            market2: selectedMarkets[j],
            correlation,
          });
        }
      }
    }

    // Sort by absolute correlation descending (strongest first)
    pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    return pairs;
  }, [selectedMarkets, historicalDataMap, timeRange]);

  useEffect(() => {
    if (selectedMarkets.length >= 2) {
      setIsCalculating(isLoadingHistorical);
      if (!isLoadingHistorical) {
        setCorrelations(computeCorrelations);
      }
    } else {
      setCorrelations([]);
    }
  }, [selectedMarkets, computeCorrelations, isLoadingHistorical]);

  // Filter markets by search query
  const filteredMarkets = useMemo(() => {
    if (!allMarkets) return [];
    
    if (!searchQuery.trim()) return allMarkets;
    
    const query = searchQuery.toLowerCase();
    return allMarkets.filter((market) =>
      market.question?.toLowerCase().includes(query) ||
      market.slug?.toLowerCase().includes(query) ||
      market.category?.toLowerCase().includes(query)
    );
  }, [allMarkets, searchQuery]);

  const toggleMarket = (marketId: string) => {
    if (selectedMarkets.includes(marketId)) {
      setSelectedMarkets(selectedMarkets.filter((id) => id !== marketId));
    } else {
      setSelectedMarkets([...selectedMarkets, marketId]);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Time Range Selector */}
        {selectedMarkets.length >= 2 && (
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold">Time Range</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                  {timeRange}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-24">
                {(['1D', '7D', '30D', 'ALL'] as TimeRange[]).map((range) => (
                  <DropdownMenuItem
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={timeRange === range ? 'bg-accent' : ''}
                  >
                    <span className="text-xs">{range}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Market Selection Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-8 text-xs"
            >
              <span>
                {selectedMarkets.length === 0
                  ? 'Select Markets (min 2)'
                  : `${selectedMarkets.length} Market${selectedMarkets.length !== 1 ? 's' : ''} Selected`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[400px] p-0"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            {/* Search Input */}
            <div className="relative p-2 border-b border-border">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Market List */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredMarkets.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {searchQuery ? 'No markets found' : 'No markets available'}
                </div>
              ) : (
                filteredMarkets.map((market) => {
                  const isSelected = selectedMarkets.includes(market.id);
                  const probability = (market.outcomePrices?.YES || 0) * 100;
                  
                  return (
                    <div
                      key={market.id}
                      onClick={() => toggleMarket(market.id)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-150 border-b border-border hover:bg-accent/50 ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className={`flex-shrink-0 w-4 h-4 border flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate leading-tight">
                          {market.question}
                        </div>
                        {market.category && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {market.category}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-xs font-semibold ${
                          probability > 50 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {probability.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Correlation Pairs */}
        {selectedMarkets.length < 2 ? (
          <EmptyState
            icon={Search}
            title="Select at least 2 markets"
            description={selectedMarkets.length === 0 
              ? 'Choose markets to analyze correlations' 
              : 'Select one more market to see correlations'}
            className="p-4"
          />
        ) : hasErrors ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive/50" />
            <div className="text-sm font-medium">Error loading historical data</div>
            <div className="text-xs text-muted-foreground">
              {errorMarkets.length === 1 
                ? 'Failed to load data for one market'
                : `Failed to load data for ${errorMarkets.length} markets`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Trigger refetch by updating timeRange slightly
                setTimeRange((prev) => {
                  // Force re-fetch by toggling timeRange
                  return prev;
                });
                // Reset error state and reload
                errorMarkets.forEach((marketId) => {
                  setErrorMap((prev) => {
                    const updated = new Map(prev);
                    updated.set(marketId, false);
                    return updated;
                  });
                });
                // Force re-fetch by updating selectedMarkets (will trigger useEffect)
                setSelectedMarkets((prev) => [...prev]);
              }}
              className="mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Retry
            </Button>
          </div>
        ) : isLoadingHistorical || isCalculating ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
            <LoadingSpinner size="sm" text="Loading historical data..." />
            <div className="text-xs text-muted-foreground text-center">
              Fetching price history for {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''}...
            </div>
          </div>
        ) : correlations.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No correlation data"
            description={
              historicalDataMap.size === 0
                ? "No historical data available. Try selecting different markets or a different time range."
                : "Unable to calculate correlations. Historical data may be insufficient or markets may have no price variation."
            }
            className="p-4"
          />
        ) : (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">
              Correlations ({correlations.length})
            </div>
            {correlations.map((pair) => {
              const market1 = Object.values(markets).find((m) => m.id === pair.market1);
              const market2 = Object.values(markets).find((m) => m.id === pair.market2);
              const sortedIds = [pair.market1, pair.market2].sort();
              const stableKey = `${sortedIds[0]}-${sortedIds[1]}`;
              const correlationPercent = (pair.correlation * 100).toFixed(1);
              const isStrong = pair.correlation > 0.7;
              const isModerate = pair.correlation > 0.4 && pair.correlation <= 0.7;

              return (
                <div
                  key={stableKey}
                  className={`border border-border bg-card p-2 ${
                    isStrong ? 'border-green-400/30 bg-green-500/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${
                      isStrong ? 'text-green-400' : 
                      isModerate ? 'text-yellow-400' : 
                      'text-red-400'
                    }`}>
                      {pair.correlation >= 0 ? '+' : ''}{correlationPercent}%
                    </span>
                    <span className={`text-[10px] ${
                      isStrong ? 'text-green-400' : 
                      isModerate ? 'text-yellow-400' : 
                      'text-red-400'
                    }`}>
                      {isStrong ? 'Strong' : isModerate ? 'Moderate' : 'Weak'}
                    </span>
                  </div>
                  {/* Correlation strength indicator */}
                  <div className="w-full bg-background h-1.5 mb-2 rounded-full overflow-hidden">
                    <div
                      className={`h-1.5 ${
                        isStrong ? 'bg-green-400' : 
                        isModerate ? 'bg-yellow-400' : 
                        'bg-red-400'
                      }`}
                      style={{ width: `${Math.abs(pair.correlation) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1 mb-2">
                    <div className="text-[10px] leading-relaxed truncate">
                      {market1?.question || pair.market1}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">vs</div>
                    <div className="text-[10px] leading-relaxed truncate">
                      {market2?.question || pair.market2}
                    </div>
                  </div>
                  {isStrong && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[10px] h-6 bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400"
                      onClick={() => {
                        console.log('Create spread trade:', pair);
                      }}
                    >
                      Create Spread Trade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const CorrelationMatrixCard = React.memo(CorrelationMatrixCardComponent);


