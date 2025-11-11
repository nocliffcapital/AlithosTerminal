'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load AnomalyDetailFlyout to avoid SSR issues
const AnomalyDetailFlyout = dynamic(
  () => import('./AnomalyDetailFlyout').then(mod => ({ default: mod.AnomalyDetailFlyout })),
  { ssr: false }
);

export function AnomalyDetailFlyoutWrapper() {
  return (
    <ErrorBoundary>
      <AnomalyDetailFlyout />
    </ErrorBoundary>
  );
}

