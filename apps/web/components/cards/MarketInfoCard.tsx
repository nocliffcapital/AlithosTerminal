'use client';

import React from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator';
import { MarketStatusBadge } from '@/components/ui/MarketStatusBadge';
import { Search } from 'lucide-react';
import { MarketSelector } from '@/components/MarketSelector';
import { CardMarketContext } from '@/components/layout/Card';

interface MarketInfoCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function MarketInfoCardComponent({ marketId: propMarketId, onMarketChange }: MarketInfoCardProps = {}) {
  const { getMarket } = useMarketStore();
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const { data: price, isLoading } = useMarketPrice(effectiveMarketId ?? null);
  const { data: fetchedMarket } = useMarket(effectiveMarketId ?? null);
  const { setMarketQuestion } = React.useContext(CardMarketContext);
  
  // Subscribe to real-time price updates for instant updates
  useRealtimePrice(effectiveMarketId || null, 'YES');

  const market = fetchedMarket || (effectiveMarketId ? getMarket(effectiveMarketId) : null);

  // Set market question in context for card header display
  // Always show the full question (like Market Search), not extracted option name
  React.useEffect(() => {
    if (!setMarketQuestion) return;
    
    // Defer state update to avoid render warnings
    requestAnimationFrame(() => {
      if (market) {
        // Always show the full question, matching Market Search behavior
        setMarketQuestion(market.question || null);
      } else {
        setMarketQuestion(null);
      }
    });
  }, [market, setMarketQuestion]);

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
        <EmptyState
          icon={Search}
          title="Select a market to view info"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
            icon: Search,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={(id) => {
            if (onMarketChange) onMarketChange(id);
            setShowMarketSelector(false);
          }}
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
      <div className="text-xs flex items-center justify-end">
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
      />

      {/* Market Stats */}
      <div className="space-y-0 flex-1">
        <div className="flex items-center justify-between py-2.5 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-medium">24h Volume</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {formatCurrency(stats.volume24h)}
          </span>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-medium">Liquidity</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {formatCurrency(stats.liquidity)}
          </span>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-medium">Current Price</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            ${stats.price.toFixed(4)}
          </span>
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-medium">Probability</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {stats.probability.toFixed(2)}%
          </span>
        </div>

        {market?.endDate && (
          <div className="flex items-center justify-between py-2.5 border-b border-border/50">
            <span className="text-xs text-muted-foreground font-medium">End Date</span>
            <span className="text-xs font-mono text-foreground">
              {new Date(market.endDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {market?.category && (
          <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-b-0">
            <span className="text-xs text-muted-foreground font-medium">Category</span>
            <span className="text-xs font-medium capitalize text-foreground">
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

