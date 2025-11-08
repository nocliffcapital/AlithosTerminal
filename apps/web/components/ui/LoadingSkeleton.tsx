'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Loading skeleton component for showing loading states
 * Provides consistent skeleton UI across the application
 */
export function LoadingSkeleton({
  className,
  variant = 'default',
  width,
  height,
  animation = 'pulse',
}: LoadingSkeletonProps) {
  const baseClasses = 'bg-muted rounded';
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-[wave_1.6s_ease-in-out_infinite]',
    none: '',
  };

  const variantClasses = {
    default: 'rounded',
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
    />
  );
}

/**
 * Skeleton group for multiple skeleton items
 */
interface SkeletonGroupProps {
  count?: number;
  className?: string;
  itemClassName?: string;
  variant?: LoadingSkeletonProps['variant'];
  spacing?: 'sm' | 'md' | 'lg';
}

export function SkeletonGroup({
  count = 3,
  className,
  itemClassName,
  variant = 'default',
  spacing = 'md',
}: SkeletonGroupProps) {
  const spacingClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  };

  return (
    <div className={cn('flex flex-col', spacingClasses[spacing], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          variant={variant}
          className={itemClassName}
        />
      ))}
    </div>
  );
}

