'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';

interface DatabaseUser {
  id: string;
  privyId: string;
  email: string | null;
  walletAddress: string | null;
}

/**
 * Syncs Privy user to database and returns the database user
 */
export function useAuth() {
  const { user, authenticated, ready } = usePrivy();
  const [dbUser, setDbUser] = useState<DatabaseUser | null>(null);

  const { data: syncedUser, isLoading, error } = useQuery({
    queryKey: ['auth', 'user', user?.id],
    queryFn: async () => {
      if (!user?.id || !authenticated) return null;

      // Sync user to database with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyId: user.id,
            email: user.email?.address || null,
            walletAddress: user.wallet?.address || null,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.details || errorData.error || `Failed to sync user: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.user as DatabaseUser;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timed out - check if the server is running');
        }
        throw error;
      }
    },
    enabled: !!user?.id && authenticated && ready,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on failure - show error instead
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (syncedUser) {
      setDbUser(syncedUser);
    } else if (authenticated && !isLoading && !syncedUser && !error) {
      // If authenticated but no synced user after loading, something went wrong
      // This shouldn't happen, but let's handle it
      console.warn('User authenticated but not synced to database');
    }
  }, [syncedUser, authenticated, isLoading, error]);

  // Only show loading if:
  // 1. Privy isn't ready yet, OR
  // 2. We're authenticated and waiting for the sync to complete
  const isActuallyLoading = !ready || (authenticated && isLoading && !syncedUser && !error);

  return {
    dbUser,
    isLoading: isActuallyLoading,
    isAuthenticated: authenticated && !!dbUser,
    error, // Expose error so we can show it in the UI
  };
}

