'use client';

import { useEffect, useMemo } from 'react';
import { alertSystem, AlertDataFetcher } from '@/lib/alerts/alert-system';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from './usePolymarketData';
import { useOrderBook } from './usePolymarketData';
import { polymarketClient } from '@/lib/api/polymarket';

/**
 * Hook to connect AlertSystem to real market data
 * This hook sets up the data fetcher so alerts can use real-time market data
 */
export function useAlertSystem() {
  const { getPrice, getMarket, getOrderBook } = useMarketStore();

  // Create data fetcher that connects to market store
  const dataFetcher: AlertDataFetcher = useMemo(() => {
    return {
      getPrice: (marketId: string): number | null => {
        // Get price from market store
        const price = getPrice(marketId);
        if (price && typeof price === 'object' && 'probability' in price) {
          return (price as { probability: number }).probability;
        }
        // Fallback: try to get from market data
        const market = getMarket(marketId);
        if (market?.outcomePrices?.YES !== undefined) {
          return market.outcomePrices.YES * 100;
        }
        return null;
      },

      getVolume: (marketId: string): number | null => {
        // Get volume from price data or market data
        const price = getPrice(marketId);
        if (price && typeof price === 'object' && 'volume24h' in price) {
          return (price as { volume24h: number }).volume24h;
        }
        const market = getMarket(marketId);
        if (market?.volume !== undefined) {
          return market.volume;
        }
        return null;
      },

      getDepth: (marketId: string, outcome: 'YES' | 'NO' = 'YES'): number | null => {
        // Get order book depth (sum of bid and ask sizes)
        const orderBook = getOrderBook(marketId, outcome);
        if (!orderBook) return null;

        const bidDepth = orderBook.bids?.reduce((sum, bid) => sum + (bid.size || 0), 0) || 0;
        const askDepth = orderBook.asks?.reduce((sum, ask) => sum + (ask.size || 0), 0) || 0;
        
        return bidDepth + askDepth;
      },

      getSpread: (marketId: string, outcome: 'YES' | 'NO' = 'YES'): number | null => {
        // Get spread (ask[0] - bid[0]) as percentage
        const orderBook = getOrderBook(marketId, outcome);
        if (!orderBook || !orderBook.bids?.[0] || !orderBook.asks?.[0]) {
          return null;
        }

        const bestBid = orderBook.bids[0].price;
        const bestAsk = orderBook.asks[0].price;
        const spread = bestAsk - bestBid;
        
        // Return as fraction (0-1 range)
        return spread;
      },

      getFlow: async (marketId: string, outcome: 'YES' | 'NO' = 'YES'): Promise<number | null> => {
        // Calculate net flow from recent trades
        // Positive = buy pressure, negative = sell pressure
        try {
          const trades = await polymarketClient.getTrades(marketId, {
            limit: 100,
          });

          if (!trades || trades.length === 0) {
            return null;
          }

          // Filter trades for the specific outcome
          const relevantTrades = trades.filter((trade) => trade.outcome === outcome);
          
          // Calculate net flow (simplified: sum of buy amounts - sell amounts)
          // For now, we'll use a simple heuristic: positive flow if more recent trades
          // In production, you'd want to track actual buy/sell direction from order book
          const recentTrades = relevantTrades.slice(0, 20); // Last 20 trades
          const flow = recentTrades.length; // Simple proxy: more trades = more flow
          
          return flow;
        } catch (error) {
          console.error('[useAlertSystem] Error fetching flow:', error);
          return null;
        }
      },
    } as AlertDataFetcher & { getFlow: (marketId: string, outcome?: 'YES' | 'NO') => Promise<number | null> };
  }, [getPrice, getMarket, getOrderBook]);

  // Set up data fetcher when component mounts
  useEffect(() => {
    // Create synchronous version of getFlow for the fetcher
    const syncDataFetcher: AlertDataFetcher = {
      ...dataFetcher,
      getFlow: (marketId: string, outcome: 'YES' | 'NO' = 'YES'): number | null => {
        // Flow calculation requires async data fetching
        // For synchronous version, return null and handle async in alert evaluation
        // This will fall back to the async calculation in getValueForCondition
        return null;
      },
    };

    alertSystem.setDataFetcher(syncDataFetcher);
  }, [dataFetcher]);

  return {
    alertSystem,
    dataFetcher,
  };
}

/**
 * Enhanced version that calculates flow asynchronously
 * This can be used in the alert evaluation if needed
 */
export async function getFlowForMarket(
  marketId: string,
  outcome: 'YES' | 'NO' = 'YES'
): Promise<number> {
  try {
    const trades = await polymarketClient.getTrades(marketId, {
      limit: 100,
    });

    if (!trades || trades.length === 0) {
      return 0;
    }

    const relevantTrades = trades.filter((trade) => trade.outcome === outcome);
    const recentTrades = relevantTrades.slice(0, 20);
    
    // Calculate net flow: sum of trade amounts weighted by recency
    const now = Date.now();
    let flow = 0;
    
    recentTrades.forEach((trade) => {
      const age = now - trade.timestamp * 1000;
      const weight = Math.max(0, 1 - age / (60 * 60 * 1000)); // Decay over 1 hour
      const amount = parseFloat(trade.amount || '0');
      flow += amount * weight;
    });

    return flow;
  } catch (error) {
    console.error('[getFlowForMarket] Error:', error);
    return 0;
  }
}

