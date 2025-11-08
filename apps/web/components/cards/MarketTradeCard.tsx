'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMarket, useMarketPrice, useOrderBook, useHistoricalPrices, useMarkets, useTrades } from '@/lib/hooks/usePolymarketData';
import { useClobAuth } from '@/lib/hooks/useClobAuth';
import { usePrivy } from '@privy-io/react-auth';
import { useTrading } from '@/lib/web3/trading';
import { parseUnits, formatUnits } from 'viem';
import { Address } from 'viem';
import { Loader2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Search, TrendingUp, TrendingDown, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketSelector } from '@/components/MarketSelector';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
import { convertHistoricalPricesToLightweight, chartColors } from '@/lib/charts/utils';
import { cn } from '@/lib/utils';
import CommentsCard from '@/components/cards/CommentsCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CardMarketContext } from '@/components/layout/Card';
import { useToast } from '@/components/Toast';

interface MarketTradeCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

type TabType = 'all' | 'market-info' | 'traders';
type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

interface OrderBookRow {
  price: number;
  size: number;
  dollars: number;
}

function MarketTradeCardComponent({ marketId: propMarketId, onMarketChange }: MarketTradeCardProps = {}) {
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const { user, authenticated } = usePrivy();
  const { getAuthParams, requestAuth, isSigning, hasAuth, isReady } = useClobAuth();
  const { buy, sell } = useTrading();
  const { setMarketQuestion } = React.useContext(CardMarketContext);
  const { error: showErrorToast } = useToast();
  
  const [authParams, setAuthParams] = useState<{ walletClient: any; address: Address } | null>(null);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>('YES'); // Support any outcome name, not just YES/NO
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [showRules, setShowRules] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellAmount, setSellAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'multimarket'>('single'); // 'single' or 'multimarket'
  const [selectedMarketInEvent, setSelectedMarketInEvent] = useState<string | null>(null); // Selected market when viewing event
  
  // Reset view mode and selected market when market ID changes
  React.useEffect(() => {
    setViewMode('single');
    setSelectedMarketInEvent(null);
    setSelectedOutcome('YES'); // Reset to YES, will be updated when market data loads
  }, [effectiveMarketId]);

  // Auto-get auth params when wallet is authenticated
  React.useEffect(() => {
    if (authenticated && hasAuth && !authParams && !isSigning) {
      const timeoutId = setTimeout(() => {
        getAuthParams().then(params => {
          if (params) {
            setAuthParams(params);
          }
        }).catch(err => {
          console.error('[MarketTradeCard] Failed to get auth params:', err);
        });
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [authenticated, hasAuth, authParams, isSigning, getAuthParams]);

  // Fetch all markets to detect event groups
  const { data: allMarkets = [], isLoading: isLoadingAllMarkets } = useMarkets({ active: true });
  
  // Fetch market data
  const { data: marketFromHook, isLoading: isLoadingMarket } = useMarket(effectiveMarketId || null);
  const { data: currentPrice } = useMarketPrice(effectiveMarketId || null);
  
  // Use market from allMarkets if available (has eventId/eventTitle), otherwise fall back to marketFromHook
  // This ensures we have the full market data with eventId populated
  const market = React.useMemo(() => {
    if (!effectiveMarketId) return null;
    // First, try to find market in allMarkets (has eventId/eventTitle populated)
    const marketFromAllMarkets = allMarkets.find(m => m.id === effectiveMarketId);
    if (marketFromAllMarkets) return marketFromAllMarkets;
    // Fall back to market from useMarket hook
    return marketFromHook || null;
  }, [effectiveMarketId, allMarkets, marketFromHook]);
  
  // Reset selected outcome when market data loads (for multi-outcome markets)
  React.useEffect(() => {
    if (market?.tokens && market.tokens.length > 2) {
      // For multi-outcome markets, default to first outcome
      const firstOutcome = market.tokens[0]?.outcome;
      if (firstOutcome && selectedOutcome === 'YES') {
        // Only update if still on default YES (to avoid overriding user selection)
        setSelectedOutcome(firstOutcome);
      }
    } else if (market && !market.tokens) {
      // For YES/NO markets, ensure YES is selected
      setSelectedOutcome('YES');
    }
  }, [market?.tokens, market?.id]);
  
  // Helper function to extract market title/name from question
  // When market is part of an event, removes event context to show just the distinguishing part
  const extractOptionName = useCallback((question: string, eventTitle?: string): string => {
    if (!question) return '';
    
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
        // Try to extract the key distinguishing part (price, name, etc.)
        // Look for price patterns: $X, X, Xk, Xm, etc.
        const priceMatch = question.match(/(\$?[\d,]+(?:\.\d+)?[kmb]?)/i);
        if (priceMatch) {
          return priceMatch[1].trim();
        }
        
        // Look for dates
        const dateMatch = question.match(/(\w+\s+\d{1,2},?\s+\d{4})/i);
        if (dateMatch) {
          return dateMatch[1].trim();
        }
        
        // Extract what's left after removing event words
        const uniquePart = question.split(/\s+/).filter(word => {
          const normalizedWord = normalize(word);
          return !eventWords.some(ew => normalizedWord.includes(ew) || ew.includes(normalizedWord));
        }).join(' ').replace(/\?/g, '').trim();
        
        if (uniquePart.length > 0 && uniquePart.length < question.length) {
          return uniquePart;
        }
      }
    }
    
    // Fallback: Extract key information from question patterns
    // Pattern: Extract price if present
    const pricePattern = /(\$?[\d,]+(?:\.\d+)?[kmb]?)/i;
    const priceMatch = question.match(pricePattern);
    if (priceMatch) {
      return priceMatch[1].trim();
    }
    
    // Pattern: "Will [NAME] win [EVENT]?" - extract NAME
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    const winMatch = question.match(winPattern);
    if (winMatch && winMatch.length >= 2) {
      return winMatch[1].trim();
    }
    
    // Pattern: "Will [NAME] be [EVENT]?" - extract NAME
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    const beMatch = question.match(bePattern);
    if (beMatch && beMatch.length >= 2) {
      return beMatch[1].trim();
    }
    
    // Last resort: return everything before the question mark, cleaned up
    const beforeQuestionMark = question.split('?')[0]?.trim();
    if (beforeQuestionMark && beforeQuestionMark.length < question.length) {
      return beforeQuestionMark;
    }
    
    return question;
  }, []);

  // Detect if market is part of an event group (multimarket)
  // Use same detection method as MarketDiscoveryCard: check for both eventId AND eventTitle
  const eventId = market?.eventId;
  const hasEventInfo = eventId && (market as any).eventTitle;
  const eventMarkets = useMemo(() => {
    if (!eventId || !market) return [];
    return allMarkets.filter(m => m.eventId === eventId && m.id !== market.id);
  }, [eventId, allMarkets, market]);
  
  // Get all markets in the event (including current market)
  // Use same detection method as MarketDiscoveryCard
  const allEventMarkets = useMemo(() => {
    if (!market) return [];
    
    // First, try to find markets by eventId (most reliable method)
    // Check for both eventId and eventTitle to match MarketDiscoveryCard logic
    if (hasEventInfo) {
      const markets = allMarkets.filter(m => m.eventId === eventId);
      if (markets.length > 1) {
        // Sort by volume descending to show most active markets first
        return markets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      }
    }
    
    // Fallback: Group by pattern matching
    // Extract the event part from the question
    const question = market.question || '';
    
    // Pattern: "Will [NAME] win [EVENT]?"
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    // Pattern: "Will [NAME] be [EVENT]?"
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    // Pattern: "Will [NAME] become [EVENT]?"
    const becomePattern = /^Will\s+([^?]+?)\s+become\s+(.+?)\?$/i;
    // Pattern: "[NAME] out as [ROLE] in [YEAR]?" (e.g., "Tim Cook out as Apple CEO in 2025?")
    const outAsPattern = /^(.+?)\s+out\s+as\s+(.+?)\s+in\s+(\d{4})\?$/i;
    // Pattern: "[NAME] out by [DATE]?" (e.g., "Macron out by...?")
    const outByPattern = /^(.+?)\s+out\s+by\s+(.+?)\?$/i;
    
    let match = question.match(winPattern);
    let eventPart = '';
    let patternType = '';
    
    if (match) {
      patternType = 'win';
      eventPart = match[2].trim();
    } else {
      match = question.match(bePattern);
      if (match) {
        patternType = 'be';
        eventPart = match[2].trim();
      }
    }
    
    if (!match) {
      match = question.match(becomePattern);
      if (match) {
        patternType = 'become';
        eventPart = match[2].trim();
      }
    }
    
    if (!match) {
      match = question.match(outAsPattern);
      if (match) {
        // For "out as" pattern, extract role and year as event part
        eventPart = `${match[2].trim()} in ${match[3]}`;
        patternType = 'outAs';
      }
    }
    
    if (!match) {
      match = question.match(outByPattern);
      if (match) {
        // For "out by" pattern, extract the date/event part
        eventPart = match[2].trim();
        patternType = 'outBy';
      }
    }
    
    if (match && eventPart) {
      // Find all markets that match this pattern with the same event part
      const relatedMarkets = allMarkets.filter(m => {
        if (m.id === market.id) return true; // Include current market
        const mQuestion = m.question || '';
        
        // Try matching with the same pattern type
        let mMatch: RegExpMatchArray | null = null;
        
        if (patternType === 'win') {
          mMatch = mQuestion.match(/^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i);
          if (mMatch && mMatch.length >= 3) {
            return mMatch[2].trim() === eventPart;
          }
        } else if (patternType === 'be') {
          mMatch = mQuestion.match(/^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i);
          if (mMatch && mMatch.length >= 3) {
            return mMatch[2].trim() === eventPart;
          }
        } else if (patternType === 'become') {
          mMatch = mQuestion.match(/^Will\s+([^?]+?)\s+become\s+(.+?)\?$/i);
          if (mMatch && mMatch.length >= 3) {
            return mMatch[2].trim() === eventPart;
          }
        } else if (patternType === 'outAs') {
          mMatch = mQuestion.match(/^(.+?)\s+out\s+as\s+(.+?)\s+in\s+(\d{4})\?$/i);
          if (mMatch && mMatch.length >= 4) {
            const mEventPart = `${mMatch[2].trim()} in ${mMatch[3]}`;
            return mEventPart === eventPart;
          }
        } else if (patternType === 'outBy') {
          mMatch = mQuestion.match(/^(.+?)\s+out\s+by\s+(.+?)\?$/i);
          if (mMatch && mMatch.length >= 3) {
            return mMatch[2].trim() === eventPart;
          }
        }
        
        return false;
      });
      
      if (relatedMarkets.length > 1) {
        // Sort by volume descending to show most active markets first
        return relatedMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      }
    }
    
    return [];
  }, [hasEventInfo, eventId, allMarkets, market]);
  
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

  // Debug: Log when markets are found
  React.useEffect(() => {
    if (!market) return;
    
    // Only log if allMarkets has loaded (to avoid spam during loading)
    if (isLoadingAllMarkets) return;
    
    if (allEventMarkets.length > 1) {
      console.log('[MarketTradeCard] Found related markets:', {
        currentMarket: market.question,
        eventId: market.eventId,
        eventTitle: (market as any).eventTitle,
        hasEventInfo,
        relatedMarketsCount: allEventMarkets.length,
        relatedMarkets: allEventMarkets.map(m => extractOptionName(m.question || '', (m as any).eventTitle)),
        allMarketsCount: allMarkets.length
      });
    } else {
      console.log('[MarketTradeCard] No related markets found:', {
        currentMarket: market.question,
        eventId: market.eventId,
        eventTitle: (market as any).eventTitle,
        hasEventInfo,
        allMarketsCount: allMarkets.length,
        allEventMarketsCount: allEventMarkets.length,
        marketFromAllMarkets: !!allMarkets.find(m => m.id === market.id)
      });
    }
  }, [market, allEventMarkets, allMarkets.length, isLoadingAllMarkets, hasEventInfo, extractOptionName]);
  
  // Show toggle if market has eventId AND eventTitle (same as MarketDiscoveryCard)
  // This allows users to see the toggle and potentially switch to multimarket view
  const isPartOfEventGroup = !!hasEventInfo;
  
  // Determine if we're viewing single market or whole event
  const isViewingMultimarket = viewMode === 'multimarket' && isPartOfEventGroup;
  const displayMarketId = isViewingMultimarket && selectedMarketInEvent ? selectedMarketInEvent : effectiveMarketId;
  // Use displayMarketId for order book (single market or selected market in event)
  const { data: orderBook, isLoading: isLoadingOrderBook } = useOrderBook(
    (displayMarketId || effectiveMarketId) || null,
    selectedOutcome as 'YES' | 'NO',
    !!authParams,
    authParams?.address,
    authParams?.walletClient
  );

  // Calculate hours for historical prices
  // Always fetch ALL data, timeRange is only used for zooming/focus, not for filtering data
  const getHoursForRange = (range: TimeRange): number | null => {
    switch (range) {
      case '1H': return 1;
      case '6H': return 6;
      case '1D': return 24;
      case '1W': return 24 * 7;
      case '1M': return 24 * 30;
      case 'ALL': return null;
      default: return null;
    }
  };

  // Always fetch all data (null = all time), timeRange is only used for initial zoom
  // This allows users to scroll/pan to see all historical data
  // Use displayMarketId for historical prices
  const dataFetchHours = null; // Fetch all data
  const { data: historicalPrices, isLoading: isLoadingHistory } = useHistoricalPrices((displayMarketId || effectiveMarketId) || null, dataFetchHours);

  // Fetch trades for traders tab
  const { data: trades = [], isLoading: isLoadingTrades } = useTrades((displayMarketId || effectiveMarketId) || null);

  // Aggregate trader statistics from trades
  const traderStats = useMemo(() => {
    const stats = new Map<string, {
      address: string;
      totalTrades: number;
      totalVolume: number;
      yesTrades: number;
      noTrades: number;
      avgPrice: number;
      lastTradeTime: number;
      trades: typeof trades;
    }>();

    trades.forEach((trade) => {
      const address = trade.user || 'Unknown';
      const existing = stats.get(address) || {
        address,
        totalTrades: 0,
        totalVolume: 0,
        yesTrades: 0,
        noTrades: 0,
        avgPrice: 0,
        lastTradeTime: 0,
        trades: [],
      };

      const amount = parseFloat(trade.amount || '0');
      const price = trade.price || 0;
      const volume = amount * price;

      existing.totalTrades += 1;
      existing.totalVolume += volume;
      existing.avgPrice = (existing.avgPrice * (existing.totalTrades - 1) + price) / existing.totalTrades;
      existing.lastTradeTime = Math.max(existing.lastTradeTime, trade.timestamp);
      existing.trades.push(trade);

      if (trade.outcome === 'YES') {
        existing.yesTrades += 1;
      } else {
        existing.noTrades += 1;
      }

      stats.set(address, existing);
    });

    // Sort by total volume descending
    return Array.from(stats.values()).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [trades]);

  // Process order book data
  const { asks, bids, spread, spreadPercent } = useMemo(() => {
    if (!orderBook || !orderBook.asks || !orderBook.bids) {
      return { asks: [], bids: [], spread: 0, spreadPercent: 0 };
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

    const bestAsk = sortedAsks[0]?.price || 0;
    const bestBid = sortedBids[0]?.price || 0;
    const spreadValue = bestAsk - bestBid;
    const spreadPercentValue = bestBid > 0 ? (spreadValue / bestBid) * 100 : 0;

    return {
      asks: asksWithDollars,
      bids: bidsWithDollars,
      spread: spreadValue,
      spreadPercent: spreadPercentValue,
    };
  }, [orderBook]);

  const maxSize = useMemo(() => {
    const allSizes = [...asks.map(a => a.size), ...bids.map(b => b.size)];
    return allSizes.length > 0 ? Math.max(...allSizes) : 1;
  }, [asks, bids]);

  // Format helpers
  const formatPrice = useCallback((price: number): string => {
    const cents = price * 100;
    return `${cents.toFixed(1)}c`;
  }, []);

  const formatShares = useCallback((shares: number): string => {
    if (shares >= 1000000) return (shares / 1000000).toFixed(2) + 'M';
    if (shares >= 1000) return (shares / 1000).toFixed(2) + 'K';
    return shares.toFixed(2);
  }, []);

  const formatDollars = useCallback((dollars: number): string => {
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  // Fetch current price for display market
  const { data: displayMarketPrice } = useMarketPrice((displayMarketId || effectiveMarketId) || null);
  
  // Chart data - show selected outcome (YES or NO) for display market
  // NO is complementary: 100% - YES
  const chartData = useMemo<SeriesData[]>(() => {
    const marketIdForChart = displayMarketId || effectiveMarketId;
    if (!marketIdForChart) return [];
    
    // Use historical prices for display market
    if (!historicalPrices || historicalPrices.length === 0) {
      // If no historical data, use current price if available
      const priceToUse = displayMarketPrice || currentPrice;
      if (priceToUse) {
        const now = Date.now();
        const probability = selectedOutcome === 'YES' 
          ? priceToUse.probability 
          : 100 - priceToUse.probability;
        const price = probability / 100;
        const outcomeData = [{
          timestamp: now,
          price,
          probability,
        }];
        return [
          {
            data: convertHistoricalPricesToLightweight(outcomeData),
            color: selectedOutcome === 'YES' ? chartColors.yes : chartColors.no,
            label: selectedOutcome,
          },
        ];
      }
      return [];
    }
    
    // Sort by timestamp
    const sorted = [...historicalPrices].sort((a, b) => a.timestamp - b.timestamp);
    
    // Add current price if recent
    const now = Date.now();
    const priceToUse = displayMarketPrice || currentPrice;
    if (priceToUse && sorted.length > 0) {
      const lastPoint = sorted[sorted.length - 1];
      const timeSinceLastPoint = now - lastPoint.timestamp;
      if (timeSinceLastPoint > 60 * 1000) {
        sorted.push({
          timestamp: now,
          price: priceToUse.probability / 100,
          probability: priceToUse.probability,
        } as any);
      }
    }
    
    // Map data based on selected outcome
    // For YES: use price as-is
    // For NO: use 1 - price (complementary)
    const outcomeData = sorted.map((p) => {
      if (selectedOutcome === 'YES') {
        return {
          timestamp: p.timestamp,
          price: p.price,
          probability: p.price * 100,
        };
      } else {
        // NO: complementary probability
        const noPrice = 1 - p.price;
        return {
          timestamp: p.timestamp,
          price: noPrice,
          probability: noPrice * 100,
        };
      }
    });
    
    return [
      {
        data: convertHistoricalPricesToLightweight(outcomeData),
        color: selectedOutcome === 'YES' ? chartColors.yes : chartColors.no,
        label: selectedOutcome,
      },
    ];
  }, [historicalPrices, currentPrice, displayMarketPrice, selectedOutcome, displayMarketId, effectiveMarketId]);

  // Handle buy/sell - use displayMarketId (selected market in event or single market)
  const handleBuy = useCallback(async () => {
    const marketIdToUse = displayMarketId || effectiveMarketId;
    if (!marketIdToUse || !buyAmount) return;
    setIsSubmitting(true);
    try {
      const amount = parseUnits(buyAmount, 6); // USDC has 6 decimals
      const result = await buy({
        marketId: marketIdToUse,
        outcome: selectedOutcome as 'YES' | 'NO',
        amount,
      });
      if (result.success) {
        setBuyAmount('');
      } else {
        const errorMessage = result.error || 'Transaction failed';
        // Show toast notification for balance errors
        if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
          showErrorToast('Insufficient Balance', errorMessage);
        } else {
          showErrorToast('Transaction Failed', errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Buy error:', error);
      const errorMessage = error.message || 'Unknown error';
      // Show toast notification for balance errors
      if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
        showErrorToast('Insufficient Balance', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [displayMarketId, effectiveMarketId, buyAmount, selectedOutcome, buy, showErrorToast]);

  const handleSell = useCallback(async () => {
    const marketIdToUse = displayMarketId || effectiveMarketId;
    if (!marketIdToUse || !sellAmount) return;
    setIsSubmitting(true);
    try {
      const amount = parseUnits(sellAmount, 6);
      const result = await sell({
        marketId: marketIdToUse,
        outcome: selectedOutcome as 'YES' | 'NO',
        amount,
      });
      if (result.success) {
        setSellAmount('');
      } else {
        const errorMessage = result.error || 'Transaction failed';
        // Show toast notification for balance errors
        if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
          showErrorToast('Insufficient Balance', errorMessage);
        } else {
          showErrorToast('Transaction Failed', errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Sell error:', error);
      const errorMessage = error.message || 'Unknown error';
      // Show toast notification for balance errors
      if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
        showErrorToast('Insufficient Balance', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [displayMarketId, effectiveMarketId, sellAmount, selectedOutcome, sell, showErrorToast]);

  // Get market outcomes for buy/sell buttons
  // If viewing multimarket, show all outcomes from all markets in the event
  // If viewing single market, show only that market's outcomes
  const marketOutcomes = useMemo(() => {
    if (isViewingMultimarket && isPartOfEventGroup) {
      // Show all outcomes from all markets in the event
      const allOutcomes: Array<{ outcome: string; price: number; probability: number; marketId: string; marketQuestion: string }> = [];
      
      // Add outcomes from current market
      if (market) {
        if (market.outcomePrices) {
          allOutcomes.push({
            outcome: 'YES',
            price: market.outcomePrices.YES,
            probability: market.outcomePrices.YES * 100,
            marketId: market.id,
            marketQuestion: market.question,
          });
          allOutcomes.push({
            outcome: 'NO',
            price: market.outcomePrices.NO,
            probability: market.outcomePrices.NO * 100,
            marketId: market.id,
            marketQuestion: market.question,
          });
        } else if (market.tokens && market.tokens.length > 2) {
          market.tokens.forEach(token => {
            allOutcomes.push({
              outcome: token.outcome,
              price: token.price,
              probability: token.price * 100,
              marketId: market.id,
              marketQuestion: market.question,
            });
          });
        }
      }
      
      // Add outcomes from other markets in the event
      eventMarkets.forEach(eventMarket => {
        if (eventMarket.outcomePrices) {
          allOutcomes.push({
            outcome: 'YES',
            price: eventMarket.outcomePrices.YES,
            probability: eventMarket.outcomePrices.YES * 100,
            marketId: eventMarket.id,
            marketQuestion: eventMarket.question,
          });
          allOutcomes.push({
            outcome: 'NO',
            price: eventMarket.outcomePrices.NO,
            probability: eventMarket.outcomePrices.NO * 100,
            marketId: eventMarket.id,
            marketQuestion: eventMarket.question,
          });
        } else if (eventMarket.tokens && eventMarket.tokens.length > 2) {
          eventMarket.tokens.forEach(token => {
            allOutcomes.push({
              outcome: token.outcome,
              price: token.price,
              probability: token.price * 100,
              marketId: eventMarket.id,
              marketQuestion: eventMarket.question,
            });
          });
        }
      });
      
      return allOutcomes;
    }
    
    // Single market view - show only current market's outcomes
    if (!market) return [];
    
    // For YES/NO markets
    if (market.outcomePrices) {
      return [
        { outcome: 'YES', price: market.outcomePrices.YES, probability: market.outcomePrices.YES * 100, marketId: market.id, marketQuestion: market.question },
        { outcome: 'NO', price: market.outcomePrices.NO, probability: market.outcomePrices.NO * 100, marketId: market.id, marketQuestion: market.question },
      ];
    }
    
    // For multi-outcome markets
    if (market.tokens && market.tokens.length > 2) {
      return market.tokens.map(token => ({
        outcome: token.outcome,
        price: token.price,
        probability: token.price * 100,
        marketId: market.id,
        marketQuestion: market.question,
      }));
    }
    
    return [];
  }, [market, isViewingMultimarket, isPartOfEventGroup, eventMarkets]);

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to trade"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
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

  if (isLoadingMarket) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading market..." />
      </div>
    );
  }

  if (!market) {
    return (
      <EmptyState
        icon={Search}
        title="Market not found"
        description="Unable to load market data"
        className="p-4"
      />
    );
  }

  const currentProbability = currentPrice?.probability || (market.outcomePrices?.[selectedOutcome as 'YES' | 'NO'] || 0) * 100;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-1 border-b border-border bg-accent/20 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors rounded-t',
              activeTab === 'all'
                ? 'bg-background border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('market-info')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors rounded-t',
              activeTab === 'market-info'
                ? 'bg-background border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            Market Info
          </button>
          <button
            onClick={() => setActiveTab('traders')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors rounded-t',
              activeTab === 'traders'
                ? 'bg-background border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            Traders
          </button>
        </div>
        {/* Market Selector Dropdown - on the right */}
        {/* Show dropdown for any multimarket (event group with multiple markets) */}
        {market && allEventMarkets.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs px-2.5 flex items-center gap-1.5">
                <span className="max-w-[120px] truncate">
                  {market.question?.slice(0, 30) || 'Select Market'}
                </span>
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto min-w-[300px]">
              {allEventMarkets.map((eventMarket) => {
                // Always show the full question, truncated if needed
                const displayName = eventMarket.question || 'Market';
                const isSelected = eventMarket.id === effectiveMarketId;
                return (
                  <DropdownMenuItem
                    key={eventMarket.id}
                    onClick={() => {
                      if (onMarketChange) onMarketChange(eventMarket.id);
                      setViewMode('single');
                      setSelectedMarketInEvent(eventMarket.id);
                    }}
                    className={cn(
                      'cursor-pointer',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <div className="flex flex-col w-full">
                      <span className="text-xs font-medium">{displayName}</span>
                      {eventMarket.outcomePrices && (
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {(eventMarket.outcomePrices.YES * 100).toFixed(1)}% • ${eventMarket.outcomePrices.YES.toFixed(3)}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Main Content */}
      {activeTab === 'all' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top Section: Order Book and Chart */}
          <div className="flex-1 flex gap-2 p-2 min-h-0">
            {/* Left: Order Book */}
            <div className="w-1/3 flex flex-col border border-border rounded overflow-hidden">
              {/* Outcome Selector with Dropdown for Multimarket */}
              <div className="flex gap-2 px-3 py-2 border-b border-border bg-accent/20">
                {isViewingMultimarket && isPartOfEventGroup ? (
                  <>
                    {/* YES/NO toggle buttons */}
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
                    {/* Market selector dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          {selectedMarketInEvent 
                            ? (allMarkets.find(m => m.id === selectedMarketInEvent)?.question?.slice(0, 20) || 'Select Market') + '...'
                            : 'Select Market'
                          }
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[400px] overflow-y-auto min-w-[300px]">
                        {/* Show all markets in the event */}
                        {[market, ...eventMarkets].filter(Boolean).map(m => {
                          // Always show the full question
                          const displayName = m.question || 'Market';
                          return (
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => {
                                setSelectedMarketInEvent(m.id);
                                if (onMarketChange) onMarketChange(m.id);
                              }}
                              className={cn(
                                'cursor-pointer',
                                selectedMarketInEvent === m.id && 'bg-accent'
                              )}
                            >
                              <div className="flex flex-col w-full">
                                <span className="text-xs font-medium">{displayName}</span>
                                {m.outcomePrices && (
                                  <span className="text-xs text-muted-foreground mt-0.5">
                                    {(m.outcomePrices.YES * 100).toFixed(1)}% • ${m.outcomePrices.YES.toFixed(3)}
                                  </span>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Order Book Table */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingOrderBook ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner size="sm" text="Loading order book..." />
                  </div>
                ) : (
                  <div className="text-xs">
                    {/* Header */}
                    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-2 py-2 font-semibold text-xs text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                      <div>Price</div>
                      <div className="text-right">Shares</div>
                      <div className="text-right">Dollars</div>
                    </div>

                    {/* Asks */}
                    {asks.map((ask, index) => {
                      const barWidth = (ask.size / maxSize) * 100;
                      return (
                        <div
                          key={`ask-${index}`}
                          className="grid grid-cols-[80px_1fr_1fr] gap-2 px-2 py-1 hover:bg-muted/30 relative"
                        >
                          <div className="absolute left-0 top-0 bottom-0 bg-orange-500/40 pointer-events-none" style={{ width: `${barWidth}%` }} />
                          <div className="font-mono text-orange-500 relative z-10">{formatPrice(ask.price)}</div>
                          <div className="font-mono text-right relative z-10">{formatShares(ask.size)}</div>
                          <div className="font-mono text-right relative z-10">{formatDollars(ask.dollars)}</div>
                        </div>
                      );
                    })}

                    {/* Spread */}
                    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-2 py-2 bg-transparent border-y-2 border-primary/20 sticky top-[36px] z-10">
                      <div className="font-mono text-xs text-center font-semibold">{formatPrice(spread)}</div>
                      <div className="text-center text-xs font-semibold">Spread</div>
                      <div className="font-mono text-xs text-right font-semibold">{spreadPercent.toFixed(1)}%</div>
                    </div>

                    {/* Bids */}
                    {bids.map((bid, index) => {
                      const barWidth = (bid.size / maxSize) * 100;
                      return (
                        <div
                          key={`bid-${index}`}
                          className="grid grid-cols-[80px_1fr_1fr] gap-2 px-2 py-1 hover:bg-muted/30 relative"
                        >
                          <div className="absolute left-0 top-0 bottom-0 bg-blue-500/40 pointer-events-none" style={{ width: `${barWidth}%` }} />
                          <div className="font-mono text-blue-400 relative z-10">{formatPrice(bid.price)}</div>
                          <div className="font-mono text-right relative z-10">{formatShares(bid.size)}</div>
                          <div className="font-mono text-right relative z-10">{formatDollars(bid.dollars)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Chart */}
            <div className="flex-1 flex flex-col border border-border rounded overflow-hidden">
              {/* Chart Header with Timeframe */}
              <div className="flex items-center justify-between p-2 border-b border-border bg-accent/10">
                <div className="text-xs font-semibold">Price Chart</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                    >
                      {timeRange === 'ALL' ? 'max' : timeRange.toLowerCase()}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-24">
                    {(['1H', '6H', '1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => (
                      <DropdownMenuItem
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={timeRange === range ? 'bg-accent' : ''}
                      >
                        <span className="text-xs">
                          {range === 'ALL' ? 'max' : range.toLowerCase()} {timeRange === range && '✓'}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-0">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-full">
                    <LightweightChartCard
                      series={chartData}
                      showLegend={false}
                      timeRange={timeRange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Market Outcomes with Buy/Sell */}
          {marketOutcomes.length > 0 && (
            <div className="px-3 py-2.5 border-t border-border bg-accent/5">
              <div className="text-xs font-semibold mb-2.5">
                {isViewingMultimarket ? 'All Market Outcomes' : 'Market Outcomes'}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {marketOutcomes.map((outcome, index) => (
                  <div
                    key={`${outcome.marketId}-${outcome.outcome}-${index}`}
                    className="flex-shrink-0 border border-border rounded-lg p-2.5 bg-background min-w-[200px] shadow-sm"
                  >
                    {isViewingMultimarket && outcome.marketQuestion && (
                      <div className="text-xs text-muted-foreground mb-2 truncate" title={outcome.marketQuestion}>
                        {outcome.marketQuestion.slice(0, 30)}...
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        {outcome.probability > 50 ? (
                          <ArrowUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-xs font-semibold">{outcome.outcome}</span>
                      </div>
                      <span className={cn(
                        "text-xs font-mono font-semibold",
                        outcome.probability > 50 ? "text-green-500" : "text-red-500"
                      )}>
                        {outcome.probability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400 disabled:opacity-50"
                        onClick={async () => {
                          setSelectedOutcome(outcome.outcome as 'YES' | 'NO');
                          setSelectedMarketInEvent(outcome.marketId);
                          if (onMarketChange) onMarketChange(outcome.marketId);
                          setBuyAmount('10');
                          // Execute buy immediately
                          const marketIdToUse = outcome.marketId || displayMarketId || effectiveMarketId;
                          if (!marketIdToUse) return;
                          setIsSubmitting(true);
                          try {
                            const amount = parseUnits('10', 6); // USDC has 6 decimals
                            const result = await buy({
                              marketId: marketIdToUse,
                              outcome: outcome.outcome as 'YES' | 'NO',
                              amount,
                            });
                            if (result.success) {
                              setBuyAmount('');
                            } else {
                              const errorMessage = result.error || 'Transaction failed';
                              // Show toast notification for balance errors
                              if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
                                showErrorToast('Insufficient Balance', errorMessage);
                              } else {
                                showErrorToast('Transaction Failed', errorMessage);
                              }
                            }
                          } catch (error: any) {
                            console.error('Buy error:', error);
                            const errorMessage = error.message || 'Unknown error';
                            // Show toast notification for balance errors
                            if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
                              showErrorToast('Insufficient Balance', errorMessage);
                            }
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        Buy {outcome.outcome}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400 disabled:opacity-50"
                        onClick={async () => {
                          setSelectedOutcome(outcome.outcome as 'YES' | 'NO');
                          setSelectedMarketInEvent(outcome.marketId);
                          if (onMarketChange) onMarketChange(outcome.marketId);
                          setSellAmount('10');
                          // Execute sell immediately
                          const marketIdToUse = outcome.marketId || displayMarketId || effectiveMarketId;
                          if (!marketIdToUse) return;
                          setIsSubmitting(true);
                          try {
                            const amount = parseUnits('10', 6);
                            const result = await sell({
                              marketId: marketIdToUse,
                              outcome: outcome.outcome as 'YES' | 'NO',
                              amount,
                            });
                            if (result.success) {
                              setSellAmount('');
                            } else {
                              const errorMessage = result.error || 'Transaction failed';
                              // Show toast notification for balance errors
                              if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
                                showErrorToast('Insufficient Balance', errorMessage);
                              } else {
                                showErrorToast('Transaction Failed', errorMessage);
                              }
                            }
                          } catch (error: any) {
                            console.error('Sell error:', error);
                            const errorMessage = error.message || 'Unknown error';
                            // Show toast notification for balance errors
                            if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
                              showErrorToast('Insufficient Balance', errorMessage);
                            }
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        Sell {outcome.outcome}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules Section */}
          <div className="border-t border-border">
            <button
              onClick={() => setShowRules(!showRules)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 hover:bg-accent/20 transition-colors",
                showRules && "bg-accent/10"
              )}
            >
              <span className="text-xs font-semibold">Rules</span>
              {showRules ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            {showRules && market.resolutionCriteria && (
              <div className="px-3 py-2 border-t border-border bg-accent/5 text-xs text-muted-foreground whitespace-pre-wrap">
                {market.resolutionCriteria}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="border-t border-border">
            <button
              onClick={() => setShowComments(!showComments)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 hover:bg-accent/20 transition-colors",
                showComments && "bg-accent/10"
              )}
            >
              <span className="text-xs font-semibold">Comments</span>
              {showComments ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            {showComments && (
              <div className="border-t border-border bg-accent/5" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <CommentsCard marketId={effectiveMarketId} onMarketChange={onMarketChange} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'market-info' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs space-y-2">
            <div>
              <span className="font-semibold">Question:</span> {market.question}
            </div>
            {market.resolutionCriteria && (
              <div>
                <span className="font-semibold">Resolution Criteria:</span>
                <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{market.resolutionCriteria}</div>
              </div>
            )}
            {market.resolutionSource && (
              <div>
                <span className="font-semibold">Resolution Source:</span> {market.resolutionSource}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'traders' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {isLoadingTrades ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="sm" text="Loading traders..." />
            </div>
          ) : trades.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No traders found"
              description="No recent trades found for this market. Traders will appear here as they make trades."
              className="p-4"
            />
          ) : (
            <>
              {/* Trader Statistics Summary */}
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Active Traders ({traderStats.length})</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Based on {trades.length} recent trades
                </div>
              </div>

              {/* Trader List */}
              <div className="space-y-2">
                {traderStats.map((trader) => {
                  const formatAddress = (addr: string) => {
                    if (addr === 'Unknown' || !addr) return 'Unknown';
                    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                  };

                  const formatCurrency = (value: number) => {
                    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
                    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
                    return `$${value.toFixed(2)}`;
                  };

                  const formatTime = (timestamp: number) => {
                    const date = new Date(timestamp);
                    const now = Date.now();
                    const diffMs = now - timestamp;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'just now';
                    if (diffMins < 60) return `${diffMins}m ago`;
                    if (diffHours < 24) return `${diffHours}h ago`;
                    if (diffDays < 7) return `${diffDays}d ago`;
                    return date.toLocaleDateString();
                  };

                  return (
                    <div
                      key={trader.address}
                      className="border border-border rounded-lg p-3 bg-card hover:bg-accent/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Wallet className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" title={trader.address}>
                              {formatAddress(trader.address)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {trader.totalTrades} trade{trader.totalTrades !== 1 ? 's' : ''} • Last {formatTime(trader.lastTradeTime)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-mono font-semibold">
                            {formatCurrency(trader.totalVolume)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Total Volume
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50">
                        <div className="text-center">
                          <div className="text-xs font-semibold text-green-400">
                            {trader.yesTrades}
                          </div>
                          <div className="text-[10px] text-muted-foreground">YES</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-semibold text-red-400">
                            {trader.noTrades}
                          </div>
                          <div className="text-[10px] text-muted-foreground">NO</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-mono font-semibold">
                            ${trader.avgPrice.toFixed(3)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Avg Price</div>
                        </div>
                      </div>

                      {/* Recent Trades Preview */}
                      {trader.trades.slice(0, 3).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                            Recent Trades:
                          </div>
                          <div className="space-y-1">
                            {trader.trades.slice(0, 3).map((trade) => (
                              <div
                                key={trade.id}
                                className="flex items-center justify-between text-[10px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  {trade.outcome === 'YES' ? (
                                    <TrendingUp className="h-2.5 w-2.5 text-green-400" />
                                  ) : (
                                    <TrendingDown className="h-2.5 w-2.5 text-red-400" />
                                  )}
                                  <span className={cn(
                                    "font-semibold",
                                    trade.outcome === 'YES' ? "text-green-400" : "text-red-400"
                                  )}>
                                    {trade.outcome}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatUnits(BigInt(Math.floor(parseFloat(trade.amount || '0'))), 6)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">
                                    ${trade.price.toFixed(3)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatTime(trade.timestamp)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <MarketSelector
        open={showMarketSelector}
        onOpenChange={setShowMarketSelector}
        onSelect={(id) => {
          if (onMarketChange) {
            onMarketChange(id);
          }
          // Reset view mode to single when selecting a new market
          setViewMode('single');
          setSelectedMarketInEvent(null);
          setShowMarketSelector(false);
        }}
      />
    </div>
  );
}

// Memoize component but allow re-render when marketId changes
export const MarketTradeCard = React.memo(MarketTradeCardComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  // We want to re-render when marketId changes, so return false when marketId differs
  if (prevProps?.marketId !== nextProps?.marketId) {
    return false; // Props changed, re-render
  }
  return true; // Props are equal, skip re-render
});

