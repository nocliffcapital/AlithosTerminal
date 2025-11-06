'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Check, ChevronDown } from 'lucide-react';

interface CorrelationPair {
  market1: string;
  market2: string;
  correlation: number;
}

function CorrelationMatrixCardComponent() {
  const { markets, getPrice } = useMarketStore();
  const { data: allMarkets } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationPair[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate correlation between two markets based on price movements
  const calculateCorrelation = (marketId1: string, marketId2: string): number => {
    // Simplified correlation calculation based on current probabilities
    // In production, would use historical price data
    const price1 = getPrice(marketId1);
    const price2 = getPrice(marketId2);

    if (!price1 || !price2) return 0;

    const prob1 = price1.probability;
    const prob2 = price2.probability;

    // Simple correlation: how close probabilities are
    // Higher correlation if probabilities are similar or move together
    const diff = Math.abs(prob1 - prob2);
    const correlation = 1 - diff / 100; // Normalize to 0-1, then scale

    return correlation;
  };

  const computeCorrelations = () => {
    if (selectedMarkets.length < 2) {
      setCorrelations([]);
      return;
    }

    const pairs: CorrelationPair[] = [];
    for (let i = 0; i < selectedMarkets.length; i++) {
      for (let j = i + 1; j < selectedMarkets.length; j++) {
        const correlation = calculateCorrelation(
          selectedMarkets[i],
          selectedMarkets[j]
        );
        pairs.push({
          market1: selectedMarkets[i],
          market2: selectedMarkets[j],
          correlation,
        });
      }
    }

    // Sort by correlation
    pairs.sort((a, b) => b.correlation - a.correlation);
    setCorrelations(pairs);
  };

  useEffect(() => {
    if (selectedMarkets.length >= 2) {
      computeCorrelations();
    }
  }, [selectedMarkets, markets]);

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
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-muted-foreground text-xs mb-1">
              Select at least 2 markets
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {selectedMarkets.length === 0 
                ? 'Choose markets to analyze correlations' 
                : 'Select one more market to see correlations'}
            </div>
          </div>
        ) : correlations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            Calculating correlations...
          </div>
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
                      {correlationPercent}%
                    </span>
                    <span className={`text-[10px] ${
                      isStrong ? 'text-green-400' : 
                      isModerate ? 'text-yellow-400' : 
                      'text-red-400'
                    }`}>
                      {isStrong ? 'Strong' : isModerate ? 'Moderate' : 'Weak'}
                    </span>
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

