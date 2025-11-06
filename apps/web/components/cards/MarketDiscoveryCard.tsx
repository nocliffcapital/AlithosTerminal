'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { useWatchlistStore } from '@/stores/watchlist-store';
import { useLayoutStore } from '@/stores/layout-store';
import { Loader2, Search, Plus, Check, ChevronDown, ChevronRight, Calendar, DollarSign, BarChart3, Tag, TrendingUp, TrendingDown, Grid3x3, MoreVertical, BarChart2, Newspaper, FileText, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

// Map our category IDs to Polymarket's actual tag values (tags are usually lowercase slugs)
// Note: Gamma API uses 'tag' parameter for filtering markets
const CATEGORY_MAP: Record<string, string | null> = {
  'all': null, // null means no category filter
  'crypto': 'crypto',
  'sports': 'sports',
  'tech': 'big-tech', // Polymarket uses 'big-tech' tag for tech markets
  'ai': 'artificial-intelligence', // Artificial Intelligence
  'politics': 'politics', // General politics
  'us-politics': 'uptspt-politics', // U.S. Politics specifically
  'geopolitics': 'geopolitics', // International relations and geopolitics
  'elections': 'elections', // Elections
  'us-election': 'us-presidential-election', // U.S. Presidential Election
  'economics': 'economy', // Economy and economic policy
  'business': 'business', // Business and companies
  'entertainment': 'pop-culture', // Entertainment and pop culture
  'movies': 'movies', // Movies
  'music': 'music', // Music
  'gaming': 'video-games', // Video games
  'nfl': 'nfl', // NFL football
  'nba': 'nba', // NBA basketball
  'mlb': 'mlb', // MLB baseball
  'soccer': 'soccer', // Soccer/football
  'nhl': 'nhl', // NHL hockey
  'f1': 'formula1', // Formula 1 racing
  'weather': 'weather', // Weather and natural disasters
  'health': 'health', // Health and medicine
  'covid': 'covid', // COVID-19
  'space': 'space', // Space and NASA
  'crypto-prices': 'crypto-prices', // Crypto prices
  'stocks': 'stocks', // Stocks and equities
  'commodities': 'commodities', // Commodities
  'climate': 'climate', // Climate and environment
  'legal': 'legal', // Legal and court cases
  'military': 'military-action', // Military actions
  'immigration': 'immigration', // Immigration
  'media': 'social-media', // Social media
  'trump': 'trump', // Trump-related
  'biden': 'biden', // Biden-related
  'ukraine': 'ukraine', // Ukraine conflict
  'israel': 'israel', // Israel-related
  'middle-east': 'middle-east', // Middle East
  'china': 'china', // China-related
  'russia': 'russia', // Russia-related
};

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

const SORT_OPTIONS = [
  { id: 'volume', label: '24hr Volume' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'new', label: 'New' },
  { id: 'ending', label: 'Ending Soon' },
];

// Available card types that can be created from a market
const MARKET_CARD_TYPES: Array<{ type: 'chart' | 'news' | 'resolution-criteria' | 'market-info'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'chart', label: 'Create Chart', icon: BarChart2 },
  { type: 'news', label: 'Open in News Card', icon: Newspaper },
  { type: 'resolution-criteria', label: 'View Resolution Criteria', icon: FileText },
  { type: 'market-info', label: 'View Market Info', icon: FileText },
];

