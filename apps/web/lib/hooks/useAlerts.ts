'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { Alert, AlertCondition, AlertAction } from '@/lib/alerts/alert-system';

/**
 * Hook to fetch all alerts for the current user
 */
export function useAlerts(active?: boolean) {
  const { dbUser, isAuthenticated } = useAuth();
  
  // Get user ID from database user
  const userId = dbUser?.id;

  return useQuery({
    queryKey: ['alerts', userId, active],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const params = new URLSearchParams({ userId });
      if (active !== undefined) {
        params.append('active', String(active));
      }

      const response = await fetch(`/api/alerts?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to fetch alerts: ${response.status}`);
      }

      const data = await response.json();
      return (data.alerts || []) as Alert[];
    },
    enabled: isAuthenticated && !!userId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnMount: true,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single alert by ID
 */
export function useAlert(alertId: string | null) {
  const { dbUser, isAuthenticated } = useAuth();
  const userId = dbUser?.id;

  return useQuery({
    queryKey: ['alert', alertId, userId],
    queryFn: async () => {
      if (!alertId || !userId) {
        throw new Error('Alert ID and user ID required');
      }

      const response = await fetch(`/api/alerts/${alertId}?userId=${userId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to fetch alert: ${response.status}`);
      }

      const data = await response.json();
      return data.alert as Alert;
    },
    enabled: isAuthenticated && !!alertId && !!userId,
    staleTime: 10000,
    retry: 2,
  });
}

/**
 * Hook to create a new alert
 */
export function useCreateAlert() {
  const { dbUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const userId = dbUser?.id;

  return useMutation({
    mutationFn: async (alert: {
      name: string;
      marketId?: string;
      conditions: AlertCondition[];
      actions: AlertAction[];
      isActive?: boolean;
      cooldownPeriodMinutes?: number;
    }) => {
      if (!userId || !isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...alert,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to create alert: ${response.status}`);
      }

      const data = await response.json();
      return data.alert as Alert;
    },
    onSuccess: () => {
      // Invalidate alerts query
      queryClient.invalidateQueries({ queryKey: ['alerts', userId] });
    },
  });
}

/**
 * Hook to update an alert
 */
export function useUpdateAlert() {
  const { dbUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const userId = dbUser?.id;

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      marketId?: string;
      conditions?: AlertCondition[];
      actions?: AlertAction[];
      isActive?: boolean;
    }) => {
      if (!userId || !isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to update alert: ${response.status}`);
      }

      const data = await response.json();
      return data.alert as Alert;
    },
    onSuccess: (_, variables) => {
      // Invalidate alerts query and specific alert query
      queryClient.invalidateQueries({ queryKey: ['alerts', userId] });
      queryClient.invalidateQueries({ queryKey: ['alert', variables.id, userId] });
    },
  });
}

/**
 * Hook to delete an alert
 */
export function useDeleteAlert() {
  const { dbUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const userId = dbUser?.id;

  return useMutation({
    mutationFn: async (alertId: string) => {
      if (!userId || !isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/alerts/${alertId}?userId=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to delete alert: ${response.status}`);
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate alerts query
      queryClient.invalidateQueries({ queryKey: ['alerts', userId] });
    },
  });
}

/**
 * Hook to update alert trigger timestamp
 */
export function useTriggerAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/trigger`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to update trigger: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    onSuccess: (_, alertId) => {
      // Invalidate alerts query to refresh lastTriggered
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert', alertId] });
    },
  });
}

