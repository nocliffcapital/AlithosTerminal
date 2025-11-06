'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { ThemeConfig } from '@/stores/theme-store';

export interface Theme {
  id: string;
  userId: string;
  name: string;
  config: ThemeConfig;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to fetch user's themes
 */
export function useThemes(isPublic?: boolean) {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['themes', dbUser?.id, isPublic],
    queryFn: async () => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const searchParams = new URLSearchParams();
      if (isPublic !== undefined) {
        searchParams.append('isPublic', String(isPublic));
      }

      const response = await fetch(`/api/themes?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch themes: ${response.status}`);
      }

      const data = await response.json();
      return (data.themes || []) as Theme[];
    },
    enabled: isAuthenticated && !!dbUser?.id,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

/**
 * Hook to fetch a single theme
 */
export function useTheme(themeId: string | null) {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['theme', themeId, dbUser?.id],
    queryFn: async () => {
      if (!themeId || !dbUser?.id) {
        throw new Error('Theme ID and user ID are required');
      }

      const response = await fetch(`/api/themes/${themeId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch theme: ${response.status}`);
      }

      const data = await response.json();
      return data.theme as Theme;
    },
    enabled: isAuthenticated && !!dbUser?.id && !!themeId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a theme
 */
export function useCreateTheme() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; config: ThemeConfig; isPublic?: boolean }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create theme: ${response.status}`);
      }

      const result = await response.json();
      return result.theme as Theme;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes', dbUser?.id] });
    },
  });
}

/**
 * Hook to update a theme
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ themeId, data }: { themeId: string; data: { name?: string; config?: ThemeConfig; isPublic?: boolean } }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update theme: ${response.status}`);
      }

      const result = await response.json();
      return result.theme as Theme;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['themes', dbUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['theme', variables.themeId] });
    },
  });
}

/**
 * Hook to delete a theme
 */
export function useDeleteTheme() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (themeId: string) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete theme: ${response.status}`);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes', dbUser?.id] });
    },
  });
}

