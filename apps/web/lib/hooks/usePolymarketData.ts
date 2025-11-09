'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { polymarketClient } from '@/lib/api/polymarket';
import { polymarketWS } from '@/lib/api/websocket';
import { onChainService } from '@/lib/api/onchain';
import { useMarketStore } from '@/stores/market-store';
import { useRealtimePrice } from './useRealtimePrice';
import { useRealtimeOrderbook } from './useRealtimeOrderbook';
import { useRealtimeTrades } from './useRealtimeTrades';

/**
 * Hook to fetch markets from Polymarket
 * Uses Gamma API (public, no API key needed!)
 */
export function useMarkets(params?: { active?: boolean; category?: string; limit?: number }) {
  const { setMarkets, setMarketPrice } = useMarketStore();
  
  return useQuery({
    queryKey: ['markets', params],
    queryFn: async () => {
      // Gamma API is public - no API key needed for markets
      // Suppress verbose logs to reduce console noise
      // If limit is not specified, fetch all markets (pass undefined, not a default)
      const markets = await polymarketClient.getMarkets({
        active: params?.active ?? true,
        limit: params?.limit, // Pass undefined if not specified - API will fetch all
        category: params?.category,
      });
      
      // Store markets in the store
      setMarkets(markets);
      
      // Pre-populate prices from market data so watchlist shows correct values immediately
      markets.forEach((market) => {
        if (market.outcomePrices?.YES !== undefined) {
          const yesPrice = market.outcomePrices.YES;
          setMarketPrice(market.id, {
            marketId: market.id,
            outcome: 'YES',
            price: yesPrice,
            probability: yesPrice * 100,
            volume24h: market.volume || 0,
            liquidity: market.liquidity || 0,
          });
        }
      });
      
      return markets;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (increased from 1 minute for better caching)
    gcTime: 30 * 60 * 1000, // 30 minutes (increased cache time)
    retry: 2, // Retry twice on failure
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch if data is fresh
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    enabled: true, // Always enabled - Gamma API is public!
  });
}

/**
 * Hook to fetch a single market by ID
 * Uses Gamma API (public, no API key needed!)
 */
export function useMarket(marketId: string | null) {
  return useQuery({
    queryKey: ['market', marketId],
    queryFn: async () => {
      if (!marketId) throw new Error('Market ID required');
      // Gamma API is public - no API key needed
      return polymarketClient.getMarket(marketId);
    },
    enabled: !!marketId, // Always enabled if marketId provided - Gamma API is public!
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 30 seconds)
    gcTime: 15 * 60 * 1000, // 15 minutes cache time
    refetchOnMount: false, // Don't refetch if data is fresh
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
  });
}

/**
 * Hook to fetch and subscribe to market price updates
 */
