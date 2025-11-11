'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMarketPrice, useHistoricalPrices, useMarket, useTrades } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useMarketStore } from '@/stores/market-store';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { polymarketClient } from '@/lib/api/polymarket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { convertHistoricalPricesToLightweight, chartColors } from '@/lib/charts/utils';
import { BarChart3 } from 'lucide-react';

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

interface TradingChartProps {
  marketId?: string | null;
}

export function TradingChart({ marketId }: TradingChartProps) {
  const { getMarket } = useMarketStore();
  const queryClient = useQueryClient();
  const { data: currentPrice } = useMarketPrice(marketId || null);
  
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO' | 'ALL'>('ALL');
  const previousMarketIdRef = React.useRef<string | null>(null);
  const autoSelectedForMarketRef = React.useRef<string | null>(null);
  
  // Subscribe to real-time price updates
  // When ALL is selected, subscribe to YES (NO is complementary)
  useRealtimePrice(marketId || null, selectedOutcome === 'ALL' ? 'YES' : selectedOutcome);

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

  const hours = getHoursForRange(timeRange);
  
  // Fetch historical prices (fetches both YES and NO, we'll filter by outcome)
  const { data: historicalPrices, isLoading: isLoadingHistory } = useHistoricalPrices(
    marketId || null,
    hours
  );

  // Get market data
  const { data: market } = useMarket(marketId || null);
  
  // Get trades for total trades count
  const { data: trades = [] } = useTrades(marketId || null);

  // Auto-select the winning outcome (higher price) when market changes
  useEffect(() => {
    // Check if market changed
    const marketChanged = marketId !== previousMarketIdRef.current;
    
    if (marketChanged) {
      previousMarketIdRef.current = marketId || null;
      autoSelectedForMarketRef.current = null; // Reset auto-select flag for new market
      // Reset to ALL when market changes (will be updated below if market data is available)
      setSelectedOutcome('ALL');
    }
    
    // Auto-select winning outcome when market data is available
    // Only do this once per market (to avoid overriding user selection)
    if (marketId && market && market.outcomePrices && autoSelectedForMarketRef.current !== marketId) {
      const yesPrice = market.outcomePrices.YES || 0;
      const noPrice = market.outcomePrices.NO || 0;
      
      if (yesPrice > noPrice) {
        setSelectedOutcome('YES');
        autoSelectedForMarketRef.current = marketId;
      } else if (noPrice > yesPrice) {
        setSelectedOutcome('NO');
        autoSelectedForMarketRef.current = marketId;
      } else {
        // If prices are equal, keep ALL
        setSelectedOutcome('ALL');
        autoSelectedForMarketRef.current = marketId;
      }
    }
  }, [marketId, market]);

  // Convert historical prices to chart format based on selected outcome
  const chartData = useMemo(() => {
    if (!historicalPrices || historicalPrices.length === 0) return [];
    
    if (selectedOutcome === 'ALL') {
      // Show both YES and NO series
      const yesData = historicalPrices.map((point: any) => ({
        timestamp: point.timestamp,
        price: point.price,
        probability: point.probability || (point.price * 100),
      }));
      
      const noData = historicalPrices.map((point: any) => {
        const noPrice = 1 - point.price;
        return {
          timestamp: point.timestamp,
          price: noPrice,
          probability: point.noProbability || (noPrice * 100),
        };
      });
      
      return [
        {
          data: convertHistoricalPricesToLightweight(yesData),
          color: chartColors.yes,
          label: 'YES',
          marketId: marketId || undefined,
        },
        {
          data: convertHistoricalPricesToLightweight(noData),
          color: chartColors.no,
          label: 'NO',
          marketId: marketId || undefined,
        },
      ];
    } else {
      // Transform data based on selected outcome
      const transformedData = historicalPrices.map((point: any) => {
        if (selectedOutcome === 'YES') {
          // For YES, use price as-is
          return {
            timestamp: point.timestamp,
            price: point.price,
            probability: point.probability || (point.price * 100),
          };
        } else {
          // For NO, use complementary price (1 - price)
          const noPrice = 1 - point.price;
          return {
            timestamp: point.timestamp,
            price: noPrice,
            probability: point.noProbability || (noPrice * 100),
          };
        }
      });
      
      const dataPoints = convertHistoricalPricesToLightweight(transformedData);
      
      // Wrap in SeriesData format
      return [{
        data: dataPoints,
        color: selectedOutcome === 'YES' ? chartColors.yes : chartColors.no,
        label: selectedOutcome,
        marketId: marketId || undefined,
      }];
    }
  }, [historicalPrices, marketId, selectedOutcome]);

  // Get current price for display based on selected outcome
  const currentPriceValue = useMemo(() => {
    if (!market || !market.outcomePrices) return null;
    
    if (selectedOutcome === 'ALL') {
      // Show both prices when ALL is selected (truncate to 4 decimals)
      const yesPrice = Math.floor(market.outcomePrices.YES * 10000) / 10000;
      const noPrice = Math.floor(market.outcomePrices.NO * 10000) / 10000;
      return `$${yesPrice.toFixed(4)} / $${noPrice.toFixed(4)}`;
    }
    
    // Get price for selected outcome
    const outcomePrice = selectedOutcome === 'YES' 
      ? market.outcomePrices.YES 
      : market.outcomePrices.NO;
    
    return outcomePrice || null;
  }, [market, selectedOutcome]);

  // Calculate 24h volume from trades
  const volume24h = useMemo(() => {
    if (!trades || trades.length === 0) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);
    
    return trades
      .filter((trade: any) => trade.timestamp >= oneDayAgo)
      .reduce((sum: number, trade: any) => {
        const amount = parseFloat(trade.amount || '0');
        const price = trade.price || 0;
        return sum + (amount * price);
      }, 0);
  }, [trades]);

  // Format volume helper
  const formatVolume = useCallback((volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    } else {
      return `$${volume.toFixed(0)}`;
    }
  }, []);

  if (!marketId) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={BarChart3}
          title="No market selected"
          description="Select a market to view the chart"
        />
      </div>
    );
  }

  if (isLoadingHistory) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="md" text="Loading chart data..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chart Controls */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Outcome Selection */}
          <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-2">
            <button
              onClick={() => setSelectedOutcome('ALL')}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                selectedOutcome === 'ALL'
                  ? 'bg-orange-500 text-white'
                  : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setSelectedOutcome('YES')}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                selectedOutcome === 'YES'
                  ? 'bg-blue-500 text-white'
                  : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setSelectedOutcome('NO')}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                selectedOutcome === 'NO'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              NO
            </button>
          </div>
          {/* Time Range Selection */}
          <div className="flex items-center gap-0.5">
            {['1H', '6H', '1D', '1W', '1M', 'ALL'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as TimeRange)}
                className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-orange-500 text-white'
                    : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground border border-border'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {market?.volume !== undefined && market.volume > 0 && (
            <div className="font-mono">
              <span className="text-muted-foreground mr-1">Total Volume:</span>
              <span className="font-semibold">
                {formatVolume(market.volume)}
              </span>
            </div>
          )}
          {volume24h > 0 && (
            <div className="font-mono">
              <span className="text-muted-foreground mr-1">24h Volume:</span>
              <span className="font-semibold">
                {formatVolume(volume24h)}
              </span>
            </div>
          )}
          {currentPriceValue !== null && (
            <div className="font-mono ml-auto">
              <span className="text-muted-foreground mr-1">Price:</span>
              <span className="font-semibold">
                {typeof currentPriceValue === 'string' 
                  ? currentPriceValue 
                  : `$${(Math.floor(currentPriceValue * 10000) / 10000).toFixed(4)}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden">
        {chartData && chartData.length > 0 ? (
          <LightweightChartCard
            series={chartData}
            height={undefined}
            timeRange={timeRange}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={BarChart3}
              title="No chart data"
              description="Historical data will appear here once available"
            />
          </div>
        )}
      </div>
    </div>
  );
}

