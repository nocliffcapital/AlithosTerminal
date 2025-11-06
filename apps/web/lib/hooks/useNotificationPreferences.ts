'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationPreferences } from '@/lib/types/notification-preferences';

/**
 * Hook to fetch user's notification preferences
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/user/preferences');
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      const data = await response.json();
      return data.preferences as NotificationPreferences;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to update user's notification preferences
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notification preferences');
      }

      const data = await response.json();
      return data.preferences as NotificationPreferences;
    },
    onSuccess: () => {
      // Invalidate and refetch preferences
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

