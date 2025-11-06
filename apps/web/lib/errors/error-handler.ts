/**
 * Error handling utilities
 * Provides consistent error handling and user-friendly error messages
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * User-friendly error messages
 */
const errorMessages: Record<string, string> = {
  // Network errors
  'NetworkError': 'Network connection failed. Please check your internet connection.',
  'Failed to fetch': 'Unable to connect to the server. Please try again later.',
  'Network request failed': 'Network error. Please check your connection.',
  
  // Authentication errors
  'Unauthorized': 'You are not authorized to perform this action. Please log in.',
  'Forbidden': 'You do not have permission to access this resource.',
  'Authentication required': 'Please log in to continue.',
  
  // Validation errors
  'Validation error': 'Please check your input and try again.',
  'Invalid input': 'The provided information is invalid.',
  
  // Rate limiting
  'Too many requests': 'Too many requests. Please wait a moment and try again.',
  'Rate limit exceeded': 'Rate limit exceeded. Please slow down your requests.',
  
  // Transaction errors
  'Transaction failed': 'Transaction failed. Please check your wallet and try again.',
  'Insufficient balance': 'Insufficient balance. Please deposit more funds.',
  'Transaction rejected': 'Transaction was rejected. Please try again.',
  'User rejected': 'Transaction was cancelled by user.',
  
  // Database errors
  'Database error': 'Database error occurred. Please try again later.',
  'Not found': 'The requested resource was not found.',
  
  // Generic
  'Unknown error': 'An unexpected error occurred. Please try again.',
};

/**
 * Convert technical error to user-friendly message
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    // Check for exact match
    if (errorMessages[error.message]) {
      return errorMessages[error.message];
    }

    // Check for partial matches
    for (const [key, message] of Object.entries(errorMessages)) {
      if (error.message.includes(key) || error.name.includes(key)) {
        return message;
      }
    }

    // Return error message if it's already user-friendly
    if (error.message && !error.message.includes('Error:') && !error.message.includes('at ')) {
      return error.message;
    }
  }

  if (typeof error === 'string') {
    return errorMessages[error] || error;
  }

  return errorMessages['Unknown error'];
}

/**
 * Extract error details from various error types
 */
export function extractErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: getUserFriendlyError(error),
      code: error.name,
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    return {
      message: getUserFriendlyError(error),
      code: (errorObj.code as string) || 'UnknownError',
      status: (errorObj.status as number) || undefined,
      details: errorObj,
    };
  }

  return {
    message: getUserFriendlyError(error),
    code: 'UnknownError',
  };
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed') ||
      error.name === 'NetworkError'
    );
  }
  return false;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Validation') ||
      error.message.includes('Invalid') ||
      error.name === 'ZodError' ||
      error.name === 'ValidationError'
    );
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Unauthorized') ||
      error.message.includes('Forbidden') ||
      error.message.includes('Authentication') ||
      error.name === 'UnauthorizedError'
    );
  }
  return false;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }

  if (error instanceof Error) {
    // Rate limit errors are retryable after delay
    if (error.message.includes('Too many requests') || error.message.includes('Rate limit')) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return true;
    }
  }

  return false;
}

/**
 * Get retry delay for error (exponential backoff)
 */
export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

