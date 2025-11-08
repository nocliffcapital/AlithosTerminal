'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketStatusBadgeProps {
  endDate?: string | Date;
  active?: boolean;
  archived?: boolean;
  className?: string;
}

/**
 * MarketStatusBadge - Displays market status (Open/Closed) with countdown timer
 */
export function MarketStatusBadge({ 
  endDate, 
  active = true, 
  archived = false,
  className 
}: MarketStatusBadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!endDate) {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    const calculateTimeRemaining = () => {
      const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
      } else {
        setIsExpired(false);
        setTimeRemaining(diff);
      }
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  // Determine market status
  const status = useMemo(() => {
    if (archived) {
      return { label: 'Archived', icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
    
    if (isExpired || (endDate && timeRemaining === 0)) {
      return { label: 'Closed', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' };
    }
    
    if (!active) {
      return { label: 'Inactive', icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    }
    
    return { label: 'Open', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' };
  }, [archived, isExpired, active, endDate, timeRemaining]);

  // Format countdown
  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const Icon = status.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border',
        status.bg,
        status.color,
        isExpired || !active || archived
          ? 'border-red-500/20'
          : 'border-green-500/20'
      )}>
        <Icon className="h-3 w-3" />
        <span>{status.label}</span>
      </div>
      
      {endDate && timeRemaining !== null && !archived && (
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border',
          isExpired 
            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
            : timeRemaining < 24 * 60 * 60 * 1000
            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            : 'bg-transparent text-foreground border-border/50'
        )}>
          <Clock className="h-3 w-3" />
          <span>{formatCountdown(timeRemaining)}</span>
        </div>
      )}
    </div>
  );
}