export function useMarketPrice(marketId: string | null) {
  const queryClient = useQueryClient();
  const { setMarketPrice } = useMarketStore();

  const query = useQuery({
    queryKey: ['market-price', marketId],
    queryFn: async () => {
      if (!marketId) return null;
      // Gamma API is public - no API key needed for market prices
      const price = await polymarketClient.getMarketPrice(marketId);
      if (price) {
        // Add timestamp to price data
        const priceWithTimestamp = {
          ...price,
          timestamp: Date.now(),
          dataUpdatedAt: new Date().toISOString(),
        };
        setMarketPrice(marketId, priceWithTimestamp);
        return priceWithTimestamp;
      }
      return price;
    },
    enabled: !!marketId, // Always enabled if marketId provided - Gamma API is public!
    staleTime: 10 * 60 * 1000, // 10 minutes - real-time updates handle most changes
    refetchInterval: 10 * 60 * 1000, // 10 minutes - real-time updates handle most changes, polling is fallback only
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnMount: false, // Don't refetch if data is fresh
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Subscribe to real-time price updates (YES outcome by default, covers both)
  useRealtimePrice(marketId, 'YES');

  // Legacy WebSocket subscription (keep for backward compatibility)
  useEffect(() => {
    if (!marketId || !polymarketWS.isConnected()) {
      return;
    }

    // Debounce updates to prevent excessive UI updates
    let updateTimeout: NodeJS.Timeout | null = null;
    let pendingUpdate: any = null;

    const unsubscribe = polymarketWS.subscribe('price', (data) => {
      if (data.marketId === marketId) {
        pendingUpdate = data;
        
        // Clear existing timeout
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        
        // Debounce updates (100ms)
        updateTimeout = setTimeout(() => {
          if (pendingUpdate) {
            queryClient.setQueryData(['market-price', marketId], pendingUpdate);
            setMarketPrice(marketId, pendingUpdate);
            pendingUpdate = null;
          }
        }, 100);
      }
    });

    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      unsubscribe();
    };
  }, [marketId, queryClient, setMarketPrice]);

  return query;
}

/**
 * Helper function to map hours to Polymarket interval format
 */
function getIntervalForHours(hours: number): string {
  if (hours <= 1) return '1h';
  if (hours <= 6) return '6h';
  if (hours <= 24) return '1d';
  if (hours <= 168) return '1w';  // 7 days
  if (hours <= 720) return '1m';  // 30 days
  return 'max';
}

/**
 * Helper function to get appropriate fidelity (resolution in minutes)
 */
function getFidelityForHours(hours: number): number {
  if (hours <= 1) return 1;      // 1-minute intervals for 1 hour
  if (hours <= 6) return 5;      // 5-minute intervals for 6 hours  
  if (hours <= 24) return 15;    // 15-minute intervals for 1 day
  if (hours <= 168) return 60;   // 1-hour intervals for 1 week
  if (hours <= 720) return 240;  // 4-hour intervals for 1 month
  return 1440;                   // Daily intervals for ALL
}

/**
 * Hook to fetch historical price data for a market
 * Uses Polymarket CLOB API prices-history endpoint with interval parameter
 * @param marketId - Market ID to fetch prices for
 * @param hours - Number of hours to fetch (null = all time)
 */
export function useHistoricalPrices(marketId: string | null, hours: number | null = 24) {
  // Use a ref to track the marketId that was used for the current data
  // This prevents showing stale data from a different market
  const previousMarketIdRef = useRef<string | null>(null);
  
  // Update ref when marketId changes
  useEffect(() => {
    if (marketId !== previousMarketIdRef.current) {
      previousMarketIdRef.current = marketId;
    }
  }, [marketId]);
  
  return useQuery({
    queryKey: ['historical-prices', marketId, hours],
    queryFn: async () => {
      if (!marketId) return [];
      
      // Store the marketId we're fetching for
      previousMarketIdRef.current = marketId;
      
      try {
        // FIRST: Try CLOB API prices-history endpoint (fastest, most efficient)
        // This uses Polymarket's dedicated price history endpoint with interval parameter
        let interval: string;
        let fidelity: number | undefined;
        
        if (hours === null) {
          // For "ALL" time range
          interval = 'max';
        } else {
          // Map hours to Polymarket's interval format
          interval = getIntervalForHours(hours);
          fidelity = getFidelityForHours(hours);
        }
        
        // Suppress verbose debug logs
        const historicalPrices = await polymarketClient.getHistoricalPrices(marketId, interval, fidelity);
        
        // OPTIMIZATION: Return CLOB data immediately if available, even if incomplete
        // This allows the chart to render instantly while trades are fetched in background
        let clobData: Array<{ timestamp: number; price: number; probability: number; noProbability: number }> = [];
        let clobDataComplete = true;
        
        if (historicalPrices && historicalPrices.length > 0) {
          clobData = historicalPrices.map((item) => ({
            timestamp: item.timestamp,
            price: item.price,
            probability: item.price * 100,
            noProbability: (1 - item.price) * 100, // Mirrored
          }));
          
          // Check if the CLOB API data is incomplete (less than 35 days suggests API limit)
          const sortedPrices = [...historicalPrices].sort((a, b) => a.timestamp - b.timestamp);
          const firstTimestamp = sortedPrices[0].timestamp;
          const lastTimestamp = sortedPrices[sortedPrices.length - 1].timestamp;
          const timeSpanDays = (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24);
          
          // If data spans less than 35 days and we're requesting ALL time, supplement with trades
          if (hours === null && timeSpanDays < 35) {
            console.warn(`[useHistoricalPrices] CLOB API returned only ${timeSpanDays.toFixed(1)} days, supplementing with trades for complete history`);
            clobDataComplete = false;
            // Continue to trades fallback to supplement the data
            // We'll merge CLOB data with trades later
          } else {
            // Data looks complete, return it immediately for instant chart render
            return clobData;
          }
        }
        
        // OPTIMIZATION: If we have CLOB data (even if incomplete), we'll still fetch trades
        // but we can optimize the trade fetching to be faster
        // The chart will render with merged data once trades are fetched
        
        // FALLBACK: Build from trades (if price history unavailable or incomplete)
        // First, get market to find conditionId
        const market = await polymarketClient.getMarket(marketId);
        const conditionId = market?.conditionId;
        
        if (!conditionId) {
          console.warn(`[useHistoricalPrices] No conditionId found for market ${marketId}, cannot fetch trades`);
          return [];
        }
        
        const nowFallback = Date.now();
        const startTimeFallback = hours !== null 
          ? Math.floor((nowFallback - (hours * 60 * 60 * 1000)) / 1000)
          : undefined;
        
        // Log what we're requesting
        if (hours !== null) {
          const requestedStartDate = new Date((nowFallback - (hours * 60 * 60 * 1000)));
          // Suppress verbose debug logs
        } else {
          // Suppress verbose debug logs
        }
        
        // OPTIMIZATION: Use smaller initial limit for faster first render
        // We can fetch more data in background if needed
        // For ALL time, start smaller to show chart faster, then expand
        const initialLimit = hours === null ? 2000 : (hours <= 24 ? 500 : 1000);
        // Suppress verbose debug logs
        
        let trades = await polymarketClient.getTrades(marketId, { 
          limit: initialLimit,
          startTime: startTimeFallback,
          conditionId: conditionId
        });
        
        // Suppress verbose debug logs
        
        // Log the actual date range of trades received
        if (trades.length > 0) {
          const tradesSorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
          const earliestTrade = tradesSorted[0];
          const latestTrade = tradesSorted[tradesSorted.length - 1];
          const earliestDate = new Date(earliestTrade.timestamp);
          const latestDate = new Date(latestTrade.timestamp);
          const actualSpan = latestTrade.timestamp - earliestTrade.timestamp;
          
          // Suppress verbose debug logs
          
          // Check if we only got today's trades when we requested historical data
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const earliestDay = new Date(earliestDate);
          earliestDay.setHours(0, 0, 0, 0);
          
          if (hours !== null && hours > 24 && earliestDay.getTime() === today.getTime()) {
            console.warn(`[useHistoricalPrices] ⚠️ WARNING: Requested ${hours}h of historical data but only got trades from today!`);
            console.warn(`[useHistoricalPrices] This might mean the market is new or there's no trading history.`);
          }
        }
        
        // For ALL time, fetch complete historical data by fetching chunks in parallel
        // OPTIMIZATION: Fetch multiple chunks in parallel instead of sequentially
        if (trades.length > 0 && hours === null) {
          const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
          const earliestTimestamp = sortedTrades[0].timestamp;
          const now = Date.now();
          
          // Calculate total time span
          const totalDays = (now - earliestTimestamp) / (1000 * 60 * 60 * 24);
          const chunkDays = 90;
          const numChunks = Math.ceil(totalDays / chunkDays);
          
          // RATE LIMIT: Based on CLOB Ledger /data/trades: 150 req/10s
          // Fetch in batches of 10 chunks (safe margin)
          const MAX_PARALLEL_CHUNKS = 10;
          const BATCH_DELAY_MS = 1100; // Wait 1.1s between batches to respect 10s window
          const MAX_CHUNKS = 20; // Limit total chunks to prevent excessive requests
          
          // Create all chunk fetch promises
          const chunkPromises: Array<{ startTime: number; promise: Promise<typeof trades> }> = [];
          
          for (let i = 0; i < numChunks && i < MAX_CHUNKS; i++) {
            const chunkStartSeconds = Math.floor(earliestTimestamp / 1000) - (chunkDays * (i + 1) * 24 * 60 * 60);
            
            chunkPromises.push({
              startTime: chunkStartSeconds,
              promise: Promise.race([
                polymarketClient.getTrades(marketId, { 
                  limit: 5000,
                  startTime: chunkStartSeconds,
                  conditionId: conditionId
                }),
                new Promise<typeof trades>((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout')), 10000);
                })
              ]).catch(() => []) // Return empty array on error
            });
          }
          
          // Fetch chunks in batches to respect rate limits
          let allTrades = [...trades];
          
          for (let batchStart = 0; batchStart < chunkPromises.length; batchStart += MAX_PARALLEL_CHUNKS) {
            const batch = chunkPromises.slice(batchStart, batchStart + MAX_PARALLEL_CHUNKS);
            
            // Fetch this batch in parallel
            const batchResults = await Promise.allSettled(
              batch.map(({ promise }) => promise)
            );
            
            // Combine results
            let batchHadNewData = false;
            batchResults.forEach((result) => {
              if (result.status === 'fulfilled' && result.value.length > 0) {
                const existingTradeIds = new Set(allTrades.map(t => t.id));
                const uniqueTrades = result.value.filter(t => !existingTradeIds.has(t.id));
                if (uniqueTrades.length > 0) {
                  allTrades = [...uniqueTrades, ...allTrades].sort((a, b) => a.timestamp - b.timestamp);
                  batchHadNewData = true;
                }
              }
            });
            
            // If we got no new data in this batch, we've likely reached the beginning
            if (!batchHadNewData && batchStart > 0) {
              break; // No new data, stop fetching
            }
            
            // Wait before next batch (except for last batch)
            if (batchStart + MAX_PARALLEL_CHUNKS < chunkPromises.length) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
          }
          
          // Update trades with the complete dataset
          trades = allTrades;
        }
        
        if (hours === null && trades.length > 0) {
          const earliestTrade = trades[0];
          const latestTrade = trades[trades.length - 1];
          const earliestDate = new Date(earliestTrade.timestamp);
          const latestDate = new Date(latestTrade.timestamp);
          // Suppress verbose debug logs
        }
        
        if (!trades || trades.length === 0) {
          console.warn(`[useHistoricalPrices] No trades found for market ${marketId}`);
          return [];
        }
        
        // Separate YES and NO outcome trades for mirrored chart display
        // Sort by timestamp ascending for chronological order
        const yesTrades = trades
          .filter((trade) => trade.outcome === 'YES')
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const noTrades = trades
          .filter((trade) => trade.outcome === 'NO')
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Use YES trades as primary, but also process NO trades for mirrored display
        if (yesTrades.length === 0 && noTrades.length === 0) {
          console.warn(`[useHistoricalPrices] No YES or NO outcome trades found for market ${marketId}`);
          return [];
        }
        
        // If we only have NO trades, use them (calculate YES as 1 - NO)
        const primaryTrades = yesTrades.length > 0 ? yesTrades : noTrades;
        
        // First, calculate the actual time span from the trades data
        // This ensures we use appropriate intervals even for very new markets
        let actualHours: number | null = hours;
        if (primaryTrades.length > 0) {
          const earliestTrade = primaryTrades[0];
          const latestTrade = primaryTrades[primaryTrades.length - 1];
          const actualSpan = latestTrade.timestamp - earliestTrade.timestamp;
          actualHours = actualSpan / (1000 * 60 * 60); // Convert to hours
          
          if (hours === null) {
            const earliestDate = new Date(earliestTrade.timestamp);
            const latestDate = new Date(latestTrade.timestamp);
            // Suppress verbose debug logs
          }
        }
        
        // Determine appropriate interval based on ACTUAL data span (not just requested hours)
        // Always prefer actual hours if available, otherwise use requested hours
        // This ensures we use appropriate intervals even for very new markets
        const spanToUse = actualHours !== null ? actualHours : (hours || 1);
        
        let intervalMs: number;
        if (spanToUse <= 0.1) {
          intervalMs = 10 * 1000; // 10 seconds for very short spans (< 6 minutes)
        } else if (spanToUse <= 1) {
          intervalMs = 1 * 60 * 1000; // 1 minute for < 1 hour
        } else if (spanToUse <= 6) {
          intervalMs = 5 * 60 * 1000; // 5 minutes for < 6 hours
        } else if (spanToUse <= 24) {
          intervalMs = 15 * 60 * 1000; // 15 minutes for < 24 hours
        } else if (spanToUse <= 168) { // 7 days
          intervalMs = 60 * 60 * 1000; // 1 hour for < 1 week
        } else {
          intervalMs = 4 * 60 * 60 * 1000; // 4 hours for longer periods
        }
        
        // Suppress verbose debug logs
        
        // Build price points from trades - include both YES and NO for mirrored display
        const pricePoints: Array<{ timestamp: number; price: number; probability: number; noProbability?: number }> = [];
        
        // Group YES trades into time buckets
        const yesBuckets: Map<number, { prices: number[]; lastPrice: number }> = new Map();
        
        yesTrades.forEach((trade) => {
          const bucketTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;
          if (!yesBuckets.has(bucketTime)) {
            yesBuckets.set(bucketTime, { prices: [], lastPrice: trade.price });
          }
          const bucket = yesBuckets.get(bucketTime)!;
          bucket.prices.push(trade.price);
          bucket.lastPrice = trade.price; // Keep the most recent price in bucket
        });
        
        // Group NO trades into time buckets
        const noBuckets: Map<number, { prices: number[]; lastPrice: number }> = new Map();
        
        noTrades.forEach((trade) => {
          const bucketTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;
          if (!noBuckets.has(bucketTime)) {
            noBuckets.set(bucketTime, { prices: [], lastPrice: trade.price });
          }
          const bucket = noBuckets.get(bucketTime)!;
          bucket.prices.push(trade.price);
          bucket.lastPrice = trade.price; // Keep the most recent price in bucket
        });
        
        // Combine all bucket times (from both YES and NO trades)
        const allBucketTimes = new Set([...yesBuckets.keys(), ...noBuckets.keys()]);
        const sortedBucketTimes = Array.from(allBucketTimes).sort((a, b) => a - b);
        
        // For each bucket, calculate prices for both YES and NO
        sortedBucketTimes.forEach((bucketTime) => {
          // Get YES price from bucket or calculate from NO (mirrored)
          let yesPrice: number;
          const yesBucket = yesBuckets.get(bucketTime);
          if (yesBucket && yesBucket.prices.length > 0) {
            yesPrice = yesBucket.lastPrice;
          } else {
            // If no YES trade in this bucket, check NO and calculate YES as 1 - NO
            const noBucket = noBuckets.get(bucketTime);
            if (noBucket && noBucket.prices.length > 0) {
              yesPrice = 1 - noBucket.lastPrice; // Mirrored: YES = 1 - NO
            } else {
              return; // Skip if no data for this bucket
            }
          }
          
          // Get NO price (mirrored: NO = 1 - YES)
          const noBucket = noBuckets.get(bucketTime);
          const noPrice = noBucket && noBucket.prices.length > 0 
            ? noBucket.lastPrice 
            : (1 - yesPrice); // Mirrored: NO = 1 - YES
          
          // Ensure prices are in valid range [0, 1]
          const clampedYesPrice = Math.max(0, Math.min(1, yesPrice));
          const clampedNoPrice = Math.max(0, Math.min(1, noPrice));
          
          // Ensure they sum to 100% (mirrored relationship)
          const yesProb = clampedYesPrice * 100;
          const noProb = clampedNoPrice * 100;
          
          pricePoints.push({
            timestamp: bucketTime,
            price: clampedYesPrice,
            probability: yesProb,
            noProbability: noProb, // Include NO probability for mirrored display
          });
        });
        
        // Sort by timestamp
        pricePoints.sort((a, b) => a.timestamp - b.timestamp);
        
        // If we have CLOB API data that was incomplete, merge it with trades data
        if (!clobDataComplete && clobData.length > 0) {
          // Use already converted CLOB data
          const clobPoints = clobData;
          
          // Merge CLOB and trades data, removing duplicates (prefer trades for overlapping timestamps)
          const allPoints = [...clobPoints, ...pricePoints]
            .sort((a, b) => a.timestamp - b.timestamp);
          
          // Remove duplicates - if two points are within 1 hour, keep the trades one
          const mergedPoints: typeof pricePoints = [];
          const seenTimestamps = new Set<number>();
          
          allPoints.forEach((point) => {
            // Round to nearest hour for deduplication
            const roundedTime = Math.floor(point.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
            if (!seenTimestamps.has(roundedTime)) {
              seenTimestamps.add(roundedTime);
              mergedPoints.push(point);
            }
          });
          
          pricePoints.splice(0, pricePoints.length, ...mergedPoints);
          console.log(`[useHistoricalPrices] Merged ${clobPoints.length} CLOB points with ${pricePoints.length - clobPoints.length} trade points`);
        }
        
        // For ALL time with many trades, we might have too many bucketed points
        // Increase limit to show more data - Recharts can handle 500-1000 points reasonably
        if (hours === null && pricePoints.length > 1000) {
          // Suppress verbose debug logs
          const step = Math.ceil(pricePoints.length / 1000);
          const sampled = pricePoints.filter((_, index) => index % step === 0 || index === pricePoints.length - 1);
          pricePoints.splice(0, pricePoints.length, ...sampled);
          console.log(`[useHistoricalPrices] Sampled to ${pricePoints.length} points`);
        } else {
          console.log(`[useHistoricalPrices] Keeping all ${pricePoints.length} price points for chart`);
        }
        
        // If we have very few points, add individual trade points instead of bucketing
        // This ensures we have at least some data to display
        if (pricePoints.length < 10 && primaryTrades.length > 0) {
          console.log(`[useHistoricalPrices] Few bucketed points (${pricePoints.length}), adding individual trades for better resolution`);
          const maxPoints = hours === null ? 200 : 50; // More points for ALL time
          
          // Sample both YES and NO trades
          const sampledYesTrades = yesTrades
            .filter((trade, index) => index % Math.max(1, Math.floor(yesTrades.length / maxPoints)) === 0);
          const sampledNoTrades = noTrades
            .filter((trade, index) => index % Math.max(1, Math.floor(noTrades.length / maxPoints)) === 0);
          
          // Combine and create points with mirrored probabilities
          const allTrades = [...sampledYesTrades, ...sampledNoTrades]
            .sort((a, b) => a.timestamp - b.timestamp);
          
          const individualPoints = allTrades.map((trade) => {
            const yesPrice = trade.outcome === 'YES' 
              ? Math.max(0, Math.min(1, trade.price))
              : (1 - Math.max(0, Math.min(1, trade.price))); // Mirrored
            const noPrice = trade.outcome === 'NO'
              ? Math.max(0, Math.min(1, trade.price))
              : (1 - Math.max(0, Math.min(1, trade.price))); // Mirrored
              
            return {
              timestamp: trade.timestamp,
              price: yesPrice,
              probability: yesPrice * 100,
              noProbability: noPrice * 100,
            };
          });
          
          // Merge with bucketed points, removing duplicates
          // For very short spans, use a smaller minimum distance to avoid filtering out all points
          const minDistance = spanToUse <= 0.1 ? (intervalMs / 10) : (intervalMs / 2);
          const merged = [...pricePoints, ...individualPoints]
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((point, index, arr) => {
              // Remove points that are too close together
              if (index === 0) return true;
              return point.timestamp - arr[index - 1].timestamp >= minDistance;
            });
          
          // Suppress verbose success logs
          return merged;
        }
        
        // If we still have no points, try using individual trades directly
        if (pricePoints.length === 0 && primaryTrades.length > 0) {
          console.log(`[useHistoricalPrices] No bucketed points, using individual trades directly`);
          const maxPoints = hours === null ? 200 : 100; // More points for ALL time
          
          // Combine YES and NO trades
          const allTrades = [...yesTrades, ...noTrades]
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((trade, index) => index % Math.max(1, Math.floor((yesTrades.length + noTrades.length) / maxPoints)) === 0);
          
          const individualPoints = allTrades.map((trade) => {
            const yesPrice = trade.outcome === 'YES'
              ? Math.max(0, Math.min(1, trade.price))
              : (1 - Math.max(0, Math.min(1, trade.price))); // Mirrored
            const noPrice = trade.outcome === 'NO'
              ? Math.max(0, Math.min(1, trade.price))
              : (1 - Math.max(0, Math.min(1, trade.price))); // Mirrored
            
            return {
              timestamp: trade.timestamp,
              price: yesPrice,
              probability: yesPrice * 100,
              noProbability: noPrice * 100,
            };
          });
          
          // Suppress verbose success logs
          return individualPoints;
        }
        
        // Suppress verbose success logs
        return pricePoints;
      } catch (error) {
        console.error('[useHistoricalPrices] Error fetching historical prices from trades:', error);
        
        // Fallback: Try to get historical prices from CLOB API again with different interval
        try {
          // Try with max interval if we haven't already
          if (hours !== null) {
            const fallbackInterval = hours <= 720 ? 'max' : '1m'; // Use max for anything <= 30 days
            // Suppress verbose debug logs
            const historical = await polymarketClient.getHistoricalPrices(marketId, fallbackInterval);
            
            if (historical && historical.length > 0) {
              return historical.map((item) => ({
                timestamp: item.timestamp,
                price: item.price,
                probability: item.price * 100,
                noProbability: (1 - item.price) * 100,
              }));
            }
          }
        } catch (fallbackError) {
          console.error('[useHistoricalPrices] Error fetching historical prices from fallback:', fallbackError);
        }
        
        return [];
      }
    },
    enabled: !!marketId,
    staleTime: 10 * 60 * 1000, // 10 minutes - historical data doesn't change (increased from 5)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (increased from 10)
    refetchOnMount: false, // Don't refetch if data is fresh
    // CRITICAL FIX: Only use placeholderData if marketId hasn't changed
    // This prevents showing data from a different market when switching markets
    placeholderData: (previousData) => {
      // If marketId changed, don't show previous data (it's from a different market)
      // React Query's queryKey changes when marketId changes, so previousData should be undefined
      // But we add an extra check to be safe
      const currentMarketId = previousMarketIdRef.current;
      if (currentMarketId !== null && currentMarketId !== marketId) {
        // Market changed - don't show stale data
        return undefined;
      }
      // Only show previous data if it's for the same market (or if we're still loading)
      return previousData;
    },
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch order book for a market outcome
 * Supports L1 authentication (wallet signature) - no API key needed!
 */
export function useOrderBook(
  marketId: string | null, 
  outcome: 'YES' | 'NO',
  useL1Auth?: boolean,
  walletAddress?: string,
  walletClient?: any
) {
  const queryClient = useQueryClient();
  const { setOrderBook } = useMarketStore();
  const isConfigured = polymarketClient.isConfigured();

  const query = useQuery({
    queryKey: ['orderbook', marketId, outcome, useL1Auth, walletAddress],
    queryFn: async () => {
      if (!marketId) return null;
      
      // Try with L1 auth if provided, otherwise fall back to API key
      const book = await polymarketClient.getOrderBook(
        marketId, 
        outcome,
        useL1Auth,
        walletAddress,
        walletClient
      );
      
      if (book) {
        setOrderBook(marketId, outcome, book);
      }
      return book;
    },
    enabled: !!marketId, // Always enable if marketId exists - let the API handle auth requirements
    staleTime: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes
    refetchInterval: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes, polling is fallback only
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnMount: false, // Don't refetch if data is fresh
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
  });

  // Subscribe to real-time orderbook updates
  useRealtimeOrderbook(marketId, outcome);

  // Legacy WebSocket subscription (keep for backward compatibility)
  useEffect(() => {
    if (!marketId || (!isConfigured && !useL1Auth) || !polymarketWS.isConnected()) return;

    // Debounce updates to prevent excessive UI updates
    let updateTimeout: NodeJS.Timeout | null = null;
    let pendingUpdate: any = null;

    const unsubscribe = polymarketWS.subscribe('orderbook', (data) => {
      if (data.marketId === marketId && data.outcome === outcome) {
        pendingUpdate = data;
        
        // Clear existing timeout
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        
        // Debounce updates (200ms for orderbook)
        updateTimeout = setTimeout(() => {
          if (pendingUpdate) {
            queryClient.setQueryData(['orderbook', marketId, outcome, useL1Auth, walletAddress], pendingUpdate);
            setOrderBook(marketId, outcome, pendingUpdate);
            pendingUpdate = null;
          }
        }, 200);
      }
    });

    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      unsubscribe();
    };
  }, [marketId, outcome, queryClient, setOrderBook, isConfigured, useL1Auth, walletAddress]);

  return query;
}

/**
 * Hook to fetch recent trades for a market
 * Uses Activity Subgraph (no API key needed) or CLOB API if available
 */
export function useTrades(marketId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['trades', marketId],
    queryFn: async () => {
      if (!marketId) return [];
      
      // Get market to find conditionId if needed
      let conditionId: string | undefined;
      try {
        const market = await polymarketClient.getMarket(marketId);
        conditionId = market?.conditionId;
      } catch (error) {
        console.warn('[useTrades] Could not fetch market for conditionId:', error);
      }
      
      // getTrades can use Activity Subgraph (no API key needed) or CLOB API
      // For tape, we want the most recent trades (last 24 hours)
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const oneDayAgo = now - (24 * 60 * 60); // 24 hours ago in seconds
      
      const trades = await polymarketClient.getTrades(marketId, { 
        limit: 100,
        conditionId: conditionId,
        startTime: oneDayAgo // Only fetch trades from last 24 hours
      });
      
      // Sort trades by timestamp descending (newest first) for tape display
      return trades.sort((a, b) => b.timestamp - a.timestamp);
    },
    enabled: !!marketId, // Enabled as long as marketId exists - Activity Subgraph doesn't need API key
    staleTime: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes
    refetchInterval: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes, polling is fallback only
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnMount: false, // Don't refetch if data is fresh
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
  });

  // Subscribe to real-time trade updates
  useRealtimeTrades(marketId);

  // Legacy WebSocket subscription (keep for backward compatibility)
  useEffect(() => {
    if (!marketId || !polymarketWS.isConnected()) return;

    // Debounce updates to prevent excessive UI updates
    let updateTimeout: NodeJS.Timeout | null = null;
    let pendingUpdates: any[] = [];

    const unsubscribe = polymarketWS.subscribe('trade', (data) => {
      if (data.marketId === marketId) {
        pendingUpdates.push(data);
        
        // Clear existing timeout
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }
        
        // Debounce updates (150ms for trades) and batch updates
        updateTimeout = setTimeout(() => {
          if (pendingUpdates.length > 0) {
            queryClient.setQueryData(['trades', marketId], (old: any[] = []) => {
              // Add all pending updates
              const updated = [...pendingUpdates, ...old].slice(0, 100); // Keep latest 100
              pendingUpdates = [];
              return updated;
            });
          }
        }, 150);
      }
    });

    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      unsubscribe();
    };
  }, [marketId, queryClient]);

  return query;
}

/**
 * Hook to establish WebSocket connection for real-time updates
 * Only connects when API key is configured
 */
export function useWebSocketConnection() {
  const isConfigured = polymarketClient.isConfigured();

  useEffect(() => {
    if (!isConfigured) {
      // Only log warning once per session
      if (typeof window !== 'undefined' && !(window as any).__polymarket_ws_warned_global) {
        (window as any).__polymarket_ws_warned_global = true;
        // Suppress this warning - it's informational
        // console.warn('Polymarket API key not configured - WebSocket connection disabled');
      }
      return;
    }

    if (!polymarketWS.isConnected()) {
      console.log('Connecting to Polymarket WebSocket...');
      polymarketWS.connect();
    }

    return () => {
      // Keep connection alive, don't disconnect on unmount
      // polymarketWS.disconnect();
    };
  }, [isConfigured]);
}
