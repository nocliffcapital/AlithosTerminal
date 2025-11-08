'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Address } from 'viem';

export interface Order {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  side: 'buy' | 'sell';
  status: 'open' | 'filled' | 'cancelled' | 'partially_filled';
  amount: string;
  filledAmount?: string;
  price: number;
  createdAt: string;
  updatedAt?: string;
  filledAt?: string;
  cancelledAt?: string;
  transactionHash?: string;
}

export interface OrderHistoryParams {
  status?: 'open' | 'filled' | 'cancelled' | 'all';
  limit?: number;
  offset?: number;
}

/**
 * Hook to fetch user's orders
 */
export function useOrders(params?: OrderHistoryParams) {
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  const status = params?.status || 'all';
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  return useQuery({
    queryKey: ['orders', walletAddress, status, limit, offset],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const searchParams = new URLSearchParams({
        status,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/orders?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      return {
        orders: (data.orders || []) as Order[],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || offset,
      };
    },
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes
    refetchInterval: 5 * 60 * 1000, // 5 minutes - real-time updates handle most changes, polling is fallback only
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

/**
 * Hook to fetch a single order by ID
 */
export function useOrder(orderId: string | null) {
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  return useQuery({
    queryKey: ['order', orderId, walletAddress],
    queryFn: async () => {
      if (!orderId || !walletAddress) {
        throw new Error('Order ID and wallet address are required');
      }

      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch order: ${response.status}`);
      }

      const data = await response.json();
      return data.order as Order;
    },
    enabled: !!orderId && !!walletAddress,
    staleTime: 10000,
  });
}

/**
 * Hook to cancel an order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to cancel order: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      // Invalidate orders queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
}

/**
 * Hook to modify an order
 */
export function useModifyOrder() {
  const queryClient = useQueryClient();
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  return useMutation({
    mutationFn: async ({ orderId, price, size }: { orderId: string; price?: number; size?: string }) => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price, size }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to modify order: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      // Invalidate orders queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
}

/**
 * Hook to place a new order
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  return useMutation({
    mutationFn: async (order: {
      marketId: string;
      outcome: 'YES' | 'NO';
      side: 'buy' | 'sell';
      amount: string;
      price: number;
    }) => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to place order: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      // Invalidate orders queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', walletAddress] });
    },
  });
}

