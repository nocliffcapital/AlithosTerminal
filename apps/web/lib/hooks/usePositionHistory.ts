'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Address } from 'viem';

export interface PositionHistoryEntry {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  entryTimestamp: string;
  exitTimestamp?: string;
  entryPrice: number;
  exitPrice?: number;
  entryAmount: bigint;
  exitAmount?: bigint;
  duration?: number; // in seconds
  pnl?: number;
  pnlPercentage?: number;
  status: 'open' | 'closed';
}

export interface PositionHistoryParams {
  marketId?: string;
  outcome?: 'YES' | 'NO';
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook to fetch position history
 */
export function usePositionHistory(params?: PositionHistoryParams) {
  const { user } = usePrivy();
  const { dbUser, isAuthenticated } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  const marketId = params?.marketId;
  const outcome = params?.outcome;
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;
  const startDate = params?.startDate;
  const endDate = params?.endDate;

  return useQuery({
    queryKey: ['position-history', walletAddress, marketId, outcome, limit, offset, startDate, endDate],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const searchParams = new URLSearchParams();
      if (marketId) searchParams.append('marketId', marketId);
      if (outcome) searchParams.append('outcome', outcome);
      searchParams.append('limit', limit.toString());
      searchParams.append('offset', offset.toString());
      if (startDate) searchParams.append('startDate', startDate);
      if (endDate) searchParams.append('endDate', endDate);

      const response = await fetch(`/api/positions/history?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch position history: ${response.status}`);
      }

      const data = await response.json();
      return {
        history: (data.history || []) as PositionHistoryEntry[],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || offset,
      };
    },
    enabled: isAuthenticated && !!walletAddress,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

