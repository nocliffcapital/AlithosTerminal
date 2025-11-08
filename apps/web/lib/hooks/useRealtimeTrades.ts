// Hook for real-time trade updates using Real-Time Data Client
// Provides instant trade updates without polling

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeClient } from '@/lib/api/realtime-client';
import { useMarket } from './usePolymarketData';

/**
 * Hook to subscribe to real-time trade updates
 * @param marketId - Market ID
 * @returns Unsubscribe function (for cleanup)
 */
export function useRealtimeTrades(marketId: string | null) {
  const queryClient = useQueryClient();
  const { data: market } = useMarket(marketId);

  useEffect(() => {
    if (!marketId || !market) return;

    // Get market identifiers for matching
    const marketSlug = market.slug || marketId;
    const conditionId = market.conditionId || marketId;

    // Connect if not connected
    if (!realtimeClient.isConnected()) {
      realtimeClient.connect();
    }

    // Subscribe to activity trades
    const unsubscribeTrades = realtimeClient.subscribeToActivityTrades(marketSlug);
    
    // Subscribe to orders matched (also shows trades)
    const unsubscribeMatched = realtimeClient.subscribeToOrdersMatched(marketSlug);

    // Listen for trade messages
    const messageUnsubscribe = realtimeClient.onMessage((message) => {
      if (
        (message.topic === 'activity' && message.type === 'trades') ||
        (message.topic === 'activity' && message.type === 'orders_matched')
      ) {
        const payload = message.payload as any;
        
        // Check if this trade is for our market
        // Match by conditionId (most reliable), marketId, or slug
        const tradeConditionId = payload.conditionId || payload.condition || payload.market;
        const tradeMarketId = payload.marketId || payload.market || tradeConditionId;
        const tradeSlug = payload.slug || payload.marketSlug || payload.eventSlug;
        
        const isMatch = 
          tradeConditionId === conditionId ||
          tradeMarketId === marketId ||
          tradeConditionId === marketId ||
          tradeSlug === marketSlug ||
          payload.eventSlug === marketSlug;
        
        if (isMatch) {
          // Parse timestamp (handle both seconds and milliseconds)
          let timestamp = payload.timestamp || payload.match_time || Date.now();
          if (typeof timestamp === 'string') {
            timestamp = parseInt(timestamp);
          }
          // If timestamp is in seconds (less than year 2000 in ms), convert to milliseconds
          if (timestamp < 946684800000) {
            timestamp = timestamp * 1000;
          }
          
          // Transform to match Trade interface format
          const trade = {
            id: payload.transactionHash || payload.id || payload.taker_order_id || `${marketId}-${timestamp}-${Math.random()}`,
            marketId: tradeMarketId || marketId,
            outcome: (payload.outcome || 'YES').toUpperCase() as 'YES' | 'NO',
            amount: payload.size || payload.matched_amount || '0',
            price: parseFloat(payload.price || '0'),
            timestamp: timestamp,
            user: payload.proxyWallet || payload.maker_address || payload.owner || '',
            transactionHash: payload.transactionHash || payload.txHash || '',
          };

          // Update React Query cache - prepend new trade
          queryClient.setQueryData(['trades', marketId], (oldTrades: any[] = []) => {
            // Avoid duplicates by id or transactionHash
            const exists = oldTrades.some((t) => 
              t.id === trade.id || 
              (trade.transactionHash && t.transactionHash === trade.transactionHash)
            );
            if (exists) return oldTrades;
            
            // Prepend and keep latest 100, sorted by timestamp descending
            const updated = [trade, ...oldTrades]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 100);
            return updated;
          });
        }
      }
    });

    return () => {
      unsubscribeTrades();
      unsubscribeMatched();
      messageUnsubscribe();
    };
  }, [marketId, market, queryClient]);
}


