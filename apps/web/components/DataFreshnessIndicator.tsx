'use client';

import React from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataFreshnessIndicatorProps {
  timestamp: number | Date | string | null;
  thresholdSeconds?: number; // Data is considered stale after this many seconds
  showAge?: boolean; // Show "X seconds ago" text
  className?: string;
}

export function DataFreshnessIndicator({ 
  timestamp, 
  thresholdSeconds = 30,
  showAge = true,
  className 
}: DataFreshnessIndicatorProps) {
  if (!timestamp) {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <AlertCircle className="h-3 w-3 text-red-400" />
        {showAge && <span>No data</span>}
      </div>
    );
  }

  const now = Date.now();
  const dataTime = typeof timestamp === 'string' 
    ? new Date(timestamp).getTime() 
    : timestamp instanceof Date 
    ? timestamp.getTime() 
    : timestamp;
  
  const ageSeconds = Math.floor((now - dataTime) / 1000);
  const isStale = ageSeconds > thresholdSeconds;
  const isVeryStale = ageSeconds > thresholdSeconds * 2;

  const formatAge = () => {
    if (ageSeconds < 1) return 'Just now';
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    const minutes = Math.floor(ageSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusColor = () => {
    if (isVeryStale) return 'text-red-400';
    if (isStale) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getIcon = () => {
    if (isVeryStale) return <AlertCircle className="h-3 w-3 text-red-400" />;
    if (isStale) return <Clock className="h-3 w-3 text-yellow-400" />;
    return <CheckCircle2 className="h-3 w-3 text-green-400" />;
  };

  return (
    <div className={cn('flex items-center gap-1 text-xs', getStatusColor(), className)}>
      {getIcon()}
      {showAge && <span>{formatAge()}</span>}
    </div>
  );
}

