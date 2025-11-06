'use client';

import { useCallback } from 'react';
import { extractErrorDetails, getUserFriendlyError, isRetryableError } from '@/lib/errors/error-handler';

/**
 * Hook for handling errors in components
 * Provides utilities for error handling and user feedback
 */
export function useErrorHandler() {
  const handleError = useCallback((error: unknown, onError?: (message: string) => void) => {
    const errorDetails = extractErrorDetails(error);
    const userMessage = getUserFriendlyError(error);

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[useErrorHandler] Error:', error);
      console.error('[useErrorHandler] Error details:', errorDetails);
    }

    // Call optional error handler (e.g., show toast)
    if (onError) {
      onError(userMessage);
    } else {
      // Default: log to console
      console.error('[useErrorHandler]', userMessage);
    }

    return {
      message: userMessage,
      details: errorDetails,
      retryable: isRetryableError(error),
    };
  }, []);

  return { handleError };
}

