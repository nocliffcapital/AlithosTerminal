'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore, isEventId, getEventIdFromPrefixed } from '@/stores/watchlist-store';
import { Loader2, X, Calendar, DollarSign, BarChart3, Tag, TrendingUp, TrendingDown, ListPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface WatchlistCardProps {
  marketIds?: string[];
}

function WatchlistCardComponent({ marketIds: propMarketIds }: WatchlistCardProps) {
  const { marketIds: watchlistIds, removeFromWatchlist, getEventIds, removeEventFromWatchlist } = useWatchlistStore();
  const { data: allMarkets, isLoading } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const { selectMarket, getPrice, getMarket } = useMarketStore();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  // Use prop marketIds if provided, otherwise use watchlist store
  const displayMarketIds = propMarketIds || watchlistIds;

  // Separate event IDs from market IDs
  const eventIds = useMemo(() => {
    if (propMarketIds) {
      // If propMarketIds provided, check if any are event IDs
      return propMarketIds.filter(isEventId).map(getEventIdFromPrefixed);
    }
    return getEventIds();
  }, [propMarketIds, getEventIds]);

  const individualMarketIds = useMemo(() => {
    return displayMarketIds.filter((id) => !isEventId(id));
  }, [displayMarketIds]);

  // Filter markets to only show those in watchlist - memoize for performance
  const watchlistMarkets = useMemo(
    () => allMarkets?.filter((m) => individualMarketIds.includes(m.id)) || [],
    [allMarkets, individualMarketIds]
  );

  // Group markets by eventId for event groups
  const eventGroups = useMemo(() => {
    if (!allMarkets) return [];
    
    return eventIds.map((eventId) => {
      const markets = allMarkets.filter((m) => m.eventId === eventId);
      if (markets.length === 0) return null;
      
      const firstMarket = markets[0];
      const totalVolume = markets.reduce((sum, m) => sum + (m.volume || 0), 0);
      const totalLiquidity = markets.reduce((sum, m) => sum + (m.liquidity || 0), 0);
      
      return {
        eventId,
        title: (firstMarket as any).eventTitle || firstMarket.question || 'Event',
        imageUrl: (firstMarket as any).eventImageUrl || firstMarket.imageUrl,
        category: firstMarket.category,
        endDate: firstMarket.endDate,
        markets,
        totalVolume,
        totalLiquidity,
      };
    }).filter(Boolean) as Array<{
      eventId: string;
      title: string;
      imageUrl?: string;
      category?: string;
      endDate?: string;
      markets: typeof allMarkets;
      totalVolume: number;
      totalLiquidity: number;
    }>;
  }, [allMarkets, eventIds]);

  // Memoize format functions - MUST be defined before any early returns (React Rules of Hooks)
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const daysDiff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 0) return 'Ended';
      if (daysDiff < 1) return 'Today';
      if (daysDiff < 7) return `${daysDiff}d`;
      if (daysDiff < 30) return `${Math.floor(daysDiff / 7)}w`;
      return `${Math.floor(daysDiff / 30)}mo`;
    } catch {
      return null;
    }
  }, []);

  const formatVolume = useCallback((vol: number) => {
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  }, []);

  // Extract option name from market question (similar to Market Discovery)
  const extractOptionName = useCallback((question: string): string => {
    if (!question) return '';
    
    // Pattern: "Will [NAME] win [EVENT]?" or "Will [NAME] be [EVENT]?"
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    
    let match = question.match(winPattern);
    if (!match) {
      match = question.match(bePattern);
    }
    
    if (match && match.length >= 3) {
      return match[1].trim();
    }
    
    // Fallback: return question without question mark
    return question.split('?')[0] || question;
  }, []);



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading markets..." />
      </div>
    );
  }

  // Check if there are items to display
  const hasItems = eventGroups.length > 0 || watchlistMarkets.length > 0;

  if (displayMarketIds.length === 0 && eventIds.length === 0) {
    return (
      <EmptyState
        icon={ListPlus}
        title="Your watchlist is empty"
        description="Add markets or multimarkets from the Market Discovery card to track them here"
        className="p-4"
      />
    );
  }

  if (!hasItems && isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading watchlist markets..." />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="flex-1 min-h-0">
        {/* Event Groups */}
        {eventGroups.map((group) => {
          const isExpanded = expandedEvents.has(group.eventId);
          
          return (
            <div key={group.eventId} className="border-b border-border/50">
              {/* Event Group Header */}
              <div
                draggable
                onDragStart={(e) => {
                  const marketIds = group.markets.map(m => m.id);
                  // Set both eventId and marketIds for multimarket drag
                  e.dataTransfer.setData('eventId', group.eventId);
                  e.dataTransfer.setData('marketIds', JSON.stringify(marketIds));
                  e.dataTransfer.setData('marketQuestion', group.title || '');
                  e.dataTransfer.effectAllowed = 'move';
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '0.5';
                  }
                }}
                onDragEnd={(e) => {
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onClick={() => {
                  const newExpanded = new Set(expandedEvents);
                  if (isExpanded) {
                    newExpanded.delete(group.eventId);
                  } else {
                    newExpanded.add(group.eventId);
                  }
                  setExpandedEvents(newExpanded);
                }}
                className="px-3 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors group cursor-move"
              >
                <div className="flex items-start justify-between gap-2">
                  {group.imageUrl && !imageErrors.has(group.eventId) && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden border border-border bg-accent/20">
                      <img
                        src={group.imageUrl}
                        alt={group.title}
                        draggable="false"
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageErrors((prev: Set<string>) => new Set([...prev, group.eventId]));
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground mb-1 text-xs leading-tight">
                        {group.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        {group.category && (
                          <span className="flex items-center gap-1.5 capitalize font-medium">
                            <Tag className="h-3 w-3 opacity-70" />
                            <span>{group.category}</span>
                          </span>
                        )}
                        {formatDate(group.endDate) && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 opacity-70" />
                            <span className="opacity-70">Ends:</span>
                            <span className="font-semibold">{formatDate(group.endDate)}</span>
                          </span>
                        )}
                        {group.totalVolume > 0 && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 opacity-70" />
                            <span className="opacity-70">Vol:</span>
                            <span className="font-semibold">{formatVolume(group.totalVolume)}</span>
                          </span>
                        )}
                        {group.totalLiquidity > 0 && (
                          <span className="flex items-center gap-1.5">
                            <BarChart3 className="h-3 w-3 opacity-70" />
                            <span className="opacity-70">Liq:</span>
                            <span className="font-semibold">{formatVolume(group.totalLiquidity)}</span>
                          </span>
                        )}
                        <span className="text-muted-foreground/70">
                          {group.markets.length} options
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      removeEventFromWatchlist(group.eventId);
                    }}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    draggable={false}
                    title="Remove multimarket from watchlist"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Event Group Markets */}
              {isExpanded && (
                <div>
                  {group.markets.map((market) => {
                    const price = getPrice(market.id);
                    const yesPrice = market.outcomePrices?.YES ?? price?.price ?? 0.5;
                    const probability = price?.probability ?? (yesPrice * 100);
                    const displayPrice = price?.price ?? yesPrice;
                    const volume = market.volume || price?.volume24h || 0;
                    const liquidity = market.liquidity || price?.liquidity || 0;
                    const optionName = extractOptionName(market.question || '');

                    return (
                      <div
                        key={market.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('marketId', market.id);
                          e.dataTransfer.setData('marketQuestion', market.question || '');
                          e.dataTransfer.effectAllowed = 'move';
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.style.opacity = '0.5';
                          }
                        }}
                        onDragEnd={(e) => {
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                        className="px-3 py-2 pl-8 hover:bg-accent/30 border-b border-border/30 transition-colors group cursor-move"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {market.imageUrl && !imageErrors.has(market.id) && (
                            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                              <img
                                src={market.imageUrl}
                                alt={optionName || market.question}
                                draggable="false"
                                className="w-full h-full object-cover"
                                onError={() => {
                                  setImageErrors((prev: Set<string>) => new Set([...prev, market.id]));
                                }}
                              />
                            </div>
                          )}
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => selectMarket(market.id)}
                          >
                            <div className="font-medium text-foreground mb-1 text-xs leading-tight">
                              {optionName || market.question}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                              {volume > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <DollarSign className="h-3 w-3 opacity-70" />
                                  <span className="opacity-70">Vol:</span>
                                  <span className="font-semibold">{formatVolume(volume)}</span>
                                </span>
                              )}
                              {liquidity > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <BarChart3 className="h-3 w-3 opacity-70" />
                                  <span className="opacity-70">Liq:</span>
                                  <span className="font-semibold">{formatVolume(liquidity)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end gap-1">
                                {probability > 50 ? (
                                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                )}
                                <span 
                                  className="font-semibold text-xs"
                                  style={{ color: probability > 50 ? '#10b981' : '#ef4444' }}
                                >
                                  {probability.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-1 text-muted-foreground text-[10px] font-medium">
                                <DollarSign className="h-3 w-3 opacity-70" />
                                <span>${displayPrice.toFixed(3)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Individual Markets */}
        {watchlistMarkets.map((market) => {
          const price = getPrice(market.id);
          const yesPrice = market.outcomePrices?.YES ?? price?.price ?? 0.5;
          const probability = price?.probability ?? (yesPrice * 100);
          const displayPrice = price?.price ?? yesPrice;
          const volume = market.volume || price?.volume24h || 0;
          const liquidity = market.liquidity || price?.liquidity || 0;
          const optionName = extractOptionName(market.question || '');

          return (
            <div
              key={market.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('marketId', market.id);
                e.dataTransfer.setData('marketQuestion', market.question || '');
                e.dataTransfer.effectAllowed = 'move';
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = '0.5';
                }
              }}
              onDragEnd={(e) => {
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
              className="px-3 py-2.5 hover:bg-accent/50 border-b border-border/50 transition-colors group cursor-move"
            >
              <div className="flex items-start justify-between gap-2">
                {market.imageUrl && !imageErrors.has(market.id) && (
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                    <img
                      src={market.imageUrl}
                      alt={optionName || market.question}
                      draggable="false"
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors((prev: Set<string>) => new Set([...prev, market.id]));
                      }}
                    />
                  </div>
                )}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => selectMarket(market.id)}
                >
                  <div className="font-semibold text-foreground truncate mb-1.5 text-xs leading-tight">
                    {optionName || market.question}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                    {market.category && (
                      <span className="flex items-center gap-1.5 capitalize font-medium">
                        <Tag className="h-3 w-3 opacity-70" />
                        <span>{market.category}</span>
                      </span>
                    )}
                    {formatDate(market.endDate) && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 opacity-70" />
                        <span className="opacity-70">Ends:</span>
                        <span className="font-semibold">{formatDate(market.endDate)}</span>
                      </span>
                    )}
                    {volume > 0 && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3 opacity-70" />
                        <span className="opacity-70">Vol:</span>
                        <span className="font-semibold">{formatVolume(volume)}</span>
                      </span>
                    )}
                    {liquidity > 0 && (
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="h-3 w-3 opacity-70" />
                        <span className="opacity-70">Liq:</span>
                        <span className="font-semibold">{formatVolume(liquidity)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center justify-end gap-1">
                      {probability > 50 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span 
                        className="font-semibold text-xs"
                        style={{ color: probability > 50 ? '#10b981' : '#ef4444' }}
                      >
                        {probability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-muted-foreground text-[10px] font-medium">
                      <DollarSign className="h-3 w-3 opacity-70" />
                      <span>${displayPrice.toFixed(3)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(market.id);
                    }}
                    title="Remove from watchlist"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const WatchlistCard = React.memo(WatchlistCardComponent, (prevProps, nextProps) => {
  // Compare marketIds arrays for equality
  if (prevProps.marketIds?.length !== nextProps.marketIds?.length) {
    return false;
  }
  if (prevProps.marketIds && nextProps.marketIds) {
    return prevProps.marketIds.every((id, index) => id === nextProps.marketIds?.[index]);
  }
  return prevProps.marketIds === nextProps.marketIds;
});

