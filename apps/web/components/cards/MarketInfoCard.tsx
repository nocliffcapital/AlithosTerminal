'use client';

import React from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import { useState } from 'react';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';
import { MarketStatusBadge } from '@/components/ui/MarketStatusBadge';

interface MarketInfoCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function MarketInfoCardComponent({ marketId: propMarketId, onMarketChange }: MarketInfoCardProps = {}) {
  const { selectedMarketId, getMarket } = useMarketStore();
  // Use prop marketId if provided, otherwise fall back to selectedMarketId
  const effectiveMarketId = propMarketId || selectedMarketId;
  const { data: price, isLoading } = useMarketPrice(effectiveMarketId);
  const { data: fetchedMarket } = useMarket(effectiveMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);

  const market = fetchedMarket || (effectiveMarketId ? getMarket(effectiveMarketId) : null);

  const stats = useMemo(() => {
    if (!market || !price) return null;

    return {
      volume24h: price.volume24h || market.volume || 0,
      liquidity: price.liquidity || market.liquidity || 0,
      probability: price.probability || 0,
      price: price.price || 0,
    };
  }, [market, price]);

  // Get dataUpdatedAt from price data
  const dataUpdatedAt = price?.timestamp ? new Date(price.timestamp) : undefined;

  const formatCurrency = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const handleSelect = (marketId: string) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
  };

  if (!effectiveMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <div className="text-muted-foreground text-sm mb-2">
            Select a market to view info
          </div>
          <Button
            onClick={() => setShowMarketSelector(true)}
            variant="outline"
            size="sm"
          >
            <Search className="h-4 w-4 mr-2" />
            Select Market
          </Button>
        </div>
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={handleSelect}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading market data..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="No market data available"
        description="Unable to load market information. Please try selecting a different market."
        className="p-4"
      />
    );
  }

  return (
    <div className="h-full flex flex-col p-3 space-y-3">
      <div className="text-xs flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate mb-1">{market?.question || 'Market'}</div>
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {market?.slug || effectiveMarketId?.slice(0, 8) || ''}
          </div>
        </div>
        {dataUpdatedAt && (
          <DataFreshnessIndicator 
            timestamp={dataUpdatedAt} 
            thresholdSeconds={30}
            showAge={true}
            className="ml-2"
          />
        )}
      </div>

      {/* Market Status Badge */}
      <MarketStatusBadge
        endDate={market?.endDate}
        active={market?.active}
        archived={market?.archived}
        className="mb-2"
      />

      {/* Market Stats */}
      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="text-xs text-muted-foreground">24h Volume</span>
          <span className="text-xs font-mono font-semibold">
            {formatCurrency(stats.volume24h)}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="text-xs text-muted-foreground">Liquidity</span>
          <span className="text-xs font-mono font-semibold">
            {formatCurrency(stats.liquidity)}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="text-xs text-muted-foreground">Current Price</span>
          <span className="text-xs font-mono font-semibold">
            ${stats.price.toFixed(4)}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="text-xs text-muted-foreground">Probability</span>
          <span className="text-xs font-mono font-semibold">
            {stats.probability.toFixed(2)}%
          </span>
        </div>

        {market?.endDate && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-xs text-muted-foreground">End Date</span>
            <span className="text-xs font-mono">
              {new Date(market.endDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {market?.category && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-xs text-muted-foreground">Category</span>
            <span className="text-xs font-medium capitalize">
              {market.category}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const MarketInfoCard = React.memo(MarketInfoCardComponent, (prevProps, nextProps) => {
  // Compare marketId for equality
  if (!prevProps || !nextProps) return false;
  return prevProps.marketId === nextProps.marketId;
});

