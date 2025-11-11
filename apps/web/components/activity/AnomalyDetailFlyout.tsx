'use client';

import React, { useMemo } from 'react';
import { useAnomalyStore } from '@/stores/anomaly-store';
import { useMarketStore } from '@/stores/market-store';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getActivityIcon,
  getSeverityColor,
  formatRelativeTime,
} from '@/lib/anomaly-detection/ui-helpers';
import { type AnomalyEvent } from '@/lib/anomaly-detection';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
import { chartColors, convertHistoricalPricesToLightweight } from '@/lib/charts/utils';
import { Copy, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';

export function AnomalyDetailFlyout() {
  const { selectedAnomaly, setSelectedAnomaly } = useAnomalyStore();
  const { markets } = useMarketStore();
  const { success } = useToast();

  // Get market ID - must be called unconditionally
  const marketId = selectedAnomaly?.marketId || null;
  
  // All hooks must be called unconditionally (Rules of Hooks)
  const { data: trades = [] } = useTrades(marketId);

  const market = useMemo(() => {
    if (!selectedAnomaly) return null;
    return markets[selectedAnomaly.marketId] || null;
  }, [selectedAnomaly, markets]);

  // Filter trades around anomaly timestamp (30-60 min window)
  const chartData = useMemo(() => {
    if (!selectedAnomaly || trades.length === 0) return null;

    const windowMs = 60 * 60 * 1000; // 60 minutes before and after for better context
    const windowStart = selectedAnomaly.timestamp - windowMs;
    const windowEnd = selectedAnomaly.timestamp + windowMs;

    // Filter trades by time window
    const windowTrades = trades.filter((trade) => {
      const tradeTime = trade.timestamp * (trade.timestamp < 946684800000 ? 1000 : 1);
      return tradeTime >= windowStart && tradeTime <= windowEnd;
    });

    if (windowTrades.length === 0) return null;

    // CRITICAL: Filter by outcome - determine which outcome to track
    // Use YES as default, or the outcome with more trades in the window
    const yesTrades = windowTrades.filter((t) => t.outcome === 'YES');
    const noTrades = windowTrades.filter((t) => t.outcome === 'NO');
    const trackOutcome = yesTrades.length >= noTrades.length ? 'YES' : 'NO';
    const outcomeTrades = windowTrades.filter((t) => t.outcome === trackOutcome);

    if (outcomeTrades.length === 0) return null;

    // Sort by timestamp
    const sortedTrades = [...outcomeTrades].sort((a, b) => {
      const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
      const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
      return timeA - timeB;
    });

    // Convert to historical price format, then use the proper conversion function
    const historicalPrices = sortedTrades.map((trade) => {
      const tradeTime = trade.timestamp * (trade.timestamp < 946684800000 ? 1000 : 1);
      return {
        timestamp: tradeTime, // milliseconds
        price: trade.price, // 0-1 format
        probability: trade.price * 100, // 0-100 format
      };
    });

    // Use the proper conversion function that matches the main chart
    const chartDataPoints = convertHistoricalPricesToLightweight(historicalPrices);

    if (chartDataPoints.length === 0) return null;

    const series: SeriesData[] = [
      {
        data: chartDataPoints,
        color: trackOutcome === 'YES' ? chartColors.yes : chartColors.no,
        label: trackOutcome,
        marketId: selectedAnomaly.marketId,
      },
    ];

    return series;
  }, [selectedAnomaly, trades]);

  // Get other anomalies for the same market (last 1-2 hours)
  const relatedAnomalies = useMemo((): AnomalyEvent[] => {
    if (!selectedAnomaly) return [];
    // This would come from the anomaly store or be passed as a prop
    // For now, return empty array - in production you'd fetch this
    return [];
  }, [selectedAnomaly]);

  const handleCopyWallet = (wallet: string) => {
    navigator.clipboard.writeText(wallet);
    success('Wallet address copied to clipboard');
  };


  const now = Date.now();

  // Early return if no anomaly selected (after all hooks)
  if (!selectedAnomaly) {
    return null;
  }

  const context = selectedAnomaly.context;
  const hasPriceChange = context?.priceChange !== undefined;
  const priceChangePositive = hasPriceChange && context.priceChange > 0;

  return (
    <Dialog open={!!selectedAnomaly} onOpenChange={(open) => !open && setSelectedAnomaly(null)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header Section */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg border shrink-0",
                getSeverityColor(selectedAnomaly.severity)
              )}>
                {getActivityIcon(selectedAnomaly.type)}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight mb-1">
                  {selectedAnomaly.label || selectedAnomaly.type.replace(/-/g, ' ')}
                </DialogTitle>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {market?.question || selectedAnomaly.marketId}
                </p>
              </div>
            </div>
            <div className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border shrink-0",
              getSeverityColor(selectedAnomaly.severity)
            )}>
              {selectedAnomaly.severity}
            </div>
          </div>
        </DialogHeader>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Summary Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-1 h-3 bg-primary rounded-full" />
              Summary
            </h3>
            <div className="text-xs text-muted-foreground leading-relaxed rounded-lg p-3 border border-border/50">
              {selectedAnomaly.message}
            </div>
          </div>

          {/* Key Stats Section */}
          {context && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-3 bg-primary rounded-full" />
                Key Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {context.zScore !== undefined && (
                  <div className="border border-border/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <BarChart3 className="h-3 w-3" />
                      Z-Score
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {context.zScore.toFixed(2)}
                    </div>
                  </div>
                )}
                {context.priceChange !== undefined && (
                  <div className={cn(
                    "border rounded-lg p-2.5 space-y-1",
                    priceChangePositive 
                      ? "border-green-500/30 bg-green-500/5" 
                      : "border-red-500/30 bg-red-500/5"
                  )}>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      {priceChangePositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      Price Change
                    </div>
                    <div className={cn(
                      "text-base font-semibold",
                      priceChangePositive ? "text-green-400" : "text-red-400"
                    )}>
                      {priceChangePositive ? '+' : ''}{context.priceChange.toFixed(2)}%
                    </div>
                  </div>
                )}
                {context.volumeInWindow !== undefined && (
                  <div className="border border-border/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <DollarSign className="h-3 w-3" />
                      Volume
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {context.volumeInWindow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] text-muted-foreground ml-1 font-normal">USDC</span>
                    </div>
                  </div>
                )}
                {context.meanVolume !== undefined && (
                  <div className="border border-border/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <Activity className="h-3 w-3" />
                      Avg Volume
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {context.meanVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] text-muted-foreground ml-1 font-normal">USDC</span>
                    </div>
                  </div>
                )}
                {context.imbalancePercentage !== undefined && (
                  <div className="border border-border/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <AlertCircle className="h-3 w-3" />
                      Imbalance
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {(context.imbalancePercentage * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                {context.tradeSize !== undefined && (
                  <div className="border border-border/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <DollarSign className="h-3 w-3" />
                      Trade Size
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {context.tradeSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] text-muted-foreground ml-1 font-normal">USDC</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wallet Address Section */}
          {selectedAnomaly.meta?.wallet && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-3 bg-primary rounded-full" />
                Wallet Address
              </h3>
              <div className="flex items-center gap-2 rounded-lg p-2.5 border border-border/50">
                <code className="flex-1 text-xs font-mono text-foreground px-2.5 py-1.5 rounded border border-border/50">
                  {selectedAnomaly.meta.wallet.slice(0, 6)}...{selectedAnomaly.meta.wallet.slice(-4)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyWallet(selectedAnomaly.meta!.wallet!)}
                  className="h-8 w-8 shrink-0"
                  title="Copy wallet address"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Price Chart Section */}
          {chartData && chartData.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-3 bg-primary rounded-full" />
                Price Chart
              </h3>
              <div className="border border-border/50 rounded-lg overflow-visible">
                <div className="h-72 w-full" style={{ minHeight: '288px' }}>
                  <LightweightChartCard
                    series={chartData}
                    height={288}
                    showLegend={false}
                    timeRange="1H"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Anomaly Timeline Section */}
          {relatedAnomalies.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="w-1 h-3 bg-primary rounded-full" />
                Recent Anomalies
              </h3>
              <div className="space-y-2">
                {relatedAnomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={cn(
                      "p-2.5 border rounded-lg text-xs transition-colors",
                      anomaly.id === selectedAnomaly.id
                        ? "ring-2 ring-primary border-primary/50 bg-primary/5"
                        : "border-border/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex items-center justify-center w-7 h-7 rounded border",
                          getSeverityColor(anomaly.severity)
                        )}>
                          {getActivityIcon(anomaly.type)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{anomaly.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {formatRelativeTime(anomaly.timestamp, now)}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium capitalize border",
                        getSeverityColor(anomaly.severity)
                      )}>
                        {anomaly.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <DialogFooter className="px-6 py-3 border-t border-border/50 gap-2">
          <Button 
            variant="outline" 
            onClick={() => setSelectedAnomaly(null)}
            className="text-xs h-8"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

