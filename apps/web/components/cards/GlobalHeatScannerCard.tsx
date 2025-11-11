'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { computeMarketAnomalies, getSeverityBand, type AnomalyEvent, type MarketHeatScore } from '@/lib/anomaly-detection';
import { DEFAULT_CONFIG } from '@/lib/anomaly-detection/config';
import {
  getHeatScoreColor,
  getAnomalyCategory,
  formatRelativeTime,
} from '@/lib/anomaly-detection/ui-helpers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Market } from '@/lib/api/polymarket';

interface GlobalHeatScannerCardProps {
  marketsToScan?: string[]; // Optional: limit to specific market IDs
  maxMarkets?: number; // Optional: limit number of markets to scan
}

function GlobalHeatScannerCardComponent({ 
  marketsToScan,
  maxMarkets = 50 
}: GlobalHeatScannerCardProps = {}) {
  const { markets: storeMarkets, selectMarket, selectedMarketId } = useMarketStore();
  const { data: allMarkets = [] } = useMarkets({ active: true });
  
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [heatScores, setHeatScores] = useState<MarketHeatScore[]>([]);
  const [sortBy, setSortBy] = useState<string>('heat');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minHeatBand, setMinHeatBand] = useState<string>('calm');

  // Determine which markets to scan
  const marketsToProcess = useMemo(() => {
    let markets: Market[] = [];
    
    if (marketsToScan) {
      // Use provided market IDs
      markets = allMarkets.filter((m) => marketsToScan.includes(m.id));
    } else {
      // Use all markets, but limit to top N by volume or a reasonable subset
      markets = [...allMarkets]
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, maxMarkets);
    }
    
    return markets;
  }, [allMarkets, marketsToScan, maxMarkets]);

  // Fetch trades for each market (limited to avoid performance issues)
  // For now, we'll use a simplified approach: fetch trades for a subset
  // In production, you might want to batch this or use a different strategy
  const marketIdsToFetch = useMemo(() => {
    return marketsToProcess.slice(0, 20).map((m) => m.id); // Limit to 20 for performance
  }, [marketsToProcess]);

  // Collect trades from multiple markets
  // Note: This is a simplified approach - in production you might want a hook that batches
  const allTradesByMarket = useMemo(() => {
    const result: Record<string, any[]> = {};
    // We'll populate this from individual useTrades calls or a batch approach
    // For now, this is a placeholder structure
    return result;
  }, []);

  // For now, we'll compute heat scores from the store's markets and any available trade data
  // In a full implementation, you'd fetch trades for all markets
  const detectionResult = useMemo(() => {
    const now = Date.now();
    const windowMs = DEFAULT_CONFIG.windows.short;

    // Build metadata map
    const metadataByMarket: Record<string, Market> = {};
    marketsToProcess.forEach((market) => {
      metadataByMarket[market.id] = market;
    });

    // For now, use empty trades - in production you'd fetch trades for each market
    // This is a limitation we accept for the initial implementation
    const tradesByMarket: Record<string, any[]> = {};

    const result = computeMarketAnomalies({
      now,
      windowMs,
      tradesByMarket,
      metadataByMarket,
    });

    return result;
  }, [marketsToProcess]);

  useEffect(() => {
    setAnomalies(detectionResult.anomalies);
    setHeatScores(detectionResult.heatScores);
  }, [detectionResult]);

  // Get unique categories from markets
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    marketsToProcess.forEach((market) => {
      if (market.category) {
        categories.add(market.category);
      }
    });
    return Array.from(categories).sort();
  }, [marketsToProcess]);

  // Filter and sort markets with heat scores
  const filteredAndSortedMarkets = useMemo(() => {
    // Create a map of heat scores by market ID
    const heatScoreMap = new Map<string, MarketHeatScore>();
    heatScores.forEach((hs) => {
      heatScoreMap.set(hs.marketId, hs);
    });

    // Get markets with heat scores
    let marketsWithHeat = marketsToProcess
      .map((market) => {
        const heatScore = heatScoreMap.get(market.id);
        return {
          market,
          heatScore: heatScore || {
            marketId: market.id,
            score: 0,
            components: {},
            lastUpdated: Date.now(),
          },
        };
      })
      .filter((item) => {
        // Category filter
        if (categoryFilter !== 'all' && item.market.category !== categoryFilter) {
          return false;
        }

        // Heat band filter
        const band = getSeverityBand(item.heatScore.score, DEFAULT_CONFIG);
        const bandOrder = { calm: 0, mild: 1, hot: 2, 'on-fire': 3 };
        const minBandOrder = bandOrder[minHeatBand as keyof typeof bandOrder] || 0;
        const currentBandOrder = bandOrder[band as keyof typeof bandOrder] || 0;
        if (currentBandOrder < minBandOrder) {
          return false;
        }

        return true;
      });

    // Sort
    switch (sortBy) {
      case 'heat':
        marketsWithHeat.sort((a, b) => b.heatScore.score - a.heatScore.score);
        break;
      case 'category':
        marketsWithHeat.sort((a, b) => {
          const catA = a.market.category || '';
          const catB = b.market.category || '';
          if (catA !== catB) return catA.localeCompare(catB);
          return b.heatScore.score - a.heatScore.score;
        });
        break;
      case 'alphabetical':
        marketsWithHeat.sort((a, b) => {
          const nameA = a.market.question || a.market.id;
          const nameB = b.market.question || b.market.id;
          return nameA.localeCompare(nameB);
        });
        break;
    }

    return marketsWithHeat;
  }, [marketsToProcess, heatScores, sortBy, categoryFilter, minHeatBand]);

  // Get top anomaly categories for a market
  const getTopAnomalyCategories = (marketId: string): string[] => {
    const marketAnomalies = anomalies.filter((a) => a.marketId === marketId);
    const categoryCounts: Record<string, number> = {};
    
    marketAnomalies.forEach((anomaly) => {
      const category = getAnomalyCategory(anomaly.type);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);
  };

  const handleMarketClick = (marketId: string) => {
    selectMarket(marketId);
  };

  const now = Date.now();

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="text-sm font-medium mb-3">Market Heat Scanner</div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="heat">Heat Score</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="alphabetical">Alphabetical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={minHeatBand} onValueChange={setMinHeatBand}>
          <SelectTrigger className="h-7 text-xs w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calm">Calm+</SelectItem>
            <SelectItem value="mild">Mild+</SelectItem>
            <SelectItem value="hot">Hot+</SelectItem>
            <SelectItem value="on-fire">On-fire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Markets list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredAndSortedMarkets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No markets match filters
          </div>
        ) : (
          filteredAndSortedMarkets.map(({ market, heatScore }) => {
            const band = getSeverityBand(heatScore.score, DEFAULT_CONFIG);
            const topCategories = getTopAnomalyCategories(market.id);
            const isSelected = selectedMarketId === market.id;

            return (
              <div
                key={market.id}
                onClick={() => handleMarketClick(market.id)}
                className={`p-2 border rounded text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate mb-1">
                      {market.question || market.id}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${getHeatScoreColor(heatScore.score, DEFAULT_CONFIG)}`}>
                        {heatScore.score.toFixed(0)}/100
                      </span>
                      <span className="text-muted-foreground text-xs capitalize">
                        {band}
                      </span>
                      {topCategories.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {topCategories.map((cat) => (
                            <span
                              key={cat}
                              className="px-1.5 py-0.5 bg-muted rounded text-xs"
                            >
                              {cat.replace('-', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {filteredAndSortedMarkets.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {filteredAndSortedMarkets.length} market{filteredAndSortedMarkets.length !== 1 ? 's' : ''} shown
          {heatScores.length > 0 && (
            <span className="ml-2">
              • {heatScores.filter((hs) => hs.score > 50).length} hot market{heatScores.filter((hs) => hs.score > 50).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const GlobalHeatScannerCard = React.memo(GlobalHeatScannerCardComponent);

