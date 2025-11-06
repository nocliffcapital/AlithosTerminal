'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  title?: string;
  message?: string;
  showDetails?: boolean;
}

/**
 * Compact error fallback component
 * Useful for inline error boundaries (e.g., within cards)
 */
export function ErrorFallback({
  error,
  resetError,
  title = 'Error',
  message = 'An error occurred. Please try again.',
  showDetails = false,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
      <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{message}</p>

      {showDetails && process.env.NODE_ENV === 'development' && (
        <details className="mb-4 text-left w-full max-w-md">
          <summary className="cursor-pointer text-xs text-muted-foreground mb-2">
            Error details
          </summary>
          <pre className="text-xs p-2 bg-muted rounded overflow-auto max-h-32">
            {error.message}
            {error.stack && (
              <>
                {'\n\n'}
                {error.stack}
              </>
            )}
          </pre>
        </details>
      )}

      <Button onClick={resetError} size="sm" variant="outline">
        <RefreshCw className="h-3 w-3 mr-2" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Card error fallback - specific styling for card components
 */
export function CardErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      <X className="h-6 w-6 text-destructive mb-2" />
      <p className="text-xs text-muted-foreground mb-3">
        Failed to load content
      </p>
      <Button onClick={resetError} size="sm" variant="ghost" className="text-xs">
        <RefreshCw className="h-3 w-3 mr-1" />
        Retry
      </Button>
    </div>
  );
}

