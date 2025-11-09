import { getRetryDelay, isRetryableError } from '@/lib/errors/error-handler';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
  } = options;

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        break;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(getRetryDelay(attempt, baseDelay), maxDelay || 30000);
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts,
  };
}

/**
 * Retry a transaction with exponential backoff
 */
export async function retryTransaction<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  // For transactions, use longer delays and more retries
  return retryWithBackoff(fn, {
    maxRetries: options.maxRetries || 5,
    baseDelay: options.baseDelay || 2000,
    maxDelay: options.maxDelay || 60000,
    ...options,
  });
}

