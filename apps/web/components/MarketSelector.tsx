'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore, isEventId, getEventIdFromPrefixed } from '@/stores/watchlist-store';
import { Loader2, Search, Calendar, DollarSign, BarChart3, Tag, TrendingUp, TrendingDown, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface MarketSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (marketId: string) => void;
  onSelectAll?: (marketIds: string[]) => void; // For selecting all markets in a group (e.g., for charts)
}

export function MarketSelector({ open, onOpenChange, onSelect, onSelectAll }: MarketSelectorProps) {
  const { data: markets = [], isLoading } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const { selectMarket, getPrice, getMarket } = useMarketStore();
  const { marketIds: watchlistIds, getEventIds } = useWatchlistStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Separate watchlist items
  const eventIds = useMemo(() => getEventIds(), [getEventIds]);
  const individualMarketIds = useMemo(() => {
    return watchlistIds.filter((id) => !isEventId(id));
  }, [watchlistIds]);

  // Filter watchlist markets based on search query
  const watchlistMarkets = useMemo(() => {
    const marketsList = markets?.filter((m) => individualMarketIds.includes(m.id)) || [];
    if (!searchQuery) return marketsList;
    
    const query = searchQuery.toLowerCase();
    return marketsList.filter((market) => 
      market.question?.toLowerCase().includes(query) ||
      market.slug?.toLowerCase().includes(query) ||
      market.id?.toLowerCase().includes(query)
    );
  }, [markets, individualMarketIds, searchQuery]);

  const watchlistEventGroups = useMemo(() => {
    if (!markets) return [];
    
    const groups = eventIds.map((eventId) => {
      const groupMarkets = markets.filter((m) => m.eventId === eventId);
      if (groupMarkets.length === 0) return null;
      
      // Filter by search query if searching
      let filteredMarkets = groupMarkets;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredMarkets = groupMarkets.filter((market) =>
          market.question?.toLowerCase().includes(query) ||
          market.slug?.toLowerCase().includes(query) ||
          market.id?.toLowerCase().includes(query) ||
          ((market as any).eventTitle || '').toLowerCase().includes(query)
        );
      }
      
      if (filteredMarkets.length === 0) return null;
      
      const firstMarket = filteredMarkets[0];
      return {
        eventId,
        title: (firstMarket as any).eventTitle || firstMarket.question || 'Event',
        imageUrl: (firstMarket as any).eventImageUrl || firstMarket.imageUrl,
        markets: filteredMarkets,
      };
    }).filter(Boolean) as Array<{
      eventId: string;
      title: string;
      imageUrl?: string;
      markets: typeof markets;
    }>;
    
    return groups;
  }, [markets, eventIds, searchQuery]);

  // Filter and group markets
  // When searching, show all matching markets (including watchlist items in main list)
  // When not searching, exclude watchlist items from main list (they're shown in watchlist section)
  const filteredMarkets = markets.filter((market) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      market.question?.toLowerCase().includes(query) ||
      market.slug?.toLowerCase().includes(query) ||
      market.id?.toLowerCase().includes(query)
    );
    
    // If no search query, exclude watchlist items from main list
    if (!searchQuery) {
      const isInWatchlist = individualMarketIds.includes(market.id);
      const isInWatchlistEvent = market.eventId && eventIds.includes(market.eventId);
      return matchesSearch && !isInWatchlist && !isInWatchlistEvent;
    }
    
    return matchesSearch;
  });

  // Group markets by eventId
  // When searching, include all matching markets (including watchlist items)
  // When not searching, exclude watchlist items (they're shown in watchlist section)
  const { groupedMarkets, standaloneMarkets } = useMemo(() => {
    const groups: Record<string, typeof markets> = {};
    const standalone: typeof markets = [];

    filteredMarkets.forEach((market) => {
      // When not searching, skip watchlist items (they're shown in watchlist section)
      // When searching, include all matching markets including watchlist items
      if (!searchQuery) {
        if (individualMarketIds.includes(market.id)) return;
        if (market.eventId && eventIds.includes(market.eventId)) return;
      }

      const isMultimarket = market.tokens && market.tokens.length > 2;
      const hasEventInfo = market.eventId && (market as any).eventTitle;
      
      // If it's a single multimarket (tokens > 2), don't group it
      if (isMultimarket) {
        standalone.push(market);
        return;
      }
      
      // If market is part of an event, group by eventId
      if (hasEventInfo) {
        const eventKey = `event:${market.eventId}`;
        if (!groups[eventKey]) {
          groups[eventKey] = [];
        }
        groups[eventKey].push(market);
      } else {
        standalone.push(market);
      }
    });

    // Filter groups to only include those with 2+ markets
    const groupedResults: Array<{ type: 'group'; group: typeof markets; eventId: string; title: string; imageUrl?: string } | { type: 'standalone'; market: typeof markets[0] }> = [];
    
    Object.entries(groups).forEach(([key, groupMarkets]) => {
      if (groupMarkets.length >= 2) {
        const firstMarket = groupMarkets[0];
        groupedResults.push({
          type: 'group',
          group: groupMarkets,
          eventId: firstMarket.eventId!,
          title: (firstMarket as any).eventTitle || firstMarket.question || 'Event',
          imageUrl: (firstMarket as any).eventImageUrl || firstMarket.imageUrl,
        });
      } else {
        // If group has only 1 market, treat as standalone
        standalone.push(...groupMarkets);
      }
    });

    return {
      groupedMarkets: groupedResults,
      standaloneMarkets: standalone,
    };
  }, [filteredMarkets, individualMarketIds, eventIds, searchQuery]);

  const handleSelect = (marketId: string) => {
    selectMarket(marketId);
    onSelect?.(marketId);
    onOpenChange(false);
    setSearchQuery('');
  };

  const handleSelectAll = (marketIds: string[]) => {
    if (onSelectAll) {
      onSelectAll(marketIds);
      onOpenChange(false);
      setSearchQuery('');
    }
  };

  const toggleGroup = (eventId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Helper functions
  const formatDate = (dateString?: string) => {
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
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  // Render market card component
  const renderMarketCard = (market: typeof markets[0]) => {
    const price = getPrice(market.id);
    const yesPrice = market.outcomePrices?.YES;
    const probability = price?.probability || (yesPrice ? (yesPrice * 100) : 0);
    const displayPrice = price?.price || yesPrice || 0;
    const volume = market.volume || price?.volume24h || 0;
    const liquidity = market.liquidity || price?.liquidity || 0;

    return (
      <button
        key={market.id}
        onClick={() => handleSelect(market.id)}
        className="w-full px-4 py-3 hover:bg-accent/50 transition-colors text-left group"
      >
        <div className="flex items-start gap-3">
          {market.imageUrl && !imageErrors.has(market.id) && (
            <div className="flex-shrink-0 w-12 h-12 overflow-hidden border border-border bg-accent/20 rounded">
              <Image
                src={market.imageUrl}
                alt={market.question}
                width={48}
                height={48}
                className="w-full h-full object-cover"
                onError={() => {
                  setImageErrors(prev => new Set([...prev, market.id]));
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 pr-2">
            <div className="font-semibold text-foreground truncate mb-1.5 leading-tight">
              {market.question}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {market.category && (
                <span className="flex items-center gap-1.5 capitalize">
                  <Tag className="h-3 w-3 opacity-70" />
                  <span>{market.category}</span>
                </span>
              )}
              {formatDate(market.endDate) && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 opacity-70" />
                  <span className="opacity-70">Ends:</span>
                  <span className="font-medium">{formatDate(market.endDate)}</span>
                </span>
              )}
              {volume > 0 && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 opacity-70" />
                  <span className="opacity-70">Vol:</span>
                  <span className="font-medium">{formatVolume(volume)}</span>
                </span>
              )}
              {liquidity > 0 && (
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3 opacity-70" />
                  <span className="opacity-70">Liq:</span>
                  <span className="font-medium">{formatVolume(liquidity)}</span>
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 min-w-[80px]">
            <div className="flex items-center justify-end gap-1 mb-0.5">
              {probability > 50 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className="font-semibold text-sm" style={{ color: probability > 50 ? '#10b981' : '#ef4444' }}>
                {probability.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-end gap-1 text-muted-foreground text-xs font-medium mb-1">
              <DollarSign className="h-3 w-3 opacity-70" />
              <span>${displayPrice.toFixed(3)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/70 font-mono truncate">
              {market.slug?.split('-').slice(0, 2).join('-') || market.id.slice(0, 8)}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const hasWatchlistItems = watchlistMarkets.length > 0 || watchlistEventGroups.length > 0;
  const hasMarketItems = groupedMarkets.length > 0 || standaloneMarkets.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Market</DialogTitle>
          <DialogDescription>
            Choose a market to view or trade
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Market List */}
          <div className="flex-1 overflow-y-auto border">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <LoadingSpinner size="md" text="Loading markets..." />
              </div>
            ) : !hasWatchlistItems && !hasMarketItems ? (
              <EmptyState
                icon={Search}
                title={searchQuery ? 'No markets found' : 'No markets available'}
                description={searchQuery ? 'Try a different search query' : 'Markets may be temporarily unavailable'}
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-border">
                {/* Watchlist Section */}
                {hasWatchlistItems && (
                  <>
                    <div className="px-4 py-2 bg-accent/30 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-sm">Watchlist</span>
                      </div>
                    </div>
                    
                    {/* Watchlist Event Groups */}
                    {watchlistEventGroups.map((group) => {
                      const isExpanded = expandedGroups.has(group.eventId);
                      return (
                        <div key={`watchlist-event-${group.eventId}`} className="divide-y divide-border">
                          <div className="w-full px-4 py-3 hover:bg-accent/30 transition-colors flex items-center gap-2">
                            <button
                              onClick={() => toggleGroup(group.eventId)}
                              className="flex items-center gap-2 flex-1 text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              {group.imageUrl && !imageErrors.has(`group-${group.eventId}`) && (
                                <div className="flex-shrink-0 w-8 h-8 overflow-hidden border border-border bg-accent/20 rounded">
                                  <Image
                                    src={group.imageUrl}
                                    alt={group.title}
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                    onError={() => {
                                      setImageErrors(prev => new Set([...prev, `group-${group.eventId}`]));
                                    }}
                                  />
                                </div>
                              )}
                              <span className="font-medium text-sm">{group.title}</span>
                              <span className="text-xs text-muted-foreground">({group.markets.length} markets)</span>
                            </button>
                            {onSelectAll && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectAll(group.markets.map(m => m.id));
                                }}
                                className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 hover:bg-accent/50 rounded transition-colors flex-shrink-0"
                                title="Select all markets in this group"
                              >
                                All
                              </button>
                            )}
                          </div>
                          {isExpanded && (
                            <div>
                              {group.markets.map((market) => renderMarketCard(market))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Watchlist Individual Markets */}
                    {watchlistMarkets.map((market) => renderMarketCard(market))}
                  </>
                )}

                {/* All Markets Section */}
                {hasMarketItems && (
                  <>
                    {hasWatchlistItems && (
                      <div className="px-4 py-2 bg-accent/30 border-b border-border">
                        <span className="font-semibold text-sm">All Markets</span>
                      </div>
                    )}
                    
                    {/* Grouped Markets */}
                    {groupedMarkets.map((item) => {
                      if (item.type === 'group') {
                        const isExpanded = expandedGroups.has(item.eventId);
                        return (
                          <div key={`group-${item.eventId}`} className="divide-y divide-border">
                            <div className="w-full px-4 py-3 hover:bg-accent/30 transition-colors flex items-center gap-2">
                              <button
                                onClick={() => toggleGroup(item.eventId)}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                {item.imageUrl && !imageErrors.has(`group-${item.eventId}`) && (
                                  <div className="flex-shrink-0 w-8 h-8 overflow-hidden border border-border bg-accent/20 rounded">
                                    <Image
                                      src={item.imageUrl}
                                      alt={item.title}
                                      width={32}
                                      height={32}
                                      className="w-full h-full object-cover"
                                      onError={() => {
                                        setImageErrors(prev => new Set([...prev, `group-${item.eventId}`]));
                                      }}
                                    />
                                  </div>
                                )}
                                <span className="font-medium text-sm">{item.title}</span>
                                <span className="text-xs text-muted-foreground">({item.group.length} markets)</span>
                              </button>
                              {onSelectAll && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAll(item.group.map(m => m.id));
                                  }}
                                  className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 hover:bg-accent/50 rounded transition-colors flex-shrink-0"
                                  title="Select all markets in this group"
                                >
                                  All
                                </button>
                              )}
                            </div>
                            {isExpanded && (
                              <div>
                                {item.group.map((market) => renderMarketCard(market))}
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return renderMarketCard(item.market);
                      }
                    })}
                    
                    {/* Standalone Markets */}
                    {standaloneMarkets.map((market) => renderMarketCard(market))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

