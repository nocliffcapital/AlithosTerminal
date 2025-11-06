'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-lg max-w-md text-center">
            {error.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-4 mt-4">
            <Button
              variant="outline"
              onClick={reset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

