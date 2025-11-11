'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore, isEventId, getEventIdFromPrefixed } from '@/stores/watchlist-store';
import { useLayoutStore } from '@/stores/layout-store';
import { Loader2, Search, Calendar, DollarSign, BarChart3, Tag, TrendingUp, TrendingDown, Star, ChevronDown, ChevronRight, BarChart2, Newspaper, FileText, ArrowUpDown, Check, Layers, Activity, BookOpen, Calculator, Target, Gauge, MessageSquare, BookMarked, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

// Category filter options
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'sports', label: 'Sports' },
  { id: 'nfl', label: 'NFL' },
  { id: 'nba', label: 'NBA' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'tech', label: 'Tech' },
  { id: 'ai', label: 'AI' },
  { id: 'politics', label: 'Politics' },
  { id: 'us-politics', label: 'US Politics' },
  { id: 'elections', label: 'Elections' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'economics', label: 'Economics' },
  { id: 'business', label: 'Business' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'movies', label: 'Movies' },
  { id: 'music', label: 'Music' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'health', label: 'Health' },
  { id: 'covid', label: 'COVID' },
  { id: 'climate', label: 'Climate' },
  { id: 'space', label: 'Space' },
  { id: 'weather', label: 'Weather' },
  { id: 'legal', label: 'Legal' },
  { id: 'immigration', label: 'Immigration' },
  { id: 'ukraine', label: 'Ukraine' },
  { id: 'middle-east', label: 'Middle East' },
];

// Sort options
const SORT_OPTIONS = [
  { id: 'volume', label: '24hr Volume' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'new', label: 'New' },
  { id: 'ending', label: 'Ending Soon' },
];

// Available card types that can be created from a market
export const MARKET_CARD_TYPES: Array<{ 
  type: 'chart' | 'tradingview-chart' | 'depth' | 'orderbook' | 'news' | 'resolution-criteria' | 'market-info' | 'market-trade' | 'market-research' | 'correlation-matrix' | 'activity-scanner' | 'positions' | 'scenario-builder' | 'kelly-calculator' | 'position-sizing' | 'price-converter' | 'comments' | 'journal'; 
  label: string; 
  icon: React.ComponentType<{ className?: string }>;
  category: 'Trading' | 'Research' | 'Analysis' | 'Risk Management' | 'Utilities';
}> = [
  // Trading
  { type: 'market-trade', label: 'Market Trade', icon: ArrowUpDown, category: 'Trading' },
  { type: 'positions', label: 'Positions & P&L', icon: DollarSign, category: 'Trading' },
  // Research
  { type: 'market-info', label: 'Market Info', icon: FileText, category: 'Research' },
  { type: 'market-research', label: 'AI Market Research', icon: BookMarked, category: 'Research' },
  { type: 'news', label: 'News', icon: Newspaper, category: 'Research' },
  { type: 'resolution-criteria', label: 'Resolution Criteria', icon: FileText, category: 'Research' },
  // Analysis
  { type: 'chart', label: 'Chart', icon: BarChart2, category: 'Analysis' },
  { type: 'tradingview-chart', label: 'TradingView Chart', icon: TrendingUp, category: 'Analysis' },
  { type: 'depth', label: 'Depth & Impact', icon: Layers, category: 'Analysis' },
  { type: 'orderbook', label: 'Order Book', icon: BookOpen, category: 'Analysis' },
  { type: 'correlation-matrix', label: 'Correlation Matrix', icon: Activity, category: 'Analysis' },
  { type: 'activity-scanner', label: 'Activity Scanner', icon: Activity, category: 'Analysis' },
  // Risk Management
  { type: 'scenario-builder', label: 'Scenario Builder', icon: Target, category: 'Risk Management' },
  { type: 'kelly-calculator', label: 'Kelly Calculator', icon: Calculator, category: 'Risk Management' },
  { type: 'position-sizing', label: 'Position Sizing', icon: Gauge, category: 'Risk Management' },
  { type: 'price-converter', label: 'Price Converter', icon: Calculator, category: 'Risk Management' },
  // Utilities
  { type: 'comments', label: 'Comments', icon: MessageSquare, category: 'Utilities' },
  { type: 'journal', label: 'Journal', icon: BookMarked, category: 'Utilities' },
];

