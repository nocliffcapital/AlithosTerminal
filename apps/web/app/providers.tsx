'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';
import { useRealtimeConnection } from '@/lib/hooks/useRealtimeConnection';

function RealtimeConnectionProvider({ children }: { children: React.ReactNode }) {
  // Initialize real-time connection globally
  useRealtimeConnection();
  
  // Suppress MetaMask provider conflict errors (harmless when multiple wallet extensions are installed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Suppress MetaMask provider conflict errors and other harmless extension errors
    const errorHandler = (...args: any[]) => {
      try {
        // Convert all arguments to strings and check them
        const allMessages = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg instanceof Error) return arg.message;
          if (arg?.toString) return arg.toString();
          return String(arg);
        }).join(' ');
        
        // Suppress MetaMask provider conflict errors (harmless when multiple wallet extensions are installed)
        // These errors occur when multiple wallet extensions try to set window.ethereum
        if (
          allMessages.includes('MetaMask encountered an error setting the global Ethereum provider') ||
          (allMessages.includes('Cannot set property ethereum') && allMessages.includes('which has only a getter')) ||
          (allMessages.includes('ethereum') && allMessages.includes('getter') && allMessages.includes('TypeError'))
        ) {
          // Suppress this specific error - it's harmless when multiple wallet extensions are installed
          return;
        }
        
        // Suppress CORS errors from Privy analytics (expected in development)
        if (
          allMessages.includes('auth.privy.io') &&
          allMessages.includes('CORS') &&
          allMessages.includes('analytics_events')
        ) {
          // Suppress Privy analytics CORS errors - expected in development
          return;
        }
        
        // Suppress CSP report errors (blocked by ad blockers, harmless)
        if (
          allMessages.includes('csp-report') ||
          allMessages.includes('ERR_BLOCKED_BY_CLIENT')
        ) {
          // Suppress CSP report errors - blocked by ad blockers, harmless
          return;
        }
        
        // Always log other errors
        originalError.apply(console, args);
      } catch (e) {
        // If error handler fails, fall back to original
        originalError.apply(console, args);
      }
    };
    
    // Suppress runtime.lastError warnings from extensions
    const warnHandler = (...args: any[]) => {
      try {
        const firstArg = args[0];
        let message = '';
        
        // Convert all arguments to strings and check them
        const allMessages = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg instanceof Error) return arg.message;
          if (arg?.toString) return arg.toString();
          return String(arg);
        }).join(' ');
        
        if (typeof firstArg === 'string') {
          message = firstArg;
        } else if (firstArg?.toString) {
          message = firstArg.toString();
        }
        
        // Suppress Lit dev mode warnings (harmless, just a development notice)
        if (
          allMessages.includes('Lit is in dev mode') ||
          allMessages.includes('lit.dev/msg/dev-mode') ||
          message.includes('Lit is in dev mode')
        ) {
          // Suppress Lit dev mode warning - it's just a development notice
          return;
        }
        
        // Only suppress specific extension communication errors
        if (
          message.includes('runtime.lastError') ||
          message.includes('Receiving end does not exist')
        ) {
          // Suppress extension communication errors - they're harmless
          return;
        }
        
        // Always log other warnings
        originalWarn.apply(console, args);
      } catch (e) {
        // If warn handler fails, fall back to original
        originalWarn.apply(console, args);
      }
    };
    
    console.error = errorHandler;
    console.warn = warnHandler;
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);
  
  return <>{children}</>;
}

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
      >
        <QueryClientProvider client={queryClient}>
          <RealtimeConnectionProvider>
            {children}
            <ToastContainer />
          </RealtimeConnectionProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ErrorBoundary>
  );
}
