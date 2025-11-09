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
import { Search, Check, ChevronDown, Calendar } from 'lucide-react';
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
  // We'll fetch them individually and combine the results
  const hoursForRange = getHoursForRange(timeRange);
  
  // Create a component to fetch historical data for a single market
  const HistoricalDataFetcher = ({ marketId, onData, onLoading }: { marketId: string; onData: (data: any[]) => void; onLoading: (loading: boolean) => void }) => {
    const { data, isLoading } = useHistoricalPrices(marketId, hoursForRange);
    useEffect(() => {
      onData(data || []);
    }, [data, onData]);
    useEffect(() => {
      onLoading(isLoading);
    }, [isLoading, onLoading]);
    return null;
  };

  // Store historical data in state
  const [historicalDataMap, setHistoricalDataMap] = useState<Map<string, any[]>>(new Map());
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());

  // Update historical data map when markets change
  useEffect(() => {
    const newMap = new Map<string, any[]>();
    const newLoadingMap = new Map<string, boolean>();
    selectedMarkets.forEach((marketId) => {
      newMap.set(marketId, []);
      newLoadingMap.set(marketId, true);
    });
    setHistoricalDataMap(newMap);
    setLoadingMap(newLoadingMap);
  }, [selectedMarkets, timeRange]);

  // Handler to update historical data map
  const handleHistoricalData = useCallback((marketId: string, data: any[]) => {
    setHistoricalDataMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(marketId, data);
      return newMap;
    });
  }, []);

  // Handler to update loading state
  const handleLoadingState = useCallback((marketId: string, loading: boolean) => {
    setLoadingMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(marketId, loading);
      return newMap;
    });
  }, []);

  // Check if any historical data is loading
  const isLoadingHistorical = Array.from(loadingMap.values()).some((loading) => loading);

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
    const allTimestamps = new Set<number>();
    historicalData.forEach((h) => {
      h.data.forEach((point: any) => {
        allTimestamps.add(point.timestamp);
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Create aligned price arrays for each market
    const alignedPrices = historicalData.map((h) => {
      const priceMap = new Map<number, number>();
      h.data.forEach((point: any) => {
        priceMap.set(point.timestamp, point.price || point.probability / 100);
      });

      // Interpolate missing values (use nearest neighbor)
      return sortedTimestamps.map((ts) => {
        if (priceMap.has(ts)) {
          return priceMap.get(ts)!;
        }
        // Find nearest timestamp
        const nearest = h.data.reduce((closest, point: any) => {
          const pointTs = point.timestamp;
          const closestTs = closest ? closest.timestamp : pointTs;
          return Math.abs(pointTs - ts) < Math.abs(closestTs - ts) ? point : closest;
        }, null as any);
        return nearest ? (nearest.price || nearest.probability / 100) : 0.5;
      });
    });

    // Calculate correlations for all pairs
    const pairs: CorrelationPair[] = [];
    for (let i = 0; i < selectedMarkets.length; i++) {
      for (let j = i + 1; j < selectedMarkets.length; j++) {
        const correlation = calculatePearsonCorrelation(
          alignedPrices[i],
          alignedPrices[j]
        );
        pairs.push({
          market1: selectedMarkets[i],
          market2: selectedMarkets[j],
          correlation,
        });
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
      {/* Render historical data fetchers */}
      {selectedMarkets.map((marketId) => (
        <HistoricalDataFetcher
          key={`${marketId}-${timeRange}`}
          marketId={marketId}
          onData={(data) => handleHistoricalData(marketId, data)}
          onLoading={(loading) => handleLoadingState(marketId, loading)}
        />
      ))}
      
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
        ) : isLoadingHistorical || isCalculating ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="sm" text="Loading historical data..." />
          </div>
        ) : correlations.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No correlation data"
            description="Unable to calculate correlations. Historical data may be insufficient."
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

