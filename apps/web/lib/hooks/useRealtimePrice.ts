// Hook for real-time price updates using Real-Time Data Client
// Provides instant price change notifications

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeClient } from '@/lib/api/realtime-client';
import { useMarket } from './usePolymarketData';
import { useMarketStore } from '@/stores/market-store';

/**
 * Hook to subscribe to real-time price changes
 * @param marketId - Market ID
 * @param outcome - Market outcome ('YES' or 'NO')
 * @returns Unsubscribe function (for cleanup)
 */
export function useRealtimePrice(marketId: string | null, outcome: 'YES' | 'NO') {
  const queryClient = useQueryClient();
  const { data: market } = useMarket(marketId);
  const { setMarketPrice } = useMarketStore();

  useEffect(() => {
    if (!marketId || !market) return;

    // Get asset IDs for both outcomes (we need both for price changes)
    // Try tokens array first, then fallback to clobTokenIds
    let assetIds: string[] = [];
    
    if (market.tokens && market.tokens.length > 0) {
      assetIds = market.tokens
        .map((token) => token.token_id)
        .filter((id): id is string => !!id);
    } else if (market.clobTokenIds && market.clobTokenIds.length > 0) {
      assetIds = market.clobTokenIds.filter((id): id is string => !!id);
    }

    if (assetIds.length === 0) {
      console.warn(`[useRealtimePrice] No token IDs available for market ${marketId}`);
      return;
    }

    // Connect if not connected
    if (!realtimeClient.isConnected()) {
      realtimeClient.connect();
    }

    // Subscribe to price changes
    const unsubscribePriceChanges = realtimeClient.subscribeToPriceChanges(assetIds);
    
    // Subscribe to last trade price
    const unsubscribeLastTrade = realtimeClient.subscribeToLastTradePrice(assetIds);

    // Listen for price messages
    const messageUnsubscribe = realtimeClient.onMessage((message) => {
      if (message.topic === 'clob_market') {
        if (message.type === 'price_change') {
          const payload = message.payload as any;
          
          // Find price change for our outcome
          const priceChanges = payload.price_changes || payload.pc || [];
          
          // Get token ID for the outcome
          let outcomeTokenId: string | undefined;
          if (market.tokens && market.tokens.length > 0) {
            const outcomeToken = market.tokens.find(
              (token) => token.outcome === outcome || token.outcome?.toUpperCase() === outcome.toUpperCase()
            );
            outcomeTokenId = outcomeToken?.token_id;
          } else if (market.clobTokenIds && market.clobTokenIds.length > 0) {
            // Assume YES is second token, NO is first token (standard Polymarket format)
            outcomeTokenId = outcome === 'YES' 
              ? market.clobTokenIds[1] || market.clobTokenIds[0]
              : market.clobTokenIds[0] || market.clobTokenIds[1];
          }

          if (!outcomeTokenId) return;

          const priceChange = priceChanges.find(
            (pc: any) => pc.asset_id === outcomeTokenId || pc.a === outcomeTokenId
          );

          if (priceChange) {
            const price = parseFloat(priceChange.price || priceChange.p || '0');
            const bestBid = parseFloat(priceChange.best_bid || priceChange.bb || '0');
            const bestAsk = parseFloat(priceChange.best_ask || priceChange.ba || '0');

            // Update market price in cache (use correct query key)
            queryClient.setQueryData(['market-price', marketId], (old: any) => {
              const priceData = {
                ...(old || {}),
                marketId,
                outcome,
                price,
                probability: price * 100,
                bestBid,
                bestAsk,
                timestamp: payload.timestamp || Date.now(),
                dataUpdatedAt: new Date().toISOString(),
              };
              setMarketPrice(marketId, priceData);
              return priceData;
            });
          }
        } else if (message.type === 'last_trade_price') {
          const payload = message.payload as any;
          
          // Get token ID for the outcome
          let outcomeTokenId: string | undefined;
          if (market.tokens && market.tokens.length > 0) {
            const outcomeToken = market.tokens.find(
              (token) => token.outcome === outcome || token.outcome?.toUpperCase() === outcome.toUpperCase()
            );
            outcomeTokenId = outcomeToken?.token_id;
          } else if (market.clobTokenIds && market.clobTokenIds.length > 0) {
            outcomeTokenId = outcome === 'YES' 
              ? market.clobTokenIds[1] || market.clobTokenIds[0]
              : market.clobTokenIds[0] || market.clobTokenIds[1];
          }

          if (!outcomeTokenId) return;

          if (payload.asset_id === outcomeTokenId || payload.asset_id === outcomeTokenId.toString()) {
            const price = parseFloat(payload.price || '0');

            // Update last trade price
            queryClient.setQueryData(['lastTradePrice', marketId, outcome], {
              price,
              size: parseFloat(payload.size || '0'),
              side: payload.side,
              timestamp: Date.now(),
            });

            // Also update market price (use correct query key)
            queryClient.setQueryData(['market-price', marketId], (old: any) => {
              const priceData = {
                ...(old || {}),
                marketId,
                outcome,
                price,
                probability: price * 100,
                timestamp: Date.now(),
                dataUpdatedAt: new Date().toISOString(),
              };
              setMarketPrice(marketId, priceData);
              return priceData;
            });
          }
        }
      }
    });

    return () => {
      unsubscribePriceChanges();
      unsubscribeLastTrade();
      messageUnsubscribe();
    };
  }, [marketId, outcome, market, queryClient, setMarketPrice]);
}


