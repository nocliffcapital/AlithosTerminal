'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for catching React errors
 * Provides graceful error handling with user-friendly UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Error caught:', error);
      console.error('[ErrorBoundary] Error info:', errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // In production, you might want to send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if resetKeys change
    if (hasError && resetKeys && resetKeys.length > 0) {
      const hasResetKeyChanged = resetKeys.some((key, index) => {
        return prevProps.resetKeys?.[index] !== key;
      });

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    // Reset error boundary if props change significantly
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="mb-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground max-w-md">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-left max-w-2xl w-full">
              <div className="text-sm font-mono text-destructive mb-2">
                {this.state.error.name}: {this.state.error.message}
              </div>
              {this.state.errorInfo && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer mb-2">Stack trace</summary>
                  <pre className="overflow-auto p-2 bg-background rounded">
                    {this.state.error.stack}
                  </pre>
                  <details className="mt-2">
                    <summary className="cursor-pointer mb-2">Component stack</summary>
                    <pre className="overflow-auto p-2 bg-background rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                </details>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={this.resetErrorBoundary} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/';
              }}
              variant="outline"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to manually trigger error boundary
 * Useful for async error handling
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // Re-throw error to be caught by error boundary
    // This works because React will re-render the component tree
    // and the error boundary will catch it
    throw error;
  };
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

