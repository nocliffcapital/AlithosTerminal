'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { useRealtimeTrades } from '@/lib/hooks/useRealtimeTrades';
import { useMarketStore } from '@/stores/market-store';
import { AlertTriangle, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { onChainService } from '@/lib/api/onchain';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';

interface UnusualActivity {
  type: 'volume-spike' | 'flow-imbalance' | 'depth-withdrawal' | 'spread-widening';
  marketId: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
}

function ActivityScannerCardComponent() {
  const { markets, selectedMarketId } = useMarketStore();
  const { data: trades = [] } = useTrades(selectedMarketId);
  
  // Subscribe to real-time trade updates for instant activity detection
  useRealtimeTrades(selectedMarketId);
  
  const [activities, setActivities] = useState<UnusualActivity[]>([]);

  // Memoize trades key to prevent unnecessary recalculations
  const tradesKey = useMemo(() => {
    if (!trades || trades.length === 0) return '';
    return trades.map((t: any) => `${t.id}-${t.timestamp}`).join(',');
  }, [trades]);

  const detectedActivities = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    const detected: UnusualActivity[] = [];
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes

    // Group trades by market and time window
    const marketTrades: Record<string, any[]> = {};
    trades.forEach((trade: any) => {
      if (trade && trade.marketId) {
        if (!marketTrades[trade.marketId]) {
          marketTrades[trade.marketId] = [];
        }
        marketTrades[trade.marketId].push(trade);
      }
    });

    Object.entries(marketTrades).forEach(([marketId, marketTrades]) => {
      // Recent trades in last window
      const recentTrades = marketTrades.filter(
        (t) => t.timestamp * 1000 > now - windowMs
      );

      if (recentTrades.length === 0) return;

      // 1. Volume Spike Detection
      const volume5min = recentTrades.reduce(
        (sum, t) => sum + parseFloat(t.amount || '0'),
        0
      );
      const avgVolume5min = marketTrades.reduce(
        (sum, t) => sum + parseFloat(t.amount || '0'),
        0
      ) / (marketTrades.length || 1);
      
      if (volume5min > avgVolume5min * 3) {
        detected.push({
          type: 'volume-spike',
          marketId,
          severity: volume5min > avgVolume5min * 5 ? 'high' : 'medium',
          message: `Volume spike: ${volume5min.toLocaleString()} (${(volume5min / avgVolume5min).toFixed(1)}x avg)`,
          timestamp: now,
        });
      }

      // 2. Flow Imbalance Detection
      const buyVolume = recentTrades
        .filter((t) => t.outcome === 'YES')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
      const sellVolume = recentTrades
        .filter((t) => t.outcome === 'NO')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
      const totalVolume = buyVolume + sellVolume;

      if (totalVolume > 0) {
        const imbalance = Math.abs(buyVolume - sellVolume) / totalVolume;
        if (imbalance > 0.7) {
          detected.push({
            type: 'flow-imbalance',
            marketId,
            severity: imbalance > 0.9 ? 'high' : 'medium',
            message: `Flow imbalance: ${(imbalance * 100).toFixed(0)}% (${buyVolume > sellVolume ? 'Buy' : 'Sell'} heavy)`,
            timestamp: now,
          });
        }
      }
    });

    return detected.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }, [tradesKey]);

  // Only update activities if they actually changed
  useEffect(() => {
    setActivities((prev) => {
      const prevKey = prev.map((a) => `${a.marketId}-${a.timestamp}`).join(',');
      const newKey = detectedActivities.map((a) => `${a.marketId}-${a.timestamp}`).join(',');
      if (prevKey !== newKey) {
        return detectedActivities;
      }
      return prev;
    });
  }, [detectedActivities]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'volume-spike':
        return <TrendingUp className="h-3 w-3" />;
      case 'flow-imbalance':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="text-xs mb-3">
        <div className="font-medium">Unusual Activity Scanner</div>
        <div className="text-muted-foreground">
          Detects volume spikes, flow imbalances, and anomalies
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {activities.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No unusual activity detected
          </div>
        ) : (
          activities.map((activity) => {
            const market = Object.values(markets).find(
              (m) => m.id === activity.marketId
            );

            return (
              <div
                key={`${activity.marketId}-${activity.timestamp}`}
                className={`p-2 border rounded text-xs ${getSeverityColor(
                  activity.severity
                )}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium capitalize mb-1">
                      {activity.type.replace('-', ' ')}
                    </div>
                    <div className="text-xs truncate mb-1">
                      {market?.question || activity.marketId}
                    </div>
                    <div className="text-xs opacity-80">
                      {activity.message}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs font-medium capitalize">
                    {activity.severity}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activities.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {activities.length} alert{activities.length !== 1 ? 's' : ''} detected
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ActivityScannerCard = React.memo(ActivityScannerCardComponent);