function MarketDiscoveryCardComponent() {
  const { selectMarket } = useMarketStore();
  const { marketIds: watchlistIds, addToWatchlist, removeFromWatchlist, isInWatchlist, addEventToWatchlist, removeEventFromWatchlist, isEventInWatchlist } = useWatchlistStore();
  const { addCard, favouriteCardTypes, toggleFavouriteCardType, isFavouriteCardType } = useLayoutStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('volume');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [showMultiOutcomeOnly, setShowMultiOutcomeOnly] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Map our category ID to Polymarket's category value
  const polymarketCategory = CATEGORY_MAP[selectedCategory] || undefined;

  // Fetch markets with category filter (Gamma API uses 'tag' parameter)
  // The API will filter server-side, but we also do client-side filtering as fallback
  const { data: markets = [], isLoading, error, refetch } = useMarkets({
    active: selectedStatus === 'active',
    category: polymarketCategory || undefined, // Pass category to API (will be converted to 'tag' parameter)
    // No limit - fetch all markets
  });

  // Debug logging (only on first load or errors)
  useEffect(() => {
    if (error) {
      console.error('[MarketDiscoveryCard] Error loading markets:', error);
    }
    if (!isLoading && markets.length > 0) {
      const marketsWithImages = markets.filter(m => m.imageUrl);
      // Only log once when markets are first loaded
      if (marketsWithImages.length > 0 && markets.length === marketsWithImages.length) {
        console.log(`[MarketDiscoveryCard] ✅ All ${markets.length} markets have imageUrl`);
      }
    }
  }, [error, isLoading, markets.length]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group related markets together - memoize this expensive operation
  const groupRelatedMarkets = useCallback((marketsList: typeof markets) => {
    interface MarketGroup {
      baseQuestion: string;
      markets: typeof markets;
      category?: string;
      endDate?: string;
      imageUrl?: string; // Image for the group (from event or first market)
      eventId?: string; // Event ID for grouping
      eventImageUrl?: string; // Event image (preferred for multimarkets)
    }

    const groups: Record<string, MarketGroup> = {};
    const standalone: typeof marketsList = [];
    const eventGroups: Record<string, MarketGroup> = {}; // Group by eventId

    marketsList.forEach((market) => {
      // First, check if this market is part of an event
      // Markets from the same event should be grouped together
      // Note: A market with tokens > 2 is a single multimarket (one market with multiple outcomes),
      // so it should NOT be grouped with other markets - it should be standalone
      const isMultimarket = market.tokens && market.tokens.length > 2;
      const hasEventInfo = market.eventId && (market as any).eventTitle;
      
      // If it's a single multimarket (tokens > 2), don't group it - it's already complete
      if (isMultimarket) {
        standalone.push(market);
        return;
      }
      
      // If market is part of an event, group by eventId
      if (hasEventInfo) {
        const eventKey = `event:${market.eventId}`;
        
        if (!eventGroups[eventKey]) {
          // Use event title as base question, or extract from first market
          const eventTitle = (market as any).eventTitle;
          let baseQuestion = eventTitle || market.question;
          
          // If event title is not available, try to extract from market question
          if (!baseQuestion) {
            const question = market.question || '';
            const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
            const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
            
            let match = question.match(winPattern);
            let isWinQuestion = true;
            
            if (!match) {
              match = question.match(bePattern);
              isWinQuestion = false;
            }
            
            if (match && match.length >= 3) {
              const eventPart = match[2].trim();
              baseQuestion = isWinQuestion 
                ? `Who will win ${eventPart}?`
                : `Who will be ${eventPart}?`;
            } else {
              // Fallback: use question pattern for "Who will" questions
              if (question.toLowerCase().startsWith('who will')) {
                baseQuestion = question;
              } else {
                // Extract base from question like "Will X win Y?" -> "Who will win Y?"
                const parts = question.split('?')[0].split(/\s+(?:win|be)\s+/i);
                if (parts.length >= 2) {
                  baseQuestion = `Who will ${question.toLowerCase().includes('win') ? 'win' : 'be'} ${parts.slice(1).join(' ')}?`;
                } else {
                  baseQuestion = question;
                }
              }
            }
          }
          
          eventGroups[eventKey] = {
            baseQuestion,
            markets: [],
            category: market.category,
            endDate: market.endDate,
            // For group header, prioritize event image (correct logo/seal) over individual market images
            imageUrl: (market as any).eventImageUrl || undefined, // Use event image first
            eventId: market.eventId,
            eventImageUrl: (market as any).eventImageUrl,
          };
        }
        
        // Extract option name from market question
        const question = market.question || '';
        const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
        const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
        
        let match = question.match(winPattern);
        if (!match) {
          match = question.match(bePattern);
        }
        
        const optionName = match && match.length >= 3 ? match[1].trim() : (question.split('?')[0] || question);
        
        eventGroups[eventKey].markets.push({
          ...market,
          optionName, // Store the extracted option name
        } as any);
        
        // Always use event image for group header (not individual market images)
        // This ensures the group shows the correct event logo/seal
        if ((market as any).eventImageUrl) {
          if (!eventGroups[eventKey].eventImageUrl) {
            eventGroups[eventKey].eventImageUrl = (market as any).eventImageUrl;
          }
          // Always prioritize event image over individual market images for group header
          eventGroups[eventKey].imageUrl = (market as any).eventImageUrl;
        }
        
        return; // Skip pattern matching for event-grouped markets
      }
      
      // Fallback: Pattern matching for markets without eventId
      const question = market.question || '';
      
      // Pattern: "Will [NAME] win [EVENT]?" or "Will [NAME] be [EVENT]?"
      // Extract the base question and the option/candidate name
      const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
      const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
      
      let match = question.match(winPattern);
      let isWinQuestion = true;
      
      if (!match) {
        match = question.match(bePattern);
        isWinQuestion = false;
      }
      
      if (match && match.length >= 3) {
        const optionName = match[1].trim();
        const eventPart = match[2].trim();
        
        // Create base question: "Who will win [EVENT]?" or "Who will be [EVENT]?"
        const baseQuestion = isWinQuestion 
          ? `Who will win ${eventPart}?`
          : `Who will be ${eventPart}?`;
        
        // Use a key that includes category and end date to group only truly related markets
        const key = `${baseQuestion}|${market.category || ''}|${market.endDate || ''}`;
        
        if (!groups[key]) {
          groups[key] = {
            baseQuestion,
            markets: [],
            category: market.category,
            endDate: market.endDate,
            imageUrl: market.imageUrl, // Store imageUrl from first market in group
          };
        }
        
        // If group doesn't have an imageUrl yet, use this market's imageUrl if it has one
        if (!groups[key].imageUrl && market.imageUrl) {
          groups[key].imageUrl = market.imageUrl;
        }
        
        groups[key].markets.push({
          ...market,
          optionName, // Store the extracted option name
        } as any);
      } else {
        // Market doesn't match the pattern, keep as standalone
        standalone.push(market);
      }
    });

    // Filter groups to only include those with 2+ markets (meaningful grouping)
    const groupedResults: Array<{ type: 'group'; group: MarketGroup; key: string } | { type: 'standalone'; market: typeof marketsList[0] }> = [];
    
    // Process event groups first (these are actual multimarkets)
    Object.entries(eventGroups).forEach(([key, group]) => {
      if (group.markets.length >= 2) {
        // Sort by probability descending
        group.markets.sort((a, b) => {
          const probA = (a.outcomePrices?.YES || 0) * 100;
          const probB = (b.outcomePrices?.YES || 0) * 100;
          return probB - probA;
        });
        
        // For event groups, always use event image for the group header (not individual market images)
        // This ensures the group shows the correct event logo/seal (e.g., President seal, company logo)
        if (group.eventImageUrl) {
          group.imageUrl = group.eventImageUrl;
        } else if (!group.imageUrl && group.markets.length > 0) {
          // Only fall back to a market image if no event image exists
          // But prefer markets with actual images over generic ones
          const marketWithImage = group.markets.find((m: any) => m.imageUrl && 
            !m.imageUrl.includes('placeholder') && 
            !m.imageUrl.includes('default'));
          if (marketWithImage) {
            group.imageUrl = marketWithImage.imageUrl;
          }
        }
        
        groupedResults.push({ type: 'group', group, key });
      } else {
        // Single market in event group, treat as standalone
        standalone.push(group.markets[0]);
      }
    });
    
    // Process pattern-matched groups
    Object.entries(groups).forEach(([key, group]) => {
      // Skip if already in event group
      const alreadyInEventGroup = groupedResults.some(
        (item) => item.type === 'group' && item.group.markets.some((m: any) => 
          group.markets.some((gm: any) => gm.id === m.id)
        )
      );
      
      if (alreadyInEventGroup) {
        return; // Skip - already grouped by event
      }
      
      if (group.markets.length >= 2) {
        // Sort by probability descending
        group.markets.sort((a, b) => {
          const probA = (a.outcomePrices?.YES || 0) * 100;
          const probB = (b.outcomePrices?.YES || 0) * 100;
          return probB - probA;
        });
        groupedResults.push({ type: 'group', group, key });
      } else {
        // Single market in group, treat as standalone
        standalone.push(group.markets[0]);
      }
    });

    // Add standalone markets (only if not already in a group)
    standalone.forEach((market) => {
      const alreadyGrouped = groupedResults.some(
        (item) => item.type === 'group' && item.group.markets.some((m: any) => m.id === market.id)
      );
      
      if (!alreadyGrouped) {
        groupedResults.push({ type: 'standalone', market });
      }
    });

    return groupedResults;
  }, []);

  const filteredAndSortedMarkets = useMemo(() => {
    let filtered = [...markets];
    
    // Smarter filtering: Group markets by event and detect outcome tokens based on event structure
    // Outcome tokens typically have:
    // 1. Generic names (Company X, Movie X, Person X, "another X", etc.)
    // 2. Part of an event with many markets (10+ markets)
    // 3. Similar metadata (same end date, low/no volume, 50% probability)
    
    // First, group markets by eventId to analyze event structure
    const marketsByEvent: Record<string, typeof markets> = {};
    filtered.forEach((market) => {
      if (market.eventId) {
        if (!marketsByEvent[market.eventId]) {
          marketsByEvent[market.eventId] = [];
        }
        marketsByEvent[market.eventId].push(market);
      }
    });
    
    // Detect generic outcome patterns (more comprehensive)
    const isGenericOutcome = (question: string): boolean => {
      if (!question) return false;
      const q = question.trim();
      
      // Pattern: Generic names like "Company X", "Movie X", "Person X", "Team X", etc.
      const genericPattern = /^(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s*$/i;
      if (genericPattern.test(q)) return true;
      
      // Pattern: With question mark
      const genericWithQ = /^(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s*\?$/i;
      if (genericWithQ.test(q)) return true;
      
      // Pattern: "Will [Generic] X win..." or "Will [Generic] X be..."
      const willGenericPattern = /^Will\s+(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s+(?:win|be)/i;
      if (willGenericPattern.test(q)) return true;
      
      // Pattern: "another X"
      if (/^another\s+(?:company|movie|person|team|player|candidate|option|outcome|choice)/i.test(q)) return true;
      
      // Pattern: "someone else", "someone", "other", "others", etc. - generic placeholder outcomes
      if (/^(?:someone\s+else|someone|other|others|none|other\s+option|other\s+choice)$/i.test(q)) return true;
      
      return false;
    };
    
    // Filter out outcome tokens based on event structure
    filtered = filtered.filter((market) => {
      // If market has generic name pattern, check if it's part of an event
      if (market.eventId && isGenericOutcome(market.question || '')) {
        const eventMarkets = marketsByEvent[market.eventId] || [];
        
        // If event has 3+ markets (multimarket), and this is a generic outcome, filter it out
        // Generic outcomes like "Person A", "someone else" should not be shown as standalone markets
        // Only keep them if they have significant trading activity (real markets)
        if (eventMarkets.length >= 3) {
          // Check for any trading activity - if no volume/liquidity, it's an outcome token
          const hasAnyVolume = market.volume && market.volume > 0;
          const hasAnyLiquidity = market.liquidity && market.liquidity > 0;
          
          // If it's a generic outcome with no volume/liquidity, filter it out
          // This catches "Person A", "Person B", "someone else", etc. in multimarkets
          if (!hasAnyVolume && !hasAnyLiquidity) {
            return false; // Filter out - likely an outcome token
          }
          
          // Even if it has some volume, if it's very low (< $100) and it's a generic outcome in a multimarket, filter it
          // Real markets in multimarkets typically have more activity
          const hasVeryLowVolume = market.volume && market.volume > 0 && market.volume < 100;
          const hasVeryLowLiquidity = market.liquidity && market.liquidity > 0 && market.liquidity < 10;
          
          if (hasVeryLowVolume && hasVeryLowLiquidity) {
            return false; // Filter out - likely an outcome token with minimal activity
          }
        }
      }
      
      // Also filter generic outcomes even if not part of an event (standalone generic outcomes)
      if (!market.eventId && isGenericOutcome(market.question || '')) {
        // If it has no volume/liquidity and is a generic outcome, likely filter it out
        const hasAnyVolume = market.volume && market.volume > 0;
        const hasAnyLiquidity = market.liquidity && market.liquidity > 0;
        
        if (!hasAnyVolume && !hasAnyLiquidity) {
          return false; // Filter out - likely an outcome token
        }
      }
      
      return true; // Keep the market
    });

    // ALWAYS filter by category client-side (Gamma API doesn't support category filtering properly)
    if (selectedCategory !== 'all' && polymarketCategory) {
      // Debug: Log sample categories to understand what we're working with
      if (markets.length > 0 && markets[0]) {
        const sampleCategories = [...new Set(markets.slice(0, 20).map(m => m.category).filter(Boolean))];
        console.log(`[MarketDiscovery] Sample categories in markets:`, sampleCategories);
      }

      filtered = filtered.filter((market) => {
        const marketCategory = market.category?.trim();
        if (!marketCategory) return false;
        
        // Match case-insensitively, handle variations like "Pop-Culture " with trailing space
        const normalizedMarketCat = marketCategory.toLowerCase();
        const normalizedFilterCat = polymarketCategory.toLowerCase();
        
        // More flexible matching: exact match, starts with, or contains
        const match = normalizedMarketCat === normalizedFilterCat || 
                     normalizedMarketCat.startsWith(normalizedFilterCat) ||
                     normalizedFilterCat.startsWith(normalizedMarketCat) ||
                     normalizedMarketCat.includes(normalizedFilterCat) ||
                     normalizedFilterCat.includes(normalizedMarketCat);
        return match;
      });
      console.log(`[MarketDiscovery] Filtered ${markets.length} → ${filtered.length} markets for category "${polymarketCategory}" (filter: "${selectedCategory}")`);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((market) =>
        market.question?.toLowerCase().includes(query) ||
        market.slug?.toLowerCase().includes(query) ||
        market.category?.toLowerCase().includes(query)
      );
    }
    
    // Filter by multi-outcome markets only
    if (showMultiOutcomeOnly) {
      const beforeCount = filtered.length;
      filtered = filtered.filter((market) => {
        // Check if market has multiple outcomes - try multiple detection methods
        // Method 1: Check tokens array (most reliable)
        if (market.tokens && market.tokens.length > 2) {
          return true;
        }
        
        // Method 2: Check clobTokenIds array
        if (market.clobTokenIds && market.clobTokenIds.length > 2) {
          return true;
        }
        
        // Method 3: Check question pattern - "Who will" questions are often multi-outcome
        const question = market.question?.toLowerCase() || '';
        if (question.startsWith('who will') || question.startsWith('who will be')) {
          return true;
        }
        
        // Method 4: Check if question suggests multiple options (contains "top", "largest", "best", "champion", "winner" with "who")
        const multiOutcomeKeywords = ['who will win', 'who will be', 'who will have', 'top grossing', 'largest company', 'drivers champion', 'mvp', 'cy young'];
        if (multiOutcomeKeywords.some(keyword => question.includes(keyword))) {
          return true;
        }
        
        return false;
      });
      const afterCount = filtered.length;
      if (beforeCount > 0 && afterCount === 0) {
        console.log(`[MarketDiscovery] Multi-outcome filter: ${beforeCount} markets before, ${afterCount} after. Sample markets:`, 
          markets.slice(0, 5).map(m => ({ 
            id: m.id?.substring(0, 20), 
            question: m.question?.substring(0, 50),
            tokensCount: m.tokens?.length || 0,
            clobTokenIdsCount: m.clobTokenIds?.length || 0,
            hasTokens: !!m.tokens,
            hasClobTokenIds: !!m.clobTokenIds
          }))
        );
      }
    }

    // Sort markets
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume || 0) - (a.volume || 0);
        case 'liquidity':
          return (b.liquidity || 0) - (a.liquidity || 0);
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
  }, [markets, searchQuery, sortBy, selectedCategory, polymarketCategory, showMultiOutcomeOnly]);

  // Group related markets after filtering and sorting - memoize this expensive operation
  const groupedMarkets = useMemo(() => {
    return groupRelatedMarkets(filteredAndSortedMarkets);
  }, [filteredAndSortedMarkets, groupRelatedMarkets]);

  const handleSelectMarket = (marketId: string) => {
    selectMarket(marketId);
  };

  // Helper function to detect if a market is multi-outcome
  const isMultiOutcomeMarket = (market: typeof markets[0]): boolean => {
    // Check tokens array
    if (market.tokens && market.tokens.length > 2) {
      return true;
    }
    
    // Check clobTokenIds array
    if (market.clobTokenIds && market.clobTokenIds.length > 2) {
      return true;
    }
    
    // Check question pattern
    const question = market.question?.toLowerCase() || '';
    if (question.startsWith('who will') || question.startsWith('who will be')) {
      return true;
    }
    
    // Check keywords
    const multiOutcomeKeywords = ['who will win', 'who will be', 'who will have', 'top grossing', 'largest company', 'drivers champion', 'mvp', 'cy young'];
    if (multiOutcomeKeywords.some(keyword => question.includes(keyword))) {
      return true;
    }
    
    return false;
  };

  // Handler to add market to chart
  const handleAddToChart = (marketId: string) => {
    addCard({
      id: `chart-${Date.now()}`,
      type: 'chart',
      props: { marketId },
    });
  };

  const formatVolume = (volume: number | undefined) => {
    if (!volume) return '$0';
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(2)}`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-2 sm:p-3 border-b border-border space-y-2">
        <div className="text-xs sm:text-sm font-semibold">Market Discovery</div>
        
        {/* Search and Category Filter */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 sm:pl-8 h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>
          
          {/* Multi-Outcome Filter Toggle */}
          <Button
            variant={showMultiOutcomeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMultiOutcomeOnly(!showMultiOutcomeOnly)}
            className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm flex-shrink-0"
            title={showMultiOutcomeOnly ? "Show all markets" : "Show only multi-outcome markets"}
          >
            <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
            <span className="hidden sm:inline">Multi</span>
          </Button>
          
          {/* Category Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm flex-shrink-0"
              >
                <span className="mr-1.5">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'All'}
                </span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 max-h-[400px] overflow-y-auto">
              <DropdownMenuItem
                onClick={() => setSelectedCategory('all')}
                className={selectedCategory === 'all' ? 'bg-accent' : ''}
              >
                <span className="text-xs">All Categories</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              
              {/* Group categories by type */}
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Finance
                </div>
                {CATEGORIES.filter((c) => ['crypto', 'stocks', 'economics', 'business', 'crypto-prices', 'commodities'].includes(c.id)).map((cat) => (
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Sports
                </div>
                {CATEGORIES.filter((c) => ['sports', 'nfl', 'nba', 'soccer', 'mlb', 'nhl', 'f1'].includes(c.id)).map((cat) => (
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
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
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
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
        </div>

        {/* Sort and Status */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-stretch sm:items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 border border-border rounded bg-background flex-1 sm:flex-none min-w-0 touch-manipulation"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Sort by: {opt.label}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 border border-border rounded bg-background flex-1 sm:flex-none min-w-0 touch-manipulation"
          >
            <option value="active">Status: Active</option>
            <option value="all">Status: All</option>
          </select>
        </div>
      </div>

      {/* Market List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 sm:h-48">
            <LoadingSpinner size="sm" text="Loading markets..." />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 sm:h-48 gap-3 text-center px-4">
            <div className="text-xs sm:text-sm text-destructive font-medium">
              Failed to load markets
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="text-xs h-7 sm:h-8"
            >
              Retry
            </Button>
          </div>
        ) : groupedMarkets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 sm:h-48 gap-2 text-center px-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery ? 'No markets found matching your search' : markets.length === 0 ? 'No markets available' : 'No markets match the selected filters'}
            </div>
            {markets.length === 0 && !isLoading && (
              <div className="text-[10px] text-muted-foreground/70">
                This might be a temporary API issue. Try again later.
              </div>
            )}
          </div>
        ) : (
          groupedMarkets.map((item) => {
            if (item.type === 'group') {
              const { group, key } = item;
              const isExpanded = expandedGroups.has(key);
              const totalVolume = group.markets.reduce((sum, m) => sum + (m.volume || 0), 0);
              const totalLiquidity = group.markets.reduce((sum, m) => sum + (m.liquidity || 0), 0);
              
              // Format date (use first market's end date)
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

              // Check if event is in watchlist
              const eventId = group.eventId;
              const eventInWatchlist = eventId ? isEventInWatchlist(eventId) : false;

              // Handler to add all markets in this group to a chart
              const handleAddToChart = () => {
                const marketIds = group.markets.map(m => m.id);
                addCard({
                  id: `chart-${Date.now()}`,
                  type: 'chart',
                  props: { marketIds },
                });
              };

              return (
                <div key={key} className="bg-card">
                  {/* Group Header */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        draggable
                        onDragStart={(e) => {
                          const marketIds = group.markets.map(m => m.id);
                          // Set both eventId (if available) and marketIds for multimarket drag
                          if (eventId) {
                            e.dataTransfer.setData('eventId', eventId);
                          }
                          e.dataTransfer.setData('marketIds', JSON.stringify(marketIds));
                          e.dataTransfer.setData('marketQuestion', group.baseQuestion || '');
                          e.dataTransfer.effectAllowed = 'move';
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.style.opacity = '0.5';
                          }
                          // Mark that we're dragging
                          (e.currentTarget as HTMLElement).setAttribute('data-dragging', 'true');
                        }}
                        onDragEnd={(e) => {
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.style.opacity = '1';
                          }
                        }}
                        onClick={() => {
                          const newExpanded = new Set(expandedGroups);
                          if (isExpanded) {
                            newExpanded.delete(key);
                          } else {
                            newExpanded.add(key);
                          }
                          setExpandedGroups(newExpanded);
                        }}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-accent/50 active:bg-accent cursor-pointer transition-colors group cursor-move touch-manipulation"
                      >
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      {group.imageUrl && !imageErrors.has(key) && (
                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                          <img
                            src={group.imageUrl}
                            alt={group.baseQuestion}
                            draggable="false"
                            className="w-full h-full object-cover"
                            onError={() => {
                              setImageErrors(prev => new Set([...prev, key]));
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] sm:text-xs font-semibold leading-tight mb-0.5">
                            {group.baseQuestion}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                            {group.category && (
                              <span className="flex items-center gap-1 capitalize font-medium">
                                <Tag className="h-2.5 w-2.5 opacity-70" />
                                <span>{group.category}</span>
                              </span>
                            )}
                            {formatDate(group.endDate) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5 opacity-70" />
                                <span className="opacity-70">Ends:</span>
                                <span className="font-semibold">{formatDate(group.endDate)}</span>
                              </span>
                            )}
                            {totalVolume > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-2.5 w-2.5 opacity-70" />
                                <span className="opacity-70">Vol:</span>
                                <span className="font-semibold">{formatVolume(totalVolume)}</span>
                              </span>
                            )}
                            {totalLiquidity > 0 && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-2.5 w-2.5 opacity-70" />
                                <span className="opacity-70">Liq:</span>
                                <span className="font-semibold">{formatVolume(totalLiquidity)}</span>
                              </span>
                            )}
                            <span className="text-muted-foreground/70">
                              {group.markets.length} options
                            </span>
                          </div>
                        </div>
                      </div>
                      {eventId && (
                        <div className="flex items-center justify-center flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-5 w-5 sm:h-6 sm:w-6 p-0 touch-manipulation ${eventInWatchlist ? 'text-green-500' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (eventInWatchlist) {
                                removeEventFromWatchlist(eventId);
                              } else {
                                addEventToWatchlist(eventId);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            draggable={false}
                            title={eventInWatchlist ? 'Remove multimarket from watchlist' : 'Add multimarket to watchlist'}
                          >
                            {eventInWatchlist ? (
                              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            ) : (
                              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToChart();
                        }}
                        className="cursor-pointer"
                      >
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Add to Chart
                      </ContextMenuItem>
                      {eventId && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (eventInWatchlist) {
                                removeEventFromWatchlist(eventId);
                              } else {
                                addEventToWatchlist(eventId);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {eventInWatchlist ? (
                              <>
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                                Remove from Watchlist
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add to Watchlist
                              </>
                            )}
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Grouped Markets */}
                  {isExpanded && (
                    <div>
                      {group.markets.map((market) => {
                        const probability = (market.outcomePrices?.YES || 0) * 100;
                        const volume = market.volume || 0;
                        const liquidity = market.liquidity || 0;
                        const price = market.outcomePrices?.YES || 0;
                        const optionName = (market as any).optionName || '';
                        
                        // Format date (same as standalone)
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

                        const handleCreateChart = () => {
                          addCard({
                            id: `chart-${Date.now()}`,
                            type: 'chart',
                            props: { marketId: market.id },
                          });
                        };

                        const handleCreateNews = () => {
                          addCard({
                            id: `news-${Date.now()}`,
                            type: 'news',
                            props: { marketId: market.id },
                          });
                        };

                        const handleCreateResolutionCriteria = () => {
                          addCard({
                            id: `resolution-criteria-${Date.now()}`,
                            type: 'resolution-criteria',
                            props: { marketId: market.id },
                          });
                        };

                        const handleCreateMarketInfo = () => {
                          addCard({
                            id: `market-info-${Date.now()}`,
                            type: 'market-info',
                            props: { marketId: market.id },
                          });
                        };

                        return (
                          <ContextMenu key={market.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('marketId', market.id);
                                  e.dataTransfer.setData('marketQuestion', market.question || '');
                                  e.dataTransfer.effectAllowed = 'move';
                                  if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.style.opacity = '0.5';
                                  }
                                  // Mark that we're dragging
                                  (e.currentTarget as HTMLElement).setAttribute('data-dragging', 'true');
                                }}
                                onDragEnd={(e) => {
                                  if (e.currentTarget instanceof HTMLElement) {
                                    e.currentTarget.style.opacity = '1';
                                  }
                                }}
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-accent/50 active:bg-accent cursor-move transition-colors"
                              >
                            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                              {market.imageUrl && !imageErrors.has(market.id) && (
                                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                                  <img
                                    src={market.imageUrl}
                                    alt={optionName}
                                    draggable="false"
                                    className="w-full h-full object-cover"
                                    onError={() => {
                                      setImageErrors(prev => new Set([...prev, market.id]));
                                    }}
                                  />
                                </div>
                              )}
                              <div
                                className="flex-1 min-w-0 pr-1 cursor-pointer"
                                onClick={() => handleSelectMarket(market.id)}
                              >
                                <div className="text-[11px] sm:text-xs font-medium leading-tight mb-1 line-clamp-2">
                                  {optionName || market.question}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                                  {market.category && (
                                    <span className="flex items-center gap-1 capitalize font-medium">
                                      <Tag className="h-2.5 w-2.5 opacity-70" />
                                      <span>{market.category}</span>
                                    </span>
                                  )}
                                  {formatDate(market.endDate) && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-2.5 w-2.5 opacity-70" />
                                      <span className="opacity-70">Ends:</span>
                                      <span className="font-semibold">{formatDate(market.endDate)}</span>
                                    </span>
                                  )}
                                  {volume > 0 && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="h-2.5 w-2.5 opacity-70" />
                                      <span className="opacity-70">Vol:</span>
                                      <span className="font-semibold">{formatVolume(volume)}</span>
                                    </span>
                                  )}
                                  {liquidity > 0 && (
                                    <span className="flex items-center gap-1">
                                      <BarChart3 className="h-2.5 w-2.5 opacity-70" />
                                      <span className="opacity-70">Liq:</span>
                                      <span className="font-semibold">{formatVolume(liquidity)}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[80px]">
                                <div className="flex items-center justify-end gap-1">
                                  {probability > 50 ? (
                                    <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
                                  )}
                                  <span 
                                    className="text-[11px] sm:text-xs font-semibold"
                                    style={{ color: probability > 50 ? '#10b981' : '#ef4444' }}
                                  >
                                    {probability.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-end gap-1 text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                                  <DollarSign className="h-2.5 w-2.5 opacity-70" />
                                  <span>${price.toFixed(3)}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-center flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-5 w-5 sm:h-6 sm:w-6 p-0 touch-manipulation ${isInWatchlist(market.id) ? 'text-green-500' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isInWatchlist(market.id)) {
                                      removeFromWatchlist(market.id);
                                    } else {
                                      addToWatchlist(market.id);
                                    }
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onDragStart={(e) => e.stopPropagation()}
                                  title={isInWatchlist(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                                >
                                  {isInWatchlist(market.id) ? (
                                    <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  ) : (
                                    <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              {/* Favourite card types first */}
                              {favouriteCardTypes.length > 0 && MARKET_CARD_TYPES.filter(({ type }) => isFavouriteCardType(type)).length > 0 && (
                                <>
                                  {MARKET_CARD_TYPES
                                    .filter(({ type }) => isFavouriteCardType(type))
                                    .map(({ type, label, icon: Icon }) => {
                                      const handleCreate = () => {
                                        addCard({
                                          id: `${type}-${Date.now()}`,
                                          type: type as any,
                                          props: { marketId: market.id },
                                        });
                                      };
                                      return (
                                        <ContextMenuItem
                                          key={type}
                                          onClick={handleCreate}
                                          className="cursor-pointer"
                                        >
                                          <Icon className="h-4 w-4 mr-2" />
                                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                          {label}
                                        </ContextMenuItem>
                                      );
                                    })}
                                  {favouriteCardTypes.length > 0 && MARKET_CARD_TYPES.some(({ type }) => !isFavouriteCardType(type)) && (
                                    <ContextMenuSeparator />
                                  )}
                                </>
                              )}
                              {/* All other card types */}
                              {MARKET_CARD_TYPES
                                .filter(({ type }) => !isFavouriteCardType(type))
                                .map(({ type, label, icon: Icon }) => {
                                  const handleCreate = () => {
                                    addCard({
                                      id: `${type}-${Date.now()}`,
                                      type: type as any,
                                      props: { marketId: market.id },
                                    });
                                  };
                                  return (
                                    <ContextMenuItem
                                      key={type}
                                      onClick={handleCreate}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleFavouriteCardType(type as any);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Icon className="h-4 w-4 mr-2" />
                                      {label}
                                    </ContextMenuItem>
                                  );
                                })}
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isInWatchlist(market.id)) {
                                    removeFromWatchlist(market.id);
                                  } else {
                                    addToWatchlist(market.id);
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                {isInWatchlist(market.id) ? (
                                  <>
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                    Remove from Watchlist
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add to Watchlist
                                  </>
                                )}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Standalone market
            const market = item.market;
            const probability = (market.outcomePrices?.YES || 0) * 100;
            const volume = market.volume || 0;
            const liquidity = market.liquidity || 0;
            const price = market.outcomePrices?.YES || 0;
            
            // Format date
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

            const handleCreateChart = () => {
              addCard({
                id: `chart-${Date.now()}`,
                type: 'chart',
                props: { marketId: market.id },
              });
            };

            const handleCreateNews = () => {
              addCard({
                id: `news-${Date.now()}`,
                type: 'news',
                props: { marketId: market.id },
              });
            };

            const handleCreateResolutionCriteria = () => {
              addCard({
                id: `resolution-criteria-${Date.now()}`,
                type: 'resolution-criteria',
                props: { marketId: market.id },
              });
            };

            const handleCreateMarketInfo = () => {
              addCard({
                id: `market-info-${Date.now()}`,
                type: 'market-info',
                props: { marketId: market.id },
              });
            };
            
            return (
              <ContextMenu key={market.id}>
                <ContextMenuTrigger asChild>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('marketId', market.id);
                      e.dataTransfer.setData('marketQuestion', market.question || '');
                      e.dataTransfer.effectAllowed = 'move';
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = '0.5';
                      }
                      // Mark that we're dragging
                      (e.currentTarget as HTMLElement).setAttribute('data-dragging', 'true');
                    }}
                    onDragEnd={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-accent/50 active:bg-accent text-left transition-colors cursor-move touch-manipulation"
                  >
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  {market.imageUrl && !imageErrors.has(market.id) && (
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 overflow-hidden border border-border bg-accent/20">
                      <img
                        src={market.imageUrl}
                        alt={market.question}
                        draggable="false"
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageErrors(prev => new Set([...prev, market.id]));
                        }}
                      />
                    </div>
                  )}
                  <div
                    className="flex-1 min-w-0 pr-1 cursor-pointer"
                    onClick={() => handleSelectMarket(market.id)}
                  >
                    <div className="text-[11px] sm:text-xs font-medium leading-tight mb-1 line-clamp-2">
                      {market.question}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                      {market.category && (
                        <span className="flex items-center gap-1 capitalize font-medium">
                          <Tag className="h-2.5 w-2.5 opacity-70" />
                          <span>{market.category}</span>
                        </span>
                      )}
                      {formatDate(market.endDate) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5 opacity-70" />
                          <span className="opacity-70">Ends:</span>
                          <span className="font-semibold">{formatDate(market.endDate)}</span>
                        </span>
                      )}
                      {volume > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-2.5 w-2.5 opacity-70" />
                          <span className="opacity-70">Vol:</span>
                          <span className="font-semibold">{formatVolume(volume)}</span>
                        </span>
                      )}
                      {liquidity > 0 && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-2.5 w-2.5 opacity-70" />
                          <span className="opacity-70">Liq:</span>
                          <span className="font-semibold">{formatVolume(liquidity)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[80px]">
                    <div className="flex items-center justify-end gap-1">
                      {probability > 50 ? (
                        <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
                      )}
                      <span 
                        className="text-[11px] sm:text-xs font-semibold"
                        style={{ color: probability > 50 ? '#10b981' : '#ef4444' }}
                      >
                        {probability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                      <DollarSign className="h-2.5 w-2.5 opacity-70" />
                      <span>${price.toFixed(3)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-5 w-5 sm:h-6 sm:w-6 p-0 touch-manipulation ${isInWatchlist(market.id) ? 'text-green-500' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInWatchlist(market.id)) {
                          removeFromWatchlist(market.id);
                        } else {
                          addToWatchlist(market.id);
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.stopPropagation()}
                      title={isInWatchlist(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      {isInWatchlist(market.id) ? (
                        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      ) : (
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                  {/* Favourite card types first */}
                  {favouriteCardTypes.length > 0 && MARKET_CARD_TYPES.filter(({ type }) => isFavouriteCardType(type)).length > 0 && (
                    <>
                      {MARKET_CARD_TYPES
                        .filter(({ type }) => isFavouriteCardType(type))
                        .map(({ type, label, icon: Icon }) => {
                          const handleCreate = () => {
                            addCard({
                              id: `${type}-${Date.now()}`,
                              type: type as any,
                              props: { marketId: market.id },
                            });
                          };
                          return (
                            <ContextMenuItem
                              key={type}
                              onClick={handleCreate}
                              className="cursor-pointer"
                            >
                              <Icon className="h-4 w-4 mr-2" />
                              <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                              {label}
                            </ContextMenuItem>
                          );
                        })}
                      {favouriteCardTypes.length > 0 && MARKET_CARD_TYPES.some(({ type }) => !isFavouriteCardType(type)) && (
                        <ContextMenuSeparator />
                      )}
                    </>
                  )}
                  {/* All other card types */}
                  {MARKET_CARD_TYPES
                    .filter(({ type }) => !isFavouriteCardType(type))
                    .map(({ type, label, icon: Icon }) => {
                      const handleCreate = () => {
                        addCard({
                          id: `${type}-${Date.now()}`,
                          type: type as any,
                          props: { marketId: market.id },
                        });
                      };
                      return (
                        <ContextMenuItem
                          key={type}
                          onClick={handleCreate}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavouriteCardType(type as any);
                          }}
                          className="cursor-pointer"
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {label}
                        </ContextMenuItem>
                      );
                    })}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInWatchlist(market.id)) {
                        removeFromWatchlist(market.id);
                      } else {
                        addToWatchlist(market.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {isInWatchlist(market.id) ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        Remove from Watchlist
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Watchlist
                      </>
                    )}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const MarketDiscoveryCard = React.memo(MarketDiscoveryCardComponent);

