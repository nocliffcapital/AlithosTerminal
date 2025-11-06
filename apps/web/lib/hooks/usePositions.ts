'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { polymarketClient } from '@/lib/api/polymarket';

export interface PositionWithPnL {
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  costBasis: number;
  currentValue: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  entryPrice?: number;
  currentPrice?: number;
  market?: {
    question: string;
    slug: string;
    endDate?: string;
  };
}

/**
 * Hook to fetch user positions with real-time P&L calculation
 * Uses API route which aggregates data from Data-API and P&L subgraph
 */
export function usePositions(includeMarket: boolean = true) {
  const { user, authenticated } = usePrivy();
  
  // Get wallet address from user
  const walletAddress = user?.wallet?.address || (user as any)?.linkedAccounts?.find(
    (acc: any) => acc.type === 'wallet' && acc.address
  )?.address;

  return useQuery({
    queryKey: ['positions', walletAddress, includeMarket],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('No wallet address available');
      }

      // Fetch from API route (which aggregates from multiple sources)
      const response = await fetch(
        `/api/positions?userAddress=${encodeURIComponent(walletAddress)}&includeMarket=${includeMarket}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to fetch positions: ${response.status}`);
      }

      const data = await response.json();
      return (data.positions || []) as PositionWithPnL[];
    },
    enabled: authenticated && !!walletAddress,
    staleTime: 10000, // 10 seconds - positions change frequently
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnMount: true,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to calculate total P&L across all positions
 */
export function useTotalPnL() {
  const { data: positions, isLoading } = usePositions(false);

  const totals = {
    totalCostBasis: 0,
    totalCurrentValue: 0,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    totalPnL: 0,
    positionCount: 0,
  };

  if (positions && positions.length > 0) {
    positions.forEach((pos) => {
      totals.totalCostBasis += pos.costBasis || 0;
      totals.totalCurrentValue += pos.currentValue || 0;
      totals.totalRealizedPnL += pos.realizedPnL || 0;
      totals.totalUnrealizedPnL += pos.unrealizedPnL || 0;
      totals.positionCount += 1;
    });
    
    totals.totalPnL = totals.totalRealizedPnL + totals.totalUnrealizedPnL;
  }

  return {
    ...totals,
    isLoading,
    positions: positions || [],
  };
}

/**
 * Hook to get position for a specific market
 */
export function usePosition(marketId: string | null) {
  const { data: positions, isLoading } = usePositions(true);

  if (!marketId || !positions) {
    return { position: null, isLoading };
  }

  const position = positions.find((p) => p.marketId === marketId);
  return { position: position || null, isLoading };
}

