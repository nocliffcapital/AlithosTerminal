// Hook for real-time orderbook updates using Real-Time Data Client
// Replaces polling with instant updates

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeClient } from '@/lib/api/realtime-client';
import { useMarket } from './usePolymarketData';
import { useMarketStore } from '@/stores/market-store';

/**
 * Hook to subscribe to real-time orderbook updates
 * @param marketId - Market ID
 * @param outcome - Market outcome ('YES' or 'NO')
 * @returns Unsubscribe function (for cleanup)
 */
export function useRealtimeOrderbook(marketId: string | null, outcome: 'YES' | 'NO') {
  const queryClient = useQueryClient();
  const { data: market } = useMarket(marketId);
  const { setOrderBook } = useMarketStore();

  useEffect(() => {
    if (!marketId || !market) return;

    // Get asset ID for the outcome
    // Try tokens array first, then fallback to clobTokenIds
    let assetId: string | undefined;
    
    if (market.tokens && market.tokens.length > 0) {
      const outcomeToken = market.tokens.find(
        (token) => token.outcome === outcome || token.outcome?.toUpperCase() === outcome.toUpperCase()
      );
      assetId = outcomeToken?.token_id;
    } else if (market.clobTokenIds && market.clobTokenIds.length > 0) {
      // Assume YES is second token, NO is first token (standard Polymarket format)
      assetId = outcome === 'YES' 
        ? market.clobTokenIds[1] || market.clobTokenIds[0]
        : market.clobTokenIds[0] || market.clobTokenIds[1];
    }

    if (!assetId) {
      console.warn(`[useRealtimeOrderbook] No token ID available for market ${marketId}, outcome ${outcome}`);
      return;
    }

    // Connect if not connected
    if (!realtimeClient.isConnected()) {
      realtimeClient.connect();
    }

    // Subscribe to orderbook updates
    const unsubscribe = realtimeClient.subscribeToOrderbook([assetId]);

    // Listen for orderbook messages
    const messageUnsubscribe = realtimeClient.onMessage((message) => {
      if (message.topic === 'clob_market' && message.type === 'agg_orderbook') {
        const payload = message.payload as any;
        
        // Check if this is for our asset
        if (payload.asset_id === assetId || payload.asset_id === assetId.toString()) {
          // Transform to match our orderbook format
          const orderbookData = {
            asks: (payload.asks || []).map((ask: any) => ({
              price: parseFloat(ask.price || '0'),
              size: parseFloat(ask.size || '0'),
            })),
            bids: (payload.bids || []).map((bid: any) => ({
              price: parseFloat(bid.price || '0'),
              size: parseFloat(bid.size || '0'),
            })),
            marketId,
            outcome,
            timestamp: payload.timestamp || Date.now(),
            hash: payload.hash,
          };

          // Update React Query cache
          // useOrderBook uses query key: ['orderbook', marketId, outcome, useL1Auth, walletAddress]
          // React Query will match partial keys, so we update the base key
          queryClient.setQueryData(['orderbook', marketId, outcome], orderbookData);
          
          // Also update the store for consistency
          setOrderBook(marketId, outcome, orderbookData);
        }
      }
    });

    return () => {
      unsubscribe();
      messageUnsubscribe();
    };
  }, [marketId, outcome, market, queryClient, setOrderBook]);
}


