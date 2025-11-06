'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes default stale time (increased from 2)
            gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (increased from 10)
            refetchOnWindowFocus: false,
            retry: 1,
            // Enable query deduplication for simultaneous requests
            refetchOnMount: false, // Don't refetch if data is fresh
            placeholderData: (previousData: any) => previousData, // Keep previous data while fetching new data (React Query v5)
          },
        },
      })
  );

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Debug: log Privy App ID (only in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Privy App ID:', privyAppId ? 'Found' : 'Missing');
  }

  // If Privy app ID is not set, show a setup message
  if (!privyAppId || privyAppId === 'your-privy-app-id') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold mb-4 flex flex-col items-center" style={{ lineHeight: '1' }}>
              <span className="flex items-center gap-0" style={{ lineHeight: '1' }}>
                <span className="text-foreground">alith</span>
                <span className="text-orange-500">os</span>
              </span>
              <span className="text-base opacity-50" style={{ lineHeight: '1', marginTop: '-4px', letterSpacing: '0.3em' }}>terminal</span>
              {' '}Setup
            </h1>
            <p className="text-muted-foreground mb-4">
              Please configure your Privy App ID in <code className="bg-muted px-1 py-0.5 rounded text-xs">apps/web/.env.local</code>
            </p>
            <div className="bg-muted p-4 rounded text-left text-sm space-y-2">
              <p className="font-medium">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Get your App ID from{' '}
                  <a href="https://dashboard.privy.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Privy Dashboard
                  </a>
                </li>
                <li>Open <code className="bg-background px-1">apps/web/.env.local</code></li>
                <li>Set <code className="bg-background px-1">NEXT_PUBLIC_PRIVY_APP_ID</code> to your App ID</li>
                <li>Restart the dev server</li>
              </ol>
            </div>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <ErrorBoundary>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ['email', 'wallet'],
          appearance: {
            theme: 'dark',
            accentColor: '#667eea',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
        onError={(error) => {
          console.error('[PrivyProvider] Error:', error);
        }}
      >
        <QueryClientProvider client={queryClient}>
          {children}
          <ToastContainer />
        </QueryClientProvider>
      </PrivyProvider>
    </ErrorBoundary>
  );
}
