'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { useLayoutStore } from '@/stores/layout-store';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore, isEventId } from '@/stores/watchlist-store';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { TradingChart } from '@/components/trading/TradingChart';
import { TradingOrderbookPanel } from '@/components/trading/TradingOrderbookPanel';
import { TradingOrderForms } from '@/components/trading/TradingOrderForms';
import { TradingBottomPanel } from '@/components/trading/TradingBottomPanel';
import { MarketInfoPanel } from '@/components/trading/MarketInfoPanel';
import { MarketSelector } from '@/components/MarketSelector';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { Loader2, Search, ChevronDown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TradingWorkspace() {
  const { data: workspaces = [] } = useWorkspaces();
  const currentWorkspaceId = useLayoutStore((state) => state.currentWorkspaceId);
  const { selectedMarketId, getMarket, selectMarket } = useMarketStore();
  const { 
    marketIds: watchlistIds, 
    addToWatchlist, 
    removeFromWatchlist, 
    isInWatchlist 
  } = useWatchlistStore();
  const { data: allMarkets = [] } = useMarkets({ active: true });
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Handle market selection directly without card selector
  const handleMarketSelect = (marketId: string) => {
    selectMarket(marketId);
    setShowMarketSelector(false);
  };

  const currentWorkspace = useMemo(
    () => workspaces.find((w: any) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  const market = useMemo(() => {
    if (!selectedMarketId) return null;
    return getMarket(selectedMarketId);
  }, [selectedMarketId, getMarket]);

  // Get watchlist markets (only individual markets, not event groups)
  const watchlistMarkets = useMemo(() => {
    const individualMarketIds = watchlistIds.filter((id) => !isEventId(id));
    return allMarkets.filter((m) => individualMarketIds.includes(m.id)).slice(0, 10); // Limit to 10 for display
  }, [allMarkets, watchlistIds]);

  // Calculate key metrics - use market outcomePrices to match chart display
  // Show price for the "winning" outcome (higher price) to match chart auto-selection
  const markPrice = useMemo(() => {
    if (!market || !market.outcomePrices) return null;
    
    const yesPrice = market.outcomePrices.YES || 0;
    const noPrice = market.outcomePrices.NO || 0;
    
    // Show the price for the outcome with higher price (matching chart auto-selection)
    return yesPrice > noPrice ? yesPrice : noPrice;
  }, [market]);

  const priceChange24h = useMemo<number | null>(() => {
    // TODO: Calculate 24h change from historical data
    return null;
  }, []);

  const volume24h = useMemo<number | null>(() => {
    // TODO: Get 24h volume from market data
    return null;
  }, [market]);

  // Check if current market is in watchlist
  const isMarketInWatchlist = useMemo(() => {
    if (!selectedMarketId) return false;
    return isInWatchlist(selectedMarketId);
  }, [selectedMarketId, isInWatchlist]);

  // Handle watchlist toggle
  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedMarketId) return;
    
    if (isMarketInWatchlist) {
      removeFromWatchlist(selectedMarketId);
    } else {
      addToWatchlist(selectedMarketId);
    }
  };

  // Find related markets in the same event or series
  const relatedMarkets = useMemo(() => {
    if (!market || !allMarkets.length) return [];
    
    const eventId = market.eventId;
    const seriesId = (market as any).seriesId;
    
    // First, try to find markets by seriesId (highest level grouping)
    if (seriesId) {
      const seriesMarkets = allMarkets.filter(m => {
        const mSeriesId = (m as any).seriesId;
        return mSeriesId === seriesId && m.id !== market.id;
      });
      if (seriesMarkets.length > 0) {
        // Sort by volume descending to show most active markets first
        return seriesMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      }
    }
    
    // Fallback to eventId grouping
    if (eventId) {
      const eventMarkets = allMarkets.filter(m => {
        return m.eventId === eventId && m.id !== market.id;
      });
      if (eventMarkets.length > 0) {
        // Sort by volume descending to show most active markets first
        return eventMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      }
    }
    
    return [];
  }, [market, allMarkets]);

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Section: Market Selector and Key Metrics */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Market Selector and Watchlist */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Watchlist Star */}
              {market && (
                <button
                  onClick={handleWatchlistToggle}
                  className="p-1.5 rounded hover:bg-accent transition-colors flex-shrink-0"
                  title={isMarketInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  <Star 
                    className={`h-4 w-4 ${
                      isMarketInWatchlist 
                        ? 'text-yellow-500 fill-yellow-500' 
                        : 'text-muted-foreground'
                    }`} 
                  />
                </button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMarketSelector(true)}
                className="gap-2"
              >
                {market?.imageUrl && !imageErrors.has(market.id) ? (
                  <div className="flex-shrink-0 w-4 h-4 overflow-hidden rounded">
                    <Image
                      src={market.imageUrl}
                      alt={market.question || ''}
                      width={16}
                      height={16}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set([...prev, market.id]));
                      }}
                    />
                  </div>
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {market ? (
                  <span className="max-w-[200px] truncate">{market.question}</span>
                ) : (
                  <span>Select Market</span>
                )}
              </Button>
            </div>
            <MarketSelector
              open={showMarketSelector}
              onOpenChange={setShowMarketSelector}
              onSelect={handleMarketSelect}
            />
            
            {/* Related Markets Switcher */}
            {relatedMarkets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-shrink-0"
                  >
                    <span className="text-xs">Related ({relatedMarkets.length})</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-[400px] overflow-y-auto">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Switch to related market
                  </div>
                  <DropdownMenuSeparator />
                  {relatedMarkets.map((relatedMarket) => (
                    <DropdownMenuItem
                      key={relatedMarket.id}
                      onClick={() => selectMarket(relatedMarket.id)}
                      className="flex items-start gap-2 py-2 cursor-pointer"
                    >
                      {relatedMarket.imageUrl && !imageErrors.has(relatedMarket.id) ? (
                        <div className="flex-shrink-0 w-8 h-8 overflow-hidden rounded border border-border">
                          <Image
                            src={relatedMarket.imageUrl}
                            alt={relatedMarket.question || ''}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setImageErrors(prev => new Set([...prev, relatedMarket.id]));
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-8 h-8 bg-background/50 rounded border border-border flex items-center justify-center">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {relatedMarket.question}
                        </div>
                        {(relatedMarket.volume || relatedMarket.liquidity) && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {relatedMarket.volume ? `Vol: $${(relatedMarket.volume / 1000).toFixed(1)}K` : ''}
                            {relatedMarket.volume && relatedMarket.liquidity ? ' • ' : ''}
                            {relatedMarket.liquidity ? `Liq: $${(relatedMarket.liquidity / 1000).toFixed(1)}K` : ''}
                          </div>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Watchlist */}
            {watchlistMarkets.length > 0 && (
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-hide">
                  {watchlistMarkets.map((watchlistMarket) => (
                    <Tooltip key={watchlistMarket.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => selectMarket(watchlistMarket.id)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 transition-colors ${
                            selectedMarketId === watchlistMarket.id
                              ? 'bg-primary/10 border border-primary'
                              : 'hover:bg-background/50 border border-transparent'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded overflow-hidden flex-shrink-0 ${
                            selectedMarketId === watchlistMarket.id
                              ? 'ring-1 ring-primary'
                              : ''
                          }`}>
                            {watchlistMarket.imageUrl && !imageErrors.has(watchlistMarket.id) ? (
                              <Image
                                src={watchlistMarket.imageUrl}
                                alt={watchlistMarket.question || ''}
                                width={16}
                                height={16}
                                className="w-full h-full object-cover"
                                onError={() => {
                                  setImageErrors(prev => new Set([...prev, watchlistMarket.id]));
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-background/50 flex items-center justify-center">
                                <Search className="h-2.5 w-2.5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] leading-tight max-w-[120px] truncate whitespace-nowrap ${
                            selectedMarketId === watchlistMarket.id
                              ? 'text-primary font-medium'
                              : 'text-muted-foreground'
                          }`}>
                            {watchlistMarket.question || 'Market'}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="rounded-none p-2 max-w-xs">
                        <div className="flex items-center gap-2">
                          {watchlistMarket.imageUrl && !imageErrors.has(watchlistMarket.id) ? (
                            <div className="flex-shrink-0 w-8 h-8 overflow-hidden rounded border border-border">
                              <Image
                                src={watchlistMarket.imageUrl}
                                alt={watchlistMarket.question || ''}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                                onError={() => {
                                  setImageErrors(prev => new Set([...prev, watchlistMarket.id]));
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 bg-background/50 rounded border border-border flex items-center justify-center">
                              <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {watchlistMarket.question || 'Market'}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            )}
          </div>

          {/* Key Metrics */}
          <div className="flex items-center gap-6 text-xs flex-shrink-0">
            {priceChange24h !== null && typeof priceChange24h === 'number' && (
              <div>
                <div className="text-muted-foreground">24h Change</div>
                <div className={`font-mono font-medium ${
                  priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                </div>
              </div>
            )}
            {volume24h !== null && typeof volume24h === 'number' && (
              <div>
                <div className="text-muted-foreground">24h Volume</div>
                <div className="font-mono font-medium">
                  ${volume24h.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Area: Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chart (60-70% width) */}
        <div className="flex-[2] border-r border-border overflow-hidden">
          <TradingChart marketId={selectedMarketId} />
        </div>

        {/* Middle Column: Orderbook and Trades (20-25% width) */}
        <div className="flex-[1] border-r border-border overflow-hidden">
          <TradingOrderbookPanel marketId={selectedMarketId} />
        </div>

        {/* Right Column: Order Forms (20-25% width) */}
        <div className="flex-[1] overflow-hidden">
          <TradingOrderForms marketId={selectedMarketId} />
        </div>
      </div>

      {/* Bottom Section: Positions Panel (Full Width) and Market Info Panel (Right Column Width) */}
      <div className="flex-shrink-0 border-t border-border flex" style={{ height: '300px' }}>
        {/* Positions/Orders Panel - Takes up left and middle columns */}
        <div className="flex-[3] overflow-hidden">
          <TradingBottomPanel />
        </div>
        
        {/* Market Info Panel - Takes up right column width */}
        <div className="flex-[1] border-l border-border overflow-hidden">
          <MarketInfoPanel marketId={selectedMarketId} />
        </div>
      </div>
    </div>
  );
}

