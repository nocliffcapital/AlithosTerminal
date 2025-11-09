'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOrderBook } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useClobAuth } from '@/lib/hooks/useClobAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Shield, AlertCircle, Search, TrendingUp } from 'lucide-react';
import { LightweightDepthChart } from '@/components/charts/LightweightDepthChart';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Address } from 'viem';
import { MarketSelector } from '@/components/MarketSelector';
import { calculateLiquidityMetrics, calculateCommonImpactSizes, LiquidityMetrics } from '@/lib/utils/liquidity-metrics';
import { useMemo } from 'react';

function DepthCardComponent() {
  const { selectedMarketId } = useMarketStore();
  const { user, authenticated } = usePrivy();
  const { getAuthParams, requestAuth, isSigning, hasAuth, error, isReady } = useClobAuth();
  
  const [authParams, setAuthParams] = useState<{ walletClient: any; address: Address } | null>(null);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // Memoize handlers to prevent unnecessary re-renders
  const handleShowMarketSelector = useCallback(() => {
    setShowMarketSelector(true);
  }, []);
  
  const handleCloseMarketSelector = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);
  
  // Auto-get auth params when wallet is authenticated and has approved CLOB auth
  useEffect(() => {
    if (authenticated && hasAuth && !authParams) {
      getAuthParams().then(params => {
        if (params) {
          setAuthParams(params);
        }
      });
    }
  }, [authenticated, hasAuth, authParams, getAuthParams]);

  const { data: orderBook, isLoading, refetch } = useOrderBook(
    selectedMarketId, 
    'YES',
    !!authParams, // useL1Auth
    authParams?.address,
    authParams?.walletClient
  );

  // Calculate liquidity metrics (before early returns to avoid conditional hooks)
  const metrics = useMemo((): LiquidityMetrics => {
    if (!orderBook) {
      return {
        depth: 0,
        spread: 0,
        spreadAbs: 0,
        midPrice: 0,
        bestBid: null,
        bestAsk: null,
        bidDepth: 0,
        askDepth: 0,
      };
    }
    return calculateLiquidityMetrics(orderBook.bids, orderBook.asks);
  }, [orderBook?.bids, orderBook?.asks]);

  // Calculate price impact for common trade sizes
  const impactSizes = useMemo(() => {
    if (!orderBook || metrics.midPrice <= 0) return { buy: [], sell: [] };
    return calculateCommonImpactSizes(orderBook.bids, orderBook.asks, metrics.midPrice);
  }, [orderBook?.bids, orderBook?.asks, metrics.midPrice]);

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <div className="text-muted-foreground text-sm mb-2">
            Select a market to view depth
          </div>
          <Button
            onClick={handleShowMarketSelector}
            variant="outline"
            size="sm"
          >
            <Search className="h-4 w-4 mr-2" />
            Select Market
          </Button>
        </div>
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleCloseMarketSelector}
        />
      </>
    );
  }

  // Show auth prompt if wallet is connected but we need signature
  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-4">
        <Shield className="h-8 w-8 text-muted-foreground/50" />
        <div>Connect wallet to view order book</div>
      </div>
    );
  }

  // Show signing state if wallet is connecting and requesting signature
  if (authenticated && isReady && isSigning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <div className="font-semibold mb-2">Setting Up Order Book Access</div>
          <div className="text-sm text-muted-foreground">
            Please sign the message in your wallet to access the order book
          </div>
        </div>
      </div>
    );
  }

  // Show waiting state if wallet is connected but auth hasn't completed yet
  if (authenticated && isReady && !hasAuth && !isSigning && !authParams) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Loading order book...</div>
      </div>
    );
  }

  if (isSigning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">Signing message in wallet...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading order book..." />
      </div>
    );
  }

  if (!orderBook) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
        <div>No order book data</div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm"
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Transform order book data for visualization
  const depthData: Array<{ price: number; size: number; side: 'bid' | 'ask'; cumulative: number }> = [
    // Bids (buy side)
    ...orderBook.bids
      .slice()
      .reverse()
      .map((bid, i) => ({
        price: bid.price,
        size: bid.size,
        side: 'bid' as const,
        cumulative: orderBook.bids
          .slice(0, orderBook.bids.length - i)
          .reduce((sum, b) => sum + b.size, 0),
      })),
    // Asks (sell side)
    ...orderBook.asks.map((ask, i) => ({
      price: ask.price,
      size: ask.size,
      side: 'ask' as const,
      cumulative: orderBook.asks
        .slice(0, i + 1)
        .reduce((sum, a) => sum + a.size, 0),
    })),
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="h-full flex flex-col p-3">
      <div className="mb-2 text-xs">
        <div className="font-medium">Market Depth</div>
        <div className="text-muted-foreground">Mid: ${metrics.midPrice.toFixed(4)}</div>
      </div>
      
      <div className="flex-1 min-h-0">
        <LightweightDepthChart data={depthData} />
      </div>

      <div className="mt-2 space-y-2 text-xs">
        {/* Core Metrics */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-green-400">Best Bid</span>
            <span className="font-mono">
              {orderBook.bids[0]?.price?.toFixed(4) ?? 'N/A'} ({orderBook.bids[0]?.size?.toLocaleString() ?? 'N/A'})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-red-400">Best Ask</span>
            <span className="font-mono">
              {orderBook.asks[0]?.price?.toFixed(4) ?? 'N/A'} ({orderBook.asks[0]?.size?.toLocaleString() ?? 'N/A'})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spread</span>
            <span className="font-mono">
              {metrics.spread.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Depth</span>
            <span className="font-mono">
              {formatCurrency(metrics.depth)}
            </span>
          </div>
        </div>

        {/* Price Impact */}
        {impactSizes.buy.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Price Impact
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {impactSizes.buy.slice(0, 2).map((impact, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-muted-foreground">${impact.size}:</span>
                  <span className={`font-mono ${
                    impact.impact > 5 ? 'text-red-400' : 
                    impact.impact > 2 ? 'text-yellow-400' : 
                    'text-green-400'
                  }`}>
                    {impact.impact.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const DepthCard = React.memo(DepthCardComponent);