interface MarketSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (marketId: string) => void;
  onSelectAll?: (marketIds: string[]) => void; // For selecting all markets in a group (e.g., for charts)
  currentCardType?: string; // If provided, this is called from within a card - show "Show more cards?" dropdown instead of module selection
}

export function MarketSelector({ open, onOpenChange, onSelect, onSelectAll, currentCardType }: MarketSelectorProps) {
  const { data: markets = [], isLoading } = useMarkets({ active: true }); // Fetch all markets (no limit)
  const { selectMarket, getPrice, getMarket } = useMarketStore();
  const { 
    marketIds: watchlistIds, 
    getEventIds,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    addEventToWatchlist,
    removeEventFromWatchlist,
    isEventInWatchlist
  } = useWatchlistStore();
  const { addCard } = useLayoutStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('volume');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  // Separate watchlist items
  // Note: eventIds depends on watchlistIds to ensure it updates when watchlist changes
  const eventIds = useMemo(() => getEventIds(), [getEventIds, watchlistIds]);
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
  const filteredMarkets = useMemo(() => {
    let filtered = markets.filter((market) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        market.question?.toLowerCase().includes(query) ||
        market.slug?.toLowerCase().includes(query) ||
        market.id?.toLowerCase().includes(query)
      );
      
      // Filter by category
      const matchesCategory = selectedCategory === 'all' || 
        market.category?.toLowerCase() === selectedCategory.toLowerCase() ||
        market.category?.toLowerCase().includes(selectedCategory.toLowerCase());
      
      // If no search query, exclude watchlist items from main list
      if (!searchQuery) {
        const isInWatchlist = individualMarketIds.includes(market.id);
        const isInWatchlistEvent = market.eventId && eventIds.includes(market.eventId);
        return matchesSearch && matchesCategory && !isInWatchlist && !isInWatchlistEvent;
      }
      
      return matchesSearch && matchesCategory;
    });

    // Sort markets
    filtered.sort((a, b) => {
      const priceA = getPrice(a.id);
      const priceB = getPrice(b.id);
      const volumeA = a.volume || priceA?.volume24h || 0;
      const volumeB = b.volume || priceB?.volume24h || 0;
      const liquidityA = a.liquidity || priceA?.liquidity || 0;
      const liquidityB = b.liquidity || priceB?.liquidity || 0;

      switch (sortBy) {
        case 'volume':
          return volumeB - volumeA;
        case 'liquidity':
          return liquidityB - liquidityA;
        case 'new':
          // Sort by end date (newer markets have later end dates)
          const aEndDate = a.endDate ? new Date(a.endDate).getTime() : 0;
          const bEndDate = b.endDate ? new Date(b.endDate).getTime() : 0;
          return bEndDate - aEndDate;
        case 'ending':
          // Sort by end date (ending soon = earlier end dates first)
          const aEnd = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const bEnd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return aEnd - bEnd; // Ascending (sooner dates first)
        default:
          return 0;
      }
    });

    return filtered;
  }, [markets, searchQuery, selectedCategory, sortBy, individualMarketIds, eventIds, getPrice]);

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
    // If onSelectAll is provided, this is for selecting all markets in a group (skip module selection)
    if (onSelectAll) {
      selectMarket(marketId);
      onSelect?.(marketId);
      onOpenChange(false);
      setSearchQuery('');
      return;
    }
    
    // If currentCardType is provided, this is called from within a card - just update the market
    if (currentCardType) {
      selectMarket(marketId);
      onSelect?.(marketId);
      onOpenChange(false);
      setSearchQuery('');
      return;
    }
    
    // If onSelect is provided, this is called from a card (even if empty) - skip module selection
    if (onSelect) {
      selectMarket(marketId);
      onSelect(marketId);
      onOpenChange(false);
      setSearchQuery('');
      return;
    }
    
    // Otherwise, show module selection step (for standalone market selection from main UI)
    setSelectedMarketId(marketId);
    setSelectedModules(new Set());
  };

  const handleModuleToggle = (moduleType: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleType)) {
        next.delete(moduleType);
      } else {
        next.add(moduleType);
      }
      return next;
    });
  };

  const handleConfirmModules = () => {
    if (!selectedMarketId) return;
    
    // Add selected modules as cards
    selectedModules.forEach((moduleType) => {
      addCard({
        id: `${moduleType}-${Date.now()}-${Math.random()}`,
        type: moduleType as any,
        props: { marketId: selectedMarketId },
      });
    });
    
    // Call onSelect callback
    selectMarket(selectedMarketId);
    onSelect?.(selectedMarketId);
    
    // Reset and close
    setSelectedMarketId(null);
    setSelectedModules(new Set());
    onOpenChange(false);
    setSearchQuery('');
  };

  const handleCancelModuleSelection = () => {
    setSelectedMarketId(null);
    setSelectedModules(new Set());
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
    const inWatchlist = isInWatchlist(market.id);

    const handleStarClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (inWatchlist) {
        removeFromWatchlist(market.id);
      } else {
        addToWatchlist(market.id);
      }
    };

    return (
      <div
        key={market.id}
        className="w-full px-4 py-3 hover:bg-accent/50 transition-colors group relative"
      >
        <button
          onClick={() => handleSelect(market.id)}
          className="w-full text-left"
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
            <div className="text-right flex-shrink-0 min-w-[80px] pr-6">
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
        {/* Star button for watchlist */}
        <button
          onClick={handleStarClick}
          className="absolute top-3 right-3 p-1.5 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 z-10"
          title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star 
            className={`h-4 w-4 ${inWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} 
          />
        </button>
      </div>
    );
  };

  const hasWatchlistItems = watchlistMarkets.length > 0 || watchlistEventGroups.length > 0;
  const hasMarketItems = groupedMarkets.length > 0 || standaloneMarkets.length > 0;
  const selectedMarket = selectedMarketId ? markets.find((m) => m.id === selectedMarketId) : null;

  // Show module selection step if a market is selected
  if (selectedMarketId && selectedMarket) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleCancelModuleSelection();
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-md flex flex-col">
          <DialogHeader>
            <DialogTitle>What to show with this market?</DialogTitle>
            <DialogDescription>
              Select the modules you want to add to your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Selected Market Info */}
            <div className="p-3 bg-accent/30 rounded-lg border border-border">
              <div className="flex items-start gap-3">
                {selectedMarket.imageUrl && !imageErrors.has(selectedMarket.id) && (
                  <div className="flex-shrink-0 w-12 h-12 overflow-hidden border border-border bg-accent/20 rounded">
                    <Image
                      src={selectedMarket.imageUrl}
                      alt={selectedMarket.question}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set([...prev, selectedMarket.id]));
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {selectedMarket.question}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selectedMarket.slug?.split('-').slice(0, 2).join('-') || selectedMarket.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            </div>

            {/* Module Checkboxes */}
            <div className="space-y-2">
              {MARKET_CARD_TYPES.map(({ type, label, icon: Icon }) => {
                const isSelected = selectedModules.has(type);
                return (
                  <div
                    key={type}
                    onClick={() => handleModuleToggle(type)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleModuleToggle(type)}
                      className="flex-shrink-0"
                    />
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={handleCancelModuleSelection}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmModules}
                className="flex-1"
                disabled={selectedModules.size === 0}
              >
                {selectedModules.size === 0 ? 'Select at least one module' : `Add ${selectedModules.size} module${selectedModules.size > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter and Sort Controls */}
            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2.5 gap-1.5"
                  >
                    <Filter className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'All'}
                    </span>
                    <span className="sm:hidden">Filter</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 max-h-[400px] overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => setSelectedCategory('all')}
                    className={selectedCategory === 'all' ? 'bg-accent' : ''}
                  >
                    <span className="text-xs">All Categories</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  
                  {/* Group categories by type */}
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Finance
                    </div>
                    {CATEGORIES.filter((c) => ['crypto', 'stocks', 'economics', 'business'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Sports
                    </div>
                    {CATEGORIES.filter((c) => ['sports', 'nfl', 'nba', 'soccer'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Politics
                    </div>
                    {CATEGORIES.filter((c) => ['politics', 'us-politics', 'elections', 'geopolitics', 'immigration', 'legal'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Technology
                    </div>
                    {CATEGORIES.filter((c) => ['tech', 'ai', 'gaming'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Entertainment
                    </div>
                    {CATEGORIES.filter((c) => ['entertainment', 'movies', 'music'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Science & Health
                    </div>
                    {CATEGORIES.filter((c) => ['health', 'covid', 'climate', 'space', 'weather'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Current Events
                    </div>
                    {CATEGORIES.filter((c) => ['ukraine', 'middle-east'].includes(c.id)).map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`text-xs ${selectedCategory === cat.id ? 'bg-accent' : ''}`}
                      >
                        {cat.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2.5 gap-1.5"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort'}
                    </span>
                    <span className="sm:hidden">Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => setSortBy(opt.id)}
                      className={sortBy === opt.id ? 'bg-accent' : ''}
                    >
                      {opt.label} {sortBy === opt.id && '✓'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
                      const eventInWatchlist = isEventInWatchlist(group.eventId);
                      
                      const handleEventStarClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (eventInWatchlist) {
                          removeEventFromWatchlist(group.eventId);
                        } else {
                          addEventToWatchlist(group.eventId);
                        }
                      };

                      return (
                        <div key={`watchlist-event-${group.eventId}`} className="divide-y divide-border">
                          <div className="w-full px-4 py-3 hover:bg-accent/30 transition-colors flex items-center gap-2 relative group">
                            <button
                              onClick={() => toggleGroup(group.eventId)}
                              className="flex items-center gap-2 flex-1 text-left min-w-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                              <span className="font-medium text-sm truncate">{group.title}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">({group.markets.length} markets)</span>
                            </button>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {onSelectAll && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectAll(group.markets.map(m => m.id));
                                  }}
                                  className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 hover:bg-accent/50 rounded transition-colors"
                                  title="Select all markets in this group"
                                >
                                  All
                                </button>
                              )}
                              <button
                                onClick={handleEventStarClick}
                                className="p-1.5 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                title={eventInWatchlist ? 'Remove event from watchlist' : 'Add event to watchlist'}
                              >
                                <Star 
                                  className={`h-4 w-4 ${eventInWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} 
                                />
                              </button>
                            </div>
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
                        const eventInWatchlist = isEventInWatchlist(item.eventId);
                        
                        const handleEventStarClick = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (eventInWatchlist) {
                            removeEventFromWatchlist(item.eventId);
                          } else {
                            addEventToWatchlist(item.eventId);
                          }
                        };

                        return (
                          <div key={`group-${item.eventId}`} className="divide-y divide-border">
                            <div className="w-full px-4 py-3 hover:bg-accent/30 transition-colors flex items-center gap-2 relative group">
                              <button
                                onClick={() => toggleGroup(item.eventId)}
                                className="flex items-center gap-2 flex-1 text-left min-w-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                                <span className="font-medium text-sm truncate">{item.title}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">({item.group.length} markets)</span>
                              </button>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {onSelectAll && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAll(item.group.map(m => m.id));
                                    }}
                                    className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 hover:bg-accent/50 rounded transition-colors"
                                    title="Select all markets in this group"
                                  >
                                    All
                                  </button>
                                )}
                                <button
                                  onClick={handleEventStarClick}
                                  className="p-1.5 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                  title={eventInWatchlist ? 'Remove event from watchlist' : 'Add event to watchlist'}
                                >
                                  <Star 
                                    className={`h-4 w-4 ${eventInWatchlist ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} 
                                  />
                                </button>
                              </div>
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

