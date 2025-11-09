'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  alertName: string;
  triggeredAt: string;
  createdAt: string;
  marketId?: string;
  conditionsSnapshot?: any[];
}

export interface AlertHistoryParams {
  alertId?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook to fetch alert trigger history
 */
export function useAlertHistory(params?: AlertHistoryParams) {
  const { dbUser, isAuthenticated } = useAuth();

  const alertId = params?.alertId;
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;
  const startDate = params?.startDate;
  const endDate = params?.endDate;

  return useQuery({
    queryKey: ['alert-history', dbUser?.id, alertId, limit, offset, startDate, endDate],
    queryFn: async () => {
      if (!dbUser) {
        throw new Error('User not authenticated');
      }

      const searchParams = new URLSearchParams();
      if (alertId) searchParams.append('alertId', alertId);
      searchParams.append('limit', limit.toString());
      searchParams.append('offset', offset.toString());
      if (startDate) searchParams.append('startDate', startDate);
      if (endDate) searchParams.append('endDate', endDate);

      const response = await fetch(`/api/alerts/history?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch alert history: ${response.status}`);
      }

      const data = await response.json();
      return {
        history: (data.history || []) as AlertHistoryEntry[],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || offset,
      };
    },
    enabled: isAuthenticated && !!dbUser,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

