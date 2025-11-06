'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export interface JournalEntry {
  id: string;
  userId: string;
  marketId: string | null;
  timestamp: string;
  note: string;
  attachments: Record<string, unknown> | null;
  postMortem: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryParams {
  marketId?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Hook to fetch journal entries
 */
export function useJournalEntries(params?: JournalEntryParams) {
  const { dbUser, isAuthenticated } = useAuth();

  const marketId = params?.marketId;
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;
  const startDate = params?.startDate;
  const endDate = params?.endDate;

  return useQuery({
    queryKey: ['journal', dbUser?.id, marketId, limit, offset, startDate, endDate],
    queryFn: async () => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const searchParams = new URLSearchParams();
      if (marketId) searchParams.append('marketId', marketId);
      searchParams.append('limit', limit.toString());
      searchParams.append('offset', offset.toString());
      if (startDate) searchParams.append('startDate', startDate);
      if (endDate) searchParams.append('endDate', endDate);

      const response = await fetch(`/api/journal?${searchParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch journal entries: ${response.status}`);
      }

      const data = await response.json();
      return {
        entries: (data.entries || []) as JournalEntry[],
        total: data.total || 0,
        limit: data.limit || limit,
        offset: data.offset || offset,
      };
    },
    enabled: isAuthenticated && !!dbUser?.id,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching (React Query v5)
  });
}

/**
 * Hook to fetch a single journal entry
 */
export function useJournalEntry(entryId: string | null) {
  const { dbUser, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['journal-entry', entryId, dbUser?.id],
    queryFn: async () => {
      if (!entryId || !dbUser?.id) {
        throw new Error('Entry ID and user ID are required');
      }

      const response = await fetch(`/api/journal/${entryId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch journal entry: ${response.status}`);
      }

      const data = await response.json();
      return data.entry as JournalEntry;
    },
    enabled: isAuthenticated && !!dbUser?.id && !!entryId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a journal entry
 */
export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      marketId?: string;
      timestamp: string;
      note: string;
      attachments?: Record<string, unknown>;
    }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create journal entry: ${response.status}`);
      }

      const result = await response.json();
      return result.entry as JournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', dbUser?.id] });
    },
  });
}

/**
 * Hook to update a journal entry
 */
export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async ({ entryId, data }: {
      entryId: string;
      data: {
        marketId?: string;
        timestamp?: string;
        note?: string;
        attachments?: Record<string, unknown>;
        postMortem?: Record<string, unknown>;
      };
    }) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/journal/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update journal entry: ${response.status}`);
      }

      const result = await response.json();
      return result.entry as JournalEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', dbUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry'] });
    },
  });
}

/**
 * Hook to delete a journal entry
 */
export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();
  const { dbUser } = useAuth();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!dbUser?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/journal/${entryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete journal entry: ${response.status}`);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', dbUser?.id] });
    },
  });
}

