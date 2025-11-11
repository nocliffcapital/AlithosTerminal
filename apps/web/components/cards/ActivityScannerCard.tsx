'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { useRealtimeTrades } from '@/lib/hooks/useRealtimeTrades';
import { useMarketStore } from '@/stores/market-store';
import { useAnomalyStore } from '@/stores/anomaly-store';
import { computeMarketAnomalies, getSeverityBand, type AnomalyEvent, type MarketHeatScore } from '@/lib/anomaly-detection';
import { DEFAULT_CONFIG } from '@/lib/anomaly-detection/config';
import {
  getActivityIcon,
  getSeverityColor,
  getAnomalyCategory,
  formatRelativeTime,
  getHeatScoreColor,
} from '@/lib/anomaly-detection/ui-helpers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Market } from '@/lib/api/polymarket';
import type { Severity } from '@/lib/anomaly-detection/types';

function ActivityScannerCardComponent() {
  const { markets, selectedMarketId, selectMarket } = useMarketStore();
  const { setSelectedAnomaly } = useAnomalyStore();
  const { data: trades = [] } = useTrades(selectedMarketId);
  
  // Subscribe to real-time trade updates for instant activity detection
  useRealtimeTrades(selectedMarketId);
  
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [heatScores, setHeatScores] = useState<MarketHeatScore[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Optimized tradesKey: use length and last trade info instead of joining all IDs
  const tradesKey = useMemo(() => {
    if (!trades || trades.length === 0) return '';
    const lastTrade = trades[0]; // Trades are sorted descending by timestamp
    return `${trades.length}-${lastTrade.id}-${lastTrade.timestamp}`;
  }, [trades]);

  // Optimized metadataByMarket: memoized map keyed by market.id
  const metadataByMarket = useMemo(() => {
    const result: Record<string, Market> = {};
    Object.values(markets).forEach((market) => {
      result[market.id] = market;
    });
    return result;
  }, [markets]);

  // Optimized marketById: direct lookup map
  const marketById = useMemo(() => {
    return metadataByMarket;
  }, [metadataByMarket]);

  // Detect anomalies using the new engine
  const detectionResult = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { anomalies: [], heatScores: [] };
    }

    const now = Date.now();
    const windowMs = DEFAULT_CONFIG.windows.short; // 5 minutes

    // Group trades by market
    const tradesByMarket: Record<string, typeof trades> = {};
    trades.forEach((trade: any) => {
      if (trade && trade.marketId) {
        if (!tradesByMarket[trade.marketId]) {
          tradesByMarket[trade.marketId] = [];
        }
        tradesByMarket[trade.marketId].push(trade);
      }
    });

    // Compute anomalies
    const result = computeMarketAnomalies({
      now,
      windowMs,
      tradesByMarket,
      metadataByMarket,
    });

    return result;
  }, [tradesKey, metadataByMarket]);

  // Update anomalies and heat scores when detection result changes
  useEffect(() => {
    setAnomalies((prev) => {
      const prevKey = prev.map((a) => `${a.id}`).join(',');
      const newKey = detectionResult.anomalies.map((a) => `${a.id}`).join(',');
      if (prevKey !== newKey) {
        return detectionResult.anomalies;
      }
      return prev;
    });
    setHeatScores(detectionResult.heatScores);
  }, [detectionResult]);

  // Sort anomalies by severity and timestamp
  const sortedAnomalies = useMemo(() => {
    const severityOrder: Record<Severity, number> = { extreme: 4, high: 3, medium: 2, low: 1 };
    return [...anomalies].sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    });
  }, [anomalies]);

  // Apply filters
  const filteredAnomalies = useMemo(() => {
    let filtered = sortedAnomalies;

    // Severity filter
    if (severityFilter !== 'all') {
      const severityMap: Record<string, Severity[]> = {
        'medium+': ['medium', 'high', 'extreme'],
        'high+': ['high', 'extreme'],
        'extreme': ['extreme'],
      };
      const allowedSeverities = severityMap[severityFilter] || [];
      filtered = filtered.filter((a) => allowedSeverities.includes(a.severity));
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((a) => {
        const category = getAnomalyCategory(a.type);
        return category === typeFilter;
      });
    }

    return filtered;
  }, [sortedAnomalies, severityFilter, typeFilter]);

  // Get heat score for selected market
  const selectedMarketHeatScore = useMemo(() => {
    if (!selectedMarketId) return null;
    return heatScores.find((hs) => hs.marketId === selectedMarketId);
  }, [heatScores, selectedMarketId]);

  // Handle anomaly click
  const handleAnomalyClick = (anomaly: AnomalyEvent) => {
    selectMarket(anomaly.marketId);
    setSelectedAnomaly(anomaly);
  };

  const now = Date.now();

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Filters header */}
      <div className="flex items-center gap-2 mb-3">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-7 text-xs w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="medium+">Medium+</SelectItem>
            <SelectItem value="high+">High+</SelectItem>
            <SelectItem value="extreme">Extreme</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-7 text-xs flex-1 min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="volume-flow">Volume/Flow</SelectItem>
            <SelectItem value="price-vol">Price/Vol</SelectItem>
            <SelectItem value="liquidity">Liquidity</SelectItem>
            <SelectItem value="participants">Participants</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Heat Score */}
      {selectedMarketHeatScore && (
        <div className="text-xs mb-3 flex items-center gap-2">
          <span className="text-muted-foreground">Heat Score:</span>
          <span className={`font-medium ${getHeatScoreColor(selectedMarketHeatScore.score, DEFAULT_CONFIG)}`}>
            {selectedMarketHeatScore.score.toFixed(0)}/100
          </span>
          <span className="text-muted-foreground text-xs">
            ({getSeverityBand(selectedMarketHeatScore.score, DEFAULT_CONFIG)})
          </span>
        </div>
      )}

      {/* Anomalies list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredAnomalies.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {sortedAnomalies.length === 0
              ? 'No unusual activity detected'
              : 'No anomalies match filters'}
          </div>
        ) : (
          filteredAnomalies.map((anomaly) => {
            const market = marketById[anomaly.marketId];

            return (
              <div
                key={anomaly.id}
                onClick={() => handleAnomalyClick(anomaly)}
                className={`p-2 border text-xs cursor-pointer hover:opacity-80 transition-opacity ${getSeverityColor(
                  anomaly.severity
                )}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getActivityIcon(anomaly.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium capitalize mb-1">
                      {anomaly.label || anomaly.type.replace(/-/g, ' ')}
                    </div>
                    <div className="text-xs truncate mb-1">
                      {market?.question || anomaly.marketId}
                    </div>
                    <div className="text-xs opacity-80">
                      {anomaly.message}
                    </div>
                    <div className="text-xs opacity-60 mt-1 flex items-center gap-2">
                      <span>{formatRelativeTime(anomaly.timestamp, now)}</span>
                      {anomaly.score > 0 && (
                        <span className="opacity-50">Score: {anomaly.score.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-medium capitalize">
                    {anomaly.severity}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {filteredAnomalies.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {filteredAnomalies.length} alert{filteredAnomalies.length !== 1 ? 's' : ''} shown
          {sortedAnomalies.length !== filteredAnomalies.length && (
            <span className="ml-1">({sortedAnomalies.length} total)</span>
          )}
          {heatScores.length > 0 && (
            <span className="ml-2">
              • {heatScores.filter((hs) => hs.score > 20).length} hot market{heatScores.filter((hs) => hs.score > 20).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ActivityScannerCard = React.memo(ActivityScannerCardComponent);
