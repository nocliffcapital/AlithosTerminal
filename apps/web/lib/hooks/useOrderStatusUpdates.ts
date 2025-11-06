'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { polymarketWS } from '@/lib/api/websocket';
import { Order } from './useOrders';

/**
 * Hook to subscribe to real-time order status updates via WebSocket
 */
export function useOrderStatusUpdates(orderId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orderId || !polymarketWS.isConnected()) {
      return;
    }

    // Subscribe to order updates
    const unsubscribe = polymarketWS.subscribe('order', (data: any) => {
      // Check if this update is for our order
      if (data.orderId === orderId || data.id === orderId) {
        // Update the order in React Query cache
        queryClient.setQueryData(['order', orderId], (oldData: Order | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            status: data.status || oldData.status,
            filledAmount: data.filledAmount || oldData.filledAmount,
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
        });

        // Also invalidate orders list to refresh
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [orderId, queryClient]);
}

/**
 * Hook to subscribe to all order status updates for a user
 */
export function useAllOrderStatusUpdates(walletAddress: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!walletAddress || !polymarketWS.isConnected()) {
      return;
    }

    // Subscribe to all order updates
    const unsubscribe = polymarketWS.subscribe('order', (data: any) => {
      // Check if this order belongs to the user
      if (data.userAddress === walletAddress || data.walletAddress === walletAddress) {
        // Update the specific order in cache
        if (data.orderId || data.id) {
          queryClient.setQueryData(['order', data.orderId || data.id], (oldData: Order | undefined) => {
            if (!oldData) {
              // If order not in cache, create a new order object
              return {
                id: data.orderId || data.id,
                marketId: data.marketId || '',
                outcome: data.outcome || 'YES',
                side: data.side || 'buy',
                amount: data.amount || '0',
                filledAmount: data.filledAmount || '0',
                price: data.price || 0,
                status: data.status || 'open',
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                transactionHash: data.transactionHash || null,
              } as Order;
            }

            return {
              ...oldData,
              status: data.status || oldData.status,
              filledAmount: data.filledAmount || oldData.filledAmount,
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
          });
        }

        // Invalidate orders list to refresh
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [walletAddress, queryClient]);
}

