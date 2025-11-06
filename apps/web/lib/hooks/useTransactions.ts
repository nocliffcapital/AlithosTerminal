'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { usePrivy } from '@privy-io/react-auth';
import { Address } from 'viem';

export interface Transaction {
  id: string;
  type: 'trade' | 'deposit' | 'withdraw' | 'onchain';
  hash: string;
  timestamp: string;
  from?: Address;
  to?: Address;
  value?: string;
  token?: string;
  status: 'confirmed' | 'pending' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  explorerUrl: string;
  marketId?: string;
  outcome?: 'YES' | 'NO';
  amount?: string;
  price?: number;
}

export interface TransactionHistoryParams {
  walletAddress?: Address;
  limit?: number;
  offset?: number;
  type?: 'trade' | 'deposit' | 'withdraw' | 'all';
}

/**
 * Hook to fetch transaction history
 */
export function useTransactions(params?: TransactionHistoryParams) {
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  // Get wallet address from various sources
  const walletAddress = params?.walletAddress || 
    (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  const limit = params?.limit || 50;
  const offset = params?.offset || 0;
  const type = params?.type || 'all';

  return useQuery({
    queryKey: ['transactions', walletAddress, limit, offset, type],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const searchParams = new URLSearchParams({
        walletAddress,
        limit: limit.toString(),
        offset: offset.toString(),
        type,
      });

      const response = await fetch(`/api/transactions?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch transactions: ${response.status}`);
      }

      const data = await response.json();
      return {
        transactions: (data.transactions || []) as Transaction[],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || offset,
      };
    },
    enabled: !!walletAddress,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

/**
 * Hook to fetch a single transaction by hash
 */
export function useTransaction(txHash: string | null) {
  const { user } = usePrivy();
  const { dbUser } = useAuth();

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  return useQuery({
    queryKey: ['transaction', txHash, walletAddress],
    queryFn: async () => {
      if (!txHash || !walletAddress) {
        throw new Error('Transaction hash and wallet address are required');
      }

      // Fetch all transactions and find the one matching the hash
      const searchParams = new URLSearchParams({
        walletAddress,
        limit: '1000',
        offset: '0',
        type: 'all',
      });

      const response = await fetch(`/api/transactions?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.status}`);
      }

      const data = await response.json();
      const transaction = (data.transactions || []).find((tx: Transaction) => tx.hash === txHash);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction as Transaction;
    },
    enabled: !!txHash && !!walletAddress,
    staleTime: 60000, // 1 minute
  });
}

