'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore, isEventId, getEventIdFromPrefixed } from '@/stores/watchlist-store';
import { Loader2, X, Calendar, DollarSign, BarChart3, Tag, TrendingUp, TrendingDown, ListPlus, ChevronDown, ChevronRight, Search, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface WatchlistCardProps {
  marketIds?: string[];
}

type SortOption = 'name' | 'price' | 'probability' | 'volume' | 'liquidity' | 'date';

// Helper component to subscribe to real-time prices for a market
function RealtimePriceSubscriber({ marketId }: { marketId: string }) {
  useRealtimePrice(marketId, 'YES');
  return null;
}

function WatchlistCardComponent({ marketIds: propMarketIds }: WatchlistCardProps) {
  const { marketIds: watchlistIds, removeFromWatchlist, getEventIds, removeEventFromWatchlist } = useWatchlistStore();
  const { data: allMarkets, isLoading } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const { selectMarket, getPrice, getMarket, selectedMarketId } = useMarketStore();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use prop marketIds if provided, otherwise use watchlist store
  const displayMarketIds = propMarketIds || watchlistIds;

  // Separate event IDs from market IDs
  const eventIds = useMemo(() => {
    if (propMarketIds) {
      // If propMarketIds provided, check if any are event IDs
      return propMarketIds.filter(isEventId).map(getEventIdFromPrefixed);
    }
    return getEventIds();
  }, [propMarketIds, getEventIds, watchlistIds]);

  const individualMarketIds = useMemo(() => {
    return displayMarketIds.filter((id) => !isEventId(id));
  }, [displayMarketIds]);

  // Subscribe to real-time price updates for all markets in watchlist
  // This ensures prices are updated in real-time
  // Note: We can't call hooks in a loop, so we'll create a helper component
  // For now, we'll subscribe to the first few markets to avoid performance issues
  // The real-time client will handle updates for all markets efficiently
  const marketsToSubscribe = useMemo(() => {
    // Limit to first 20 markets to avoid too many subscriptions
    return individualMarketIds.slice(0, 20);
  }, [individualMarketIds]);

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

  // Extract option name from market question (similar to Market Discovery)
  // When market is part of an event, removes event context to show just the distinguishing part
  const extractOptionName = useCallback((question: string, eventTitle?: string): string => {
    if (!question) return '';
    
    // First, try to extract name from common patterns - prioritize this over date/price extraction
    // Pattern: "Will [NAME] win [EVENT]?" - extract NAME
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    const winMatch = question.match(winPattern);
    if (winMatch && winMatch.length >= 2) {
      const name = winMatch[1].trim();
      // Don't return if it's just a year (4 digits)
      if (!/^\d{4}$/.test(name)) {
        return name;
      }
    }
    
    // Pattern: "Will [NAME] be [EVENT]?" - extract NAME
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    const beMatch = question.match(bePattern);
    if (beMatch && beMatch.length >= 2) {
      const name = beMatch[1].trim();
      // Don't return if it's just a year (4 digits)
      if (!/^\d{4}$/.test(name)) {
        return name;
      }
    }
    
    // If we have an event title, try to extract what's unique about this market
    if (eventTitle) {
      // Remove the event title from the question to get the distinguishing part
      // Normalize both strings for comparison (lowercase, remove punctuation)
      const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const normalizedQuestion = normalize(question);
      const normalizedEventTitle = normalize(eventTitle);
      
      // Extract key words from event title (remove common words)
      const eventWords = normalizedEventTitle.split(' ').filter(w => 
        w.length > 2 && !['will', 'what', 'who', 'when', 'where', 'how', 'the', 'and', 'or', 'in', 'by', 'for', 'to'].includes(w)
      );
      
      // Remove event-related words from question
      let remaining = normalizedQuestion;
      eventWords.forEach(word => {
        remaining = remaining.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
      });
      remaining = remaining.replace(/\s+/g, ' ').trim();
      
      // If we successfully removed event context, extract the unique part
      if (remaining.length > 0 && remaining !== normalizedQuestion) {
        // Extract what's left after removing event words, but exclude years
        const uniquePart = question.split(/\s+/).filter(word => {
          const normalizedWord = normalize(word);
          // Skip years (4-digit numbers)
          if (/^\d{4}$/.test(word)) {
            return false;
          }
          return !eventWords.some(ew => normalizedWord.includes(ew) || ew.includes(normalizedWord));
        }).join(' ').replace(/\?/g, '').trim();
        
        if (uniquePart.length > 0 && uniquePart.length < question.length) {
          return uniquePart;
        }
        
        // Try to extract price patterns: $X, X, Xk, Xm, etc. (but not years)
        const priceMatch = question.match(/(\$[\d,]+(?:\.\d+)?[kmb]?)/i);
        if (priceMatch) {
          return priceMatch[1].trim();
        }
        
        // Look for dates (but not standalone years)
        const dateMatch = question.match(/(\w+\s+\d{1,2},?\s+\d{4})/i);
        if (dateMatch) {
          return dateMatch[1].trim();
        }
      }
    }
    
    // Fallback: Extract price if present (but not years)
    const pricePattern = /(\$[\d,]+(?:\.\d+)?[kmb]?)/i;
    const priceMatch = question.match(pricePattern);
    if (priceMatch) {
      return priceMatch[1].trim();
    }
    
    // Last resort: return everything before the question mark, cleaned up
    // But try to remove years if they're standalone
    const beforeQuestionMark = question.split('?')[0]?.trim();
    if (beforeQuestionMark && beforeQuestionMark.length < question.length) {
      // Remove standalone years from the end
      const cleaned = beforeQuestionMark.replace(/\s+\d{4}$/, '').trim();
      return cleaned || beforeQuestionMark;
    }
    
    return question;
  }, []);

  // Filter markets and event groups by search query
  const filteredWatchlistMarkets = useMemo(() => {
    if (!searchQuery.trim()) return watchlistMarkets;
    
    const query = searchQuery.toLowerCase();
    return watchlistMarkets.filter((market) => {
      const question = market.question?.toLowerCase() || '';
      const category = market.category?.toLowerCase() || '';
      const optionName = extractOptionName(market.question || '', (market as any).eventTitle).toLowerCase();
      return question.includes(query) || category.includes(query) || optionName.includes(query);
    });
  }, [watchlistMarkets, searchQuery, extractOptionName]);

  const filteredEventGroups = useMemo(() => {
    if (!searchQuery.trim()) return eventGroups;
    
    const query = searchQuery.toLowerCase();
    return eventGroups.filter((group) => {
      const title = group.title.toLowerCase();
      const category = group.category?.toLowerCase() || '';
      return title.includes(query) || category.includes(query) || 
        group.markets.some(m => {
          const optionName = extractOptionName(m.question || '', (m as any).eventTitle).toLowerCase();
          return m.question?.toLowerCase().includes(query) || optionName.includes(query);
        });
    });
  }, [eventGroups, searchQuery, extractOptionName]);

  // Sort function
  const sortMarkets = useCallback((markets: typeof watchlistMarkets) => {
    const sorted = [...markets];
    
    sorted.sort((a, b) => {
      const priceA = getPrice(a.id);
      const priceB = getPrice(b.id);
      const yesPriceA = a.outcomePrices?.YES ?? priceA?.price ?? 0.5;
      const yesPriceB = b.outcomePrices?.YES ?? priceB?.price ?? 0.5;
      const probabilityA = priceA?.probability ?? (yesPriceA * 100);
      const probabilityB = priceB?.probability ?? (yesPriceB * 100);
      const volumeA = a.volume || priceA?.volume24h || 0;
      const volumeB = b.volume || priceB?.volume24h || 0;
      const liquidityA = a.liquidity || priceA?.liquidity || 0;
      const liquidityB = b.liquidity || priceB?.liquidity || 0;
      
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          const nameA = extractOptionName(a.question || '', (a as any).eventTitle).toLowerCase();
          const nameB = extractOptionName(b.question || '', (b as any).eventTitle).toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'price':
          comparison = yesPriceA - yesPriceB;
          break;
        case 'probability':
          comparison = probabilityA - probabilityB;
          break;
        case 'volume':
          comparison = volumeA - volumeB;
          break;
        case 'liquidity':
          comparison = liquidityA - liquidityB;
          break;
        case 'date':
          const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
          const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [sortBy, sortDirection, getPrice, extractOptionName]);

  const sortEventGroups = useCallback((groups: typeof eventGroups) => {
    const sorted = [...groups];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.toLowerCase().localeCompare(b.title.toLowerCase());
          break;
        case 'volume':
          comparison = a.totalVolume - b.totalVolume;
          break;
        case 'liquidity':
          comparison = a.totalLiquidity - b.totalLiquidity;
          break;
        case 'date':
          const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
          const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
        default:
          // For price/probability, sort by first market's price
          const firstMarketA = a.markets[0];
          const firstMarketB = b.markets[0];
          if (!firstMarketA || !firstMarketB) {
            comparison = 0;
            break;
          }
          const priceA = getPrice(firstMarketA.id);
          const priceB = getPrice(firstMarketB.id);
          const yesPriceA = firstMarketA.outcomePrices?.YES ?? priceA?.price ?? 0.5;
          const yesPriceB = firstMarketB.outcomePrices?.YES ?? priceB?.price ?? 0.5;
          if (sortBy === 'price') {
            comparison = yesPriceA - yesPriceB;
          } else {
            const probA = priceA?.probability ?? (yesPriceA * 100);
            const probB = priceB?.probability ?? (yesPriceB * 100);
            comparison = probA - probB;
          }
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [sortBy, sortDirection, getPrice]);

  // Apply sorting
  const sortedWatchlistMarkets = useMemo(() => {
    if (!filteredWatchlistMarkets || filteredWatchlistMarkets.length === 0) return [];
    return sortMarkets(filteredWatchlistMarkets);
  }, [filteredWatchlistMarkets, sortMarkets]);

  const sortedEventGroups = useMemo(() => {
    if (!filteredEventGroups || filteredEventGroups.length === 0) return [];
    return sortEventGroups(filteredEventGroups);
  }, [filteredEventGroups, sortEventGroups]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const getSortLabel = useCallback(() => {
    const labels: Record<SortOption, string> = {
      name: 'Name',
      price: 'Price',
      probability: 'Probability',
      volume: 'Volume',
      liquidity: 'Liquidity',
      date: 'End Date',
    };
    return labels[sortBy];
  }, [sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading markets..." />
      </div>
    );
  }

  // Check if there are items to display
  const hasItems = sortedEventGroups.length > 0 || sortedWatchlistMarkets.length > 0;
  const hasFilteredItems = filteredEventGroups.length > 0 || filteredWatchlistMarkets.length > 0;

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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Subscribe to real-time prices for all markets in watchlist */}
      {marketsToSubscribe.map((marketId) => (
        <RealtimePriceSubscriber key={marketId} marketId={marketId} />
      ))}
      
      {/* Search and Sort Controls */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-border bg-accent/20 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-2 text-xs bg-background"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5 gap-1.5"
                type="button"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span className="hidden sm:inline">{getSortLabel()}</span>
                <span className="sm:hidden">Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => { setSortBy('name'); setSortDirection('asc'); }}>
                Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('price'); setSortDirection('desc'); }}>
                Price {sortBy === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('probability'); setSortDirection('desc'); }}>
                Probability {sortBy === 'probability' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('volume'); setSortDirection('desc'); }}>
                Volume {sortBy === 'volume' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('liquidity'); setSortDirection('desc'); }}>
                Liquidity {sortBy === 'liquidity' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('date'); setSortDirection('asc'); }}>
                End Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
                {sortDirection === 'asc' ? 'Descending' : 'Ascending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {searchQuery && !hasFilteredItems && (
          <div className="text-xs text-muted-foreground text-center py-1">
            No results found for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Event Groups */}
        {sortedEventGroups.map((group) => {
          const isExpanded = expandedEvents.has(group.eventId);
          const isAnyMarketSelected = group.markets.some(m => m.id === selectedMarketId);
          
          return (
            <div key={group.eventId} className={cn(
              "border-b border-border/50",
              isAnyMarketSelected && "bg-primary/5"
            )}>
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
                className={cn(
                  "px-3 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors duration-200 group cursor-move",
                  isAnyMarketSelected && "bg-primary/10"
                )}
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
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
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
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Event Group Markets */}
              {isExpanded && (
                <div>
                  {group.markets.map((market) => {
                    if (!market?.id) return null;
                    const price = getPrice(market.id);
                    const yesPrice = market.outcomePrices?.YES ?? price?.price ?? 0.5;
                    const probability = price?.probability ?? (yesPrice * 100);
                    const displayPrice = price?.price ?? yesPrice;
                    const volume = market.volume || price?.volume24h || 0;
                    const liquidity = market.liquidity || price?.liquidity || 0;
                    const optionName = extractOptionName(market.question || '', (market as any).eventTitle);
                    const isSelected = market.id === selectedMarketId;

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
                        className={cn(
                          "px-3 py-2 pl-8 hover:bg-accent/30 border-b border-border/30 transition-colors duration-200 group cursor-move",
                          isSelected && "bg-primary/10 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {market.imageUrl && !imageErrors.has(market.id) && (
                            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                              <img
                                src={market.imageUrl}
                                alt={market.question || optionName}
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
                              {market.question || optionName}
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
        {sortedWatchlistMarkets.map((market) => {
          if (!market?.id) return null;
          const price = getPrice(market.id);
          const yesPrice = market.outcomePrices?.YES ?? price?.price ?? 0.5;
          const probability = price?.probability ?? (yesPrice * 100);
          const displayPrice = price?.price ?? yesPrice;
          const volume = market.volume || price?.volume24h || 0;
          const liquidity = market.liquidity || price?.liquidity || 0;
          const optionName = extractOptionName(market.question || '', (market as any).eventTitle);
          const isSelected = market.id === selectedMarketId;

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
              className={cn(
                "px-3 py-2.5 hover:bg-accent/50 border-b border-border/50 transition-colors duration-200 group cursor-move",
                isSelected && "bg-primary/10 border-l-2 border-l-primary"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                {market.imageUrl && !imageErrors.has(market.id) && (
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                    <img
                      src={market.imageUrl}
                      alt={market.question || optionName}
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
                    {market.question || optionName}
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
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(market.id);
                    }}
                    title="Remove from watchlist"
                  >
                    <X className="h-3.5 w-3.5" />
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

