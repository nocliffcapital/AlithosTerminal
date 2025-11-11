'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useOrderBook } from '@/lib/hooks/usePolymarketData';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { useClobAuth } from '@/lib/hooks/useClobAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, BookOpen, Activity } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Address } from 'viem';
import { cn } from '@/lib/utils';
import { onChainService } from '@/lib/api/onchain';

interface OrderBookRow {
  price: number;
  size: number;
  dollars: number;
}

interface Trade {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  price: number;
  timestamp: number;
  user: string;
  transactionHash: string;
}

interface TradingOrderbookPanelProps {
  marketId?: string | null;
}

export function TradingOrderbookPanel({ marketId }: TradingOrderbookPanelProps) {
  const { user, authenticated } = usePrivy();
  const { getAuthParams, hasAuth, isSigning } = useClobAuth();
  const [activeTab, setActiveTab] = useState<'orderbook' | 'trades'>('orderbook');
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  const [authParams, setAuthParams] = useState<{ walletClient: any; address: Address } | null>(null);
  const [walletTags, setWalletTags] = useState<Map<string, string>>(new Map());
  const isFetchingAuthRef = useRef(false);
  const hasRequestedRef = useRef(false);
  const prevTradesRef = useRef<string>('');

  // Auto-get auth params when wallet is authenticated
  useEffect(() => {
    // Reset request flag if authParams is cleared
    if (!authParams) {
      hasRequestedRef.current = false;
    }
    
    if (authenticated && hasAuth && !authParams && !isSigning && !isFetchingAuthRef.current && !hasRequestedRef.current) {
      isFetchingAuthRef.current = true;
      hasRequestedRef.current = true;
      const timeoutId = setTimeout(() => {
        getAuthParams().then(params => {
          isFetchingAuthRef.current = false;
          if (params) {
            setAuthParams(params);
          }
        }).catch(() => {
          isFetchingAuthRef.current = false;
          hasRequestedRef.current = false;
          // Silently handle errors
        });
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        isFetchingAuthRef.current = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, hasAuth, authParams, isSigning]);

  // Orderbook data
  const { data: orderBook, isLoading: isLoadingOrderBook } = useOrderBook(
    marketId || null,
    selectedOutcome,
    !!authParams,
    authParams?.address,
    authParams?.walletClient
  );

  // Trades data (includes realtime updates via useTrades hook)
  const { data: trades = [], isLoading: isLoadingTrades } = useTrades(marketId || null);

  // Process wallet tags for trades
  const tradesKey = useMemo(() => {
    if (!trades || trades.length === 0) return '';
    return trades.map((t: Trade) => t.id).join(',');
  }, [trades]);

  useEffect(() => {
    // Only process if trades actually changed
    if (tradesKey === prevTradesRef.current) {
      return;
    }
    prevTradesRef.current = tradesKey;

    if (!trades || trades.length === 0) {
      setWalletTags(new Map());
      return;
    }

    const tags = new Map<string, string>();
    trades.forEach((trade: Trade) => {
      if (trade && trade.user) {
        try {
          const tag = onChainService.tagWallet(trade.user);
          tags.set(trade.user, tag.type);
        } catch {
          tags.set(trade.user, 'unknown');
        }
      }
    });
    setWalletTags(tags);
  }, [tradesKey, trades]);

  // Format orderbook data
  const { asks, bids, spread, spreadPercent, maxAskSize, maxBidSize } = useMemo(() => {
    if (!orderBook || !orderBook.asks || !orderBook.bids) {
      return { asks: [], bids: [], spread: 0, spreadPercent: 0, maxAskSize: 0, maxBidSize: 0 };
    }

    const sortedAsks = [...orderBook.asks].sort((a, b) => a.price - b.price);
    const sortedBids = [...orderBook.bids].sort((a, b) => b.price - a.price);

    const asksWithDollars: OrderBookRow[] = sortedAsks.map(ask => ({
      price: typeof ask.price === 'number' ? ask.price : parseFloat(String(ask.price)) || 0,
      size: typeof ask.size === 'number' ? ask.size : parseFloat(String(ask.size)) || 0,
      dollars: (typeof ask.price === 'number' ? ask.price : parseFloat(String(ask.price)) || 0) *
               (typeof ask.size === 'number' ? ask.size : parseFloat(String(ask.size)) || 0),
    }));

    const bidsWithDollars: OrderBookRow[] = sortedBids.map(bid => ({
      price: typeof bid.price === 'number' ? bid.price : parseFloat(String(bid.price)) || 0,
      size: typeof bid.size === 'number' ? bid.size : parseFloat(String(bid.size)) || 0,
      dollars: (typeof bid.price === 'number' ? bid.price : parseFloat(String(bid.price)) || 0) *
               (typeof bid.size === 'number' ? bid.size : parseFloat(String(bid.size)) || 0),
    }));

    // Calculate max sizes separately for each order type
    // Filter out invalid sizes (NaN, null, undefined, 0) before calculating max
    const validAskSizes = asksWithDollars
      .map(a => a.size)
      .filter(size => typeof size === 'number' && !isNaN(size) && size > 0);
    const validBidSizes = bidsWithDollars
      .map(b => b.size)
      .filter(size => typeof size === 'number' && !isNaN(size) && size > 0);
    
    const maxAskSize = validAskSizes.length > 0 
      ? Math.max(...validAskSizes)
      : 0;
    const maxBidSize = validBidSizes.length > 0
      ? Math.max(...validBidSizes)
      : 0;

    // Calculate combined max size to ensure bars always render for both sides
    // This ensures that even if one side has no data, bars can still render for the other side
    const maxSize = Math.max(maxAskSize, maxBidSize);

    const bestAsk = asksWithDollars[0];
    const bestBid = bidsWithDollars[0];
    const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : 0;
    const spreadPercent = bestAsk && bestBid ? (spread / bestAsk.price) * 100 : 0;

    return { asks: asksWithDollars, bids: bidsWithDollars, spread, spreadPercent, maxAskSize: maxSize, maxBidSize: maxSize };
  }, [orderBook]);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return [...trades]
      .filter((trade: Trade) => trade.outcome === selectedOutcome)
      .sort((a: Trade, b: Trade) => b.timestamp - a.timestamp)
      .slice(0, 50); // Limit to 50 most recent
  }, [trades, selectedOutcome]);

  const getWalletTagIcon = (tag: string) => {
    switch (tag) {
      case 'whale': return '🐋';
      case 'smart': return '🧠';
      case 'bot': return '🤖';
      default: return '👤';
    }
  };

  const getWalletTagColor = (tag: string) => {
    switch (tag) {
      case 'whale': return 'text-purple-400';
      case 'smart': return 'text-blue-400';
      case 'bot': return 'text-yellow-400';
      default: return 'text-muted-foreground';
    }
  };

  if (!marketId) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={BookOpen}
          title="No market selected"
          description="Select a market to view orderbook"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center border-b border-border">
        <button
          type="button"
          onClick={() => {
            setActiveTab('orderbook');
          }}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            activeTab === 'orderbook'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <BookOpen className="h-3 w-3 inline mr-1" />
          Order Book
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('trades');
          }}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            activeTab === 'trades'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Activity className="h-3 w-3 inline mr-1" />
          Trades
        </button>
      </div>

      {/* Outcome Selector */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b border-border">
        <button
          onClick={() => setSelectedOutcome('YES')}
          className={cn(
            'flex-1 px-2 py-1 text-xs rounded',
            selectedOutcome === 'YES'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          YES
        </button>
        <button
          onClick={() => setSelectedOutcome('NO')}
          className={cn(
            'flex-1 px-2 py-1 text-xs rounded',
            selectedOutcome === 'NO'
              ? 'bg-yellow-600/20 text-yellow-400'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          NO
        </button>
      </div>

      {/* Content */}
      <div key={activeTab} className="flex-1 overflow-auto">
        {activeTab === 'orderbook' ? (
          isLoadingOrderBook ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading orderbook..." />
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border sticky top-0 bg-background z-10">
                <div className="grid grid-cols-3 gap-2">
                  <div>Price</div>
                  <div>Size</div>
                  <div>Total</div>
                </div>
              </div>

              {/* Asks (Sells) - Top */}
              <div className="flex-1 overflow-auto min-h-0">
                {asks.length > 0 ? (
                  asks.slice(0, 20).map((ask, idx) => {
                    const barWidth = maxAskSize > 0 && ask.size > 0 ? Math.min((ask.size / maxAskSize) * 100, 100) : 0;
                    return (
                      <div
                        key={idx}
                        className="relative px-2 py-1 text-xs hover:bg-red-500/5 grid grid-cols-3 gap-2"
                      >
                        {/* Size bar - always render if there's a size and maxAskSize is valid */}
                        {ask.size > 0 && maxAskSize > 0 && barWidth > 0 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-red-500/20 pointer-events-none z-0"
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                        <div className="relative z-10 text-red-400 font-mono">{ask.price.toFixed(4)}</div>
                        <div className="relative z-10 font-mono">{ask.size.toFixed(2)}</div>
                        <div className="relative z-10 font-mono text-muted-foreground">${ask.dollars.toFixed(2)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                    No asks
                  </div>
                )}
              </div>

              {/* Spread */}
              {spread > 0 && (
                <div className="px-2 py-1 text-xs text-center border-y border-border bg-background/50 font-semibold">
                  Spread: ${spread.toFixed(4)} ({spreadPercent.toFixed(2)}%)
                </div>
              )}

              {/* Bids (Buys) - Bottom */}
              <div className="flex-1 overflow-auto min-h-0">
                {bids.length > 0 ? (
                  bids.slice(0, 20).map((bid, idx) => {
                    const barWidth = maxBidSize > 0 && bid.size > 0 ? Math.min((bid.size / maxBidSize) * 100, 100) : 0;
                    return (
                      <div
                        key={idx}
                        className="relative px-2 py-1 text-xs hover:bg-green-500/5 grid grid-cols-3 gap-2"
                      >
                        {/* Size bar - always render if there's a size and maxBidSize is valid */}
                        {bid.size > 0 && maxBidSize > 0 && barWidth > 0 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-green-500/20 pointer-events-none z-0"
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                        <div className="relative z-10 text-green-400 font-mono">{bid.price.toFixed(4)}</div>
                        <div className="relative z-10 font-mono">{bid.size.toFixed(2)}</div>
                        <div className="relative z-10 font-mono text-muted-foreground">${bid.dollars.toFixed(2)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                    No bids
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          isLoadingTrades ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading trades..." />
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border sticky top-0 bg-background">
                <div className="grid grid-cols-[auto_60px_1fr_80px] gap-2">
                  <div>Time</div>
                  <div>Side</div>
                  <div>Price</div>
                  <div>Size</div>
                </div>
              </div>
              {filteredTrades.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No trades found
                </div>
              ) : (
                filteredTrades.map((trade: Trade, idx: number) => {
                  const isBuy = trade.outcome === 'YES';
                  const walletTag = walletTags.get(trade.user) || 'unknown';
                  // Convert timestamp to local time and format in 24-hour format (HH:mm)
                  const timestamp = new Date(trade.timestamp * 1000);
                  const hours = timestamp.getHours().toString().padStart(2, '0');
                  const minutes = timestamp.getMinutes().toString().padStart(2, '0');
                  const timeStr = `${hours}:${minutes}`;

                  // Use a unique key combining trade.id, timestamp, and index to avoid duplicates
                  const uniqueKey = `${trade.id}-${trade.timestamp}-${idx}`;

                  return (
                    <div
                      key={uniqueKey}
                      className={cn(
                        'px-2 py-1 text-xs hover:bg-accent/30 grid grid-cols-[auto_60px_1fr_80px] gap-2 items-center',
                        isBuy ? 'bg-green-500/5' : 'bg-red-500/5'
                      )}
                    >
                      <div className="text-muted-foreground">{timeStr}</div>
                      <div className={cn(
                        'font-semibold text-xs px-1 py-0.5 rounded text-center',
                        isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {isBuy ? 'BUY' : 'SELL'}
                      </div>
                      <div className="font-mono">${trade.price.toFixed(4)}</div>
                      <div className="font-mono">{parseFloat(trade.amount).toFixed(2)}</div>
                    </div>
                  );
                })
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

