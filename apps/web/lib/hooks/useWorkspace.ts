'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export function useWorkspaces() {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['workspaces', dbUser?.id],
    queryFn: async () => {
      if (!dbUser?.id) return [];
      const response = await fetch(`/api/workspaces?userId=${dbUser.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Failed to fetch workspaces: ${response.status}`);
      }
      const data = await response.json();
      return data.workspaces || [];
    },
    enabled: isAuthenticated && !!dbUser?.id,
    retry: false, // Don't retry on error - show error instead
    refetchOnWindowFocus: false,
  });
}

export function useCreateWorkspace() {
  const { dbUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, type, templateId }: { name: string; type?: string; templateId?: string }) => {
      if (!dbUser?.id || !isAuthenticated) {
        throw new Error('User not authenticated');
      }
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUser.id, name, type, templateId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to create workspace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', dbUser?.id] });
    },
  });
}

export function useUpdateWorkspace() {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, type, locked }: { id: string; name?: string; type?: string; locked?: boolean }) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, locked }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to update workspace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', dbUser?.id] });
    },
  });
}

export function useToggleWorkspaceLock() {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, locked }: { id: string; locked: boolean }) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to toggle workspace lock');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', dbUser?.id] });
    },
  });
}

export function useDeleteWorkspace() {
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to delete workspace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', dbUser?.id] });
    },
  });
}

