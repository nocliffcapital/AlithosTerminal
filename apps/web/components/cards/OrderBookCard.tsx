'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrderBook } from '@/lib/hooks/usePolymarketData';
import { useClobAuth } from '@/lib/hooks/useClobAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Shield, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Address } from 'viem';
import { MarketSelector } from '@/components/MarketSelector';
import { cn } from '@/lib/utils';

interface OrderBookRow {
  price: number;
  size: number;
  dollars: number;
}

interface OrderBookCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function OrderBookCardComponent({ marketId: propMarketId, onMarketChange }: OrderBookCardProps = {}) {
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const { user, authenticated } = usePrivy();
  const { getAuthParams, requestAuth, isSigning, hasAuth, error: authError, isReady } = useClobAuth();
  
  const [authParams, setAuthParams] = useState<{ walletClient: any; address: Address } | null>(null);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  
  // Memoize handlers to prevent unnecessary re-renders
  const handleShowMarketSelector = useCallback(() => {
    setShowMarketSelector(true);
  }, []);
  
  const handleCloseMarketSelector = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);
  
  // Auto-get auth params when wallet is authenticated and has approved CLOB auth
  useEffect(() => {
    if (authenticated && hasAuth && !authParams && !isSigning) {
      // Use setTimeout to defer state update to avoid render-phase updates
      const timeoutId = setTimeout(() => {
        getAuthParams().then(params => {
          if (params) {
            setAuthParams(params);
          }
        }).catch(err => {
          // Only log error once per session to avoid spam
          if (typeof window !== 'undefined' && !(window as any).__orderbook_auth_error_logged) {
            (window as any).__orderbook_auth_error_logged = true;
            console.error('[OrderBookCard] Failed to get auth params:', err);
          }
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [authenticated, hasAuth, authParams, isSigning, getAuthParams]);

  const { data: orderBook, isLoading, error, refetch } = useOrderBook(
    effectiveMarketId || null, 
    selectedOutcome,
    !!authParams, // useL1Auth
    authParams?.address,
    authParams?.walletClient
  );

  // Calculate spread and format data
  const { asks, bids, spread, spreadPercent } = useMemo(() => {
    if (!orderBook || !orderBook.asks || !orderBook.bids) {
      return { asks: [], bids: [], spread: 0, spreadPercent: 0 };
    }

    // Sort asks ascending (lowest price first) and bids descending (highest price first)
    const sortedAsks = [...orderBook.asks].sort((a, b) => a.price - b.price);
    const sortedBids = [...orderBook.bids].sort((a, b) => b.price - a.price);

    // Calculate dollars for each row - ensure size is a number
    const asksWithDollars: OrderBookRow[] = sortedAsks.map(ask => {
      const price = typeof ask.price === 'number' ? ask.price : parseFloat(String(ask.price)) || 0;
      const size = typeof ask.size === 'number' ? ask.size : parseFloat(String(ask.size)) || 0;
      return {
        price,
        size,
        dollars: price * size,
      };
    });

    const bidsWithDollars: OrderBookRow[] = sortedBids.map(bid => {
      const price = typeof bid.price === 'number' ? bid.price : parseFloat(String(bid.price)) || 0;
      const size = typeof bid.size === 'number' ? bid.size : parseFloat(String(bid.size)) || 0;
      return {
        price,
        size,
        dollars: price * size,
      };
    });

    // Calculate spread - ensure prices are numbers
    const bestAsk = typeof sortedAsks[0]?.price === 'number' 
      ? sortedAsks[0].price 
      : parseFloat(String(sortedAsks[0]?.price)) || 0;
    const bestBid = typeof sortedBids[0]?.price === 'number' 
      ? sortedBids[0].price 
      : parseFloat(String(sortedBids[0]?.price)) || 0;
    const spreadValue = bestAsk - bestBid;
    const spreadPercentValue = bestBid > 0 ? (spreadValue / bestBid) * 100 : 0;

    return {
      asks: asksWithDollars,
      bids: bidsWithDollars,
      spread: spreadValue,
      spreadPercent: spreadPercentValue,
    };
  }, [orderBook]);

  // Find max size for bar scaling (for both asks and bids)
  const maxSize = useMemo(() => {
    const allSizes = [...asks.map(a => a.size), ...bids.map(b => b.size)];
    if (allSizes.length === 0) return 1;
    return Math.max(...allSizes);
  }, [asks, bids]);

  // Format price as "X.0c"
  const formatPrice = useCallback((price: number): string => {
    // Convert to cents and format
    const cents = price * 100;
    return `${cents.toFixed(1)}c`;
  }, []);

  // Format shares
  const formatShares = useCallback((shares: number | string): string => {
    // Ensure shares is a number
    const numShares = typeof shares === 'number' ? shares : parseFloat(String(shares)) || 0;
    if (numShares >= 1000000) {
      return (numShares / 1000000).toFixed(2) + 'M';
    }
    if (numShares >= 1000) {
      return (numShares / 1000).toFixed(2) + 'K';
    }
    return numShares.toFixed(2);
  }, []);

  // Format dollars
  const formatDollars = useCallback((dollars: number): string => {
    return `$${dollars.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }, []);

  const handleMarketSelect = useCallback((marketId: string | null) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
  }, [onMarketChange]);

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view order book"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleCloseMarketSelector}
          onSelect={handleMarketSelect}
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

  // Show loading state - only show if query is actually loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading order book..." />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
        <div className="text-center">
          <div className="font-semibold mb-1">Failed to load order book</div>
          <div className="text-xs text-muted-foreground/70">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </div>
        </div>
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

  // Show empty state
  if (!orderBook || (asks.length === 0 && bids.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <EmptyState
          icon={AlertCircle}
          title="No order book data"
          description="Unable to load order book data for this market. Please try selecting a different market."
          className="p-4"
        />
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

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Outcome Selector */}
        <div className="flex-shrink-0 flex gap-2 px-3 py-2 border-b border-border bg-accent/20">
          <Button
            variant={selectedOutcome === 'YES' ? 'buy' : 'outline'}
            size="sm"
            onClick={() => setSelectedOutcome('YES')}
            className="flex-1 text-xs"
          >
            YES
          </Button>
          <Button
            variant={selectedOutcome === 'NO' ? 'sell' : 'outline'}
            size="sm"
            onClick={() => setSelectedOutcome('NO')}
            className="flex-1 text-xs"
          >
            NO
          </Button>
        </div>

        {/* Order Book Table - Vertical Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-background">
          <div className="w-full text-xs">
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border z-10">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground">Price</div>
                <div className="text-xs font-semibold text-muted-foreground text-right">Shares</div>
                <div className="text-xs font-semibold text-muted-foreground text-right">Dollars</div>
              </div>
            </div>

            {/* Asks (Sell Orders) - Top */}
            {asks.map((ask, index) => {
              const barWidth = (ask.size / maxSize) * 100;
              return (
                <div
                  key={`ask-${index}`}
                  className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-1.5 hover:bg-accent/30 transition-colors relative border-b border-border/30"
                >
                  {/* Orange/Red horizontal bar proportional to share quantity */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-orange-500/30 pointer-events-none"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="font-mono text-xs text-orange-500 relative z-10 font-semibold">{formatPrice(ask.price)}</div>
                  <div className="font-mono text-xs text-right text-foreground relative z-10 font-medium">{formatShares(ask.size)}</div>
                  <div className="font-mono text-xs text-right text-foreground relative z-10 font-medium">{formatDollars(ask.dollars)}</div>
                </div>
              );
            })}

            {/* Spread Row - Middle Separator */}
            <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 bg-transparent border-y-2 border-primary/20 sticky top-[36px] z-10">
              <div className="font-mono text-xs text-center font-semibold text-foreground">{formatPrice(spread)}</div>
              <div className="text-xs font-semibold text-center text-foreground">Spread</div>
              <div className="font-mono text-xs text-right font-semibold text-foreground">{spreadPercent.toFixed(1)}%</div>
            </div>

            {/* Bids (Buy Orders) - Bottom */}
            {bids.map((bid, index) => {
              const barWidth = (bid.size / maxSize) * 100;
              return (
                <div
                  key={`bid-${index}`}
                  className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-1.5 hover:bg-accent/30 transition-colors relative border-b border-border/30"
                >
                  {/* Blue horizontal bar proportional to share quantity */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-blue-500/30 pointer-events-none"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="font-mono text-xs text-blue-400 relative z-10 font-semibold">{formatPrice(bid.price)}</div>
                  <div className="font-mono text-xs text-right text-foreground relative z-10 font-medium">{formatShares(bid.size)}</div>
                  <div className="font-mono text-xs text-right text-foreground relative z-10 font-medium">{formatDollars(bid.dollars)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <MarketSelector
        open={showMarketSelector}
        onOpenChange={handleCloseMarketSelector}
        onSelect={handleMarketSelect}
      />
    </>
  );
}

export const OrderBookCard = React.memo(OrderBookCardComponent);

