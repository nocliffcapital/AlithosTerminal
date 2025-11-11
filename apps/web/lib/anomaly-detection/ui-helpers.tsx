'use client';

/**
 * Shared UI helper functions for anomaly detection components
 * 
 * Provides centralized logic for icons, colors, categorization, and formatting
 * to ensure consistency across ActivityScannerCard, GlobalHeatScannerCard, and AnomalyDetailFlyout.
 */

import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Flame, Activity } from 'lucide-react';
import type { AnomalyType, Severity, AnomalyDetectionConfig } from './types';
import { getSeverityBand } from './scoring';

/**
 * Get icon component for an anomaly type
 */
export function getActivityIcon(type: AnomalyType): React.ReactElement {
  switch (type) {
    case 'volume-spike':
      return <TrendingUp className="h-3 w-3" />;
    case 'flow-imbalance':
      return <TrendingDown className="h-3 w-3" />;
    case 'price-jump':
    case 'breakout':
      return <Activity className="h-3 w-3" />;
    case 'volatility-spike':
      return <Flame className="h-3 w-3" />;
    case 'whale-trade':
    case 'wallet-concentration':
    case 'new-wallet-impact':
      return <AlertTriangle className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
}

/**
 * Get CSS classes for severity level
 */
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'extreme':
      return 'text-red-500 bg-red-500/20 border-red-500/30';
    case 'high':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    default:
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  }
}

/**
 * Get anomaly category for filtering
 */
export function getAnomalyCategory(
  type: AnomalyType
): 'volume-flow' | 'price-vol' | 'liquidity' | 'participants' | 'other' {
  switch (type) {
    case 'volume-spike':
    case 'flow-imbalance':
      return 'volume-flow';
    case 'price-jump':
    case 'volatility-spike':
    case 'breakout':
      return 'price-vol';
    case 'spread-widening':
    case 'spread-tightening':
    case 'depth-change':
    case 'slippage-change':
      return 'liquidity';
    case 'whale-trade':
    case 'wallet-concentration':
    case 'new-wallet-impact':
      return 'participants';
    default:
      return 'other';
  }
}

/**
 * Format timestamp as relative time for recent events
 * Shows "Xs ago", "Xm ago", "Xh ago" for events < 1 hour
 * Falls back to toLocaleTimeString() for older events
 */
export function formatRelativeTime(timestamp: number, now: number): string {
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  // For events less than 1 hour old, show relative time
  if (diffHours < 1) {
    if (diffMinutes < 1) {
      return `${diffSeconds}s ago`;
    }
    return `${diffMinutes}m ago`;
  }

  // For events less than 24 hours old, show hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // For older events, show formatted time
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get CSS color class for heat score
 */
export function getHeatScoreColor(
  score: number,
  config: AnomalyDetectionConfig
): string {
  const band = getSeverityBand(score, config);
  switch (band) {
    case 'on-fire':
      return 'text-red-500';
    case 'hot':
      return 'text-orange-500';
    case 'mild':
      return 'text-yellow-500';
    default:
      return 'text-muted-foreground';
  }
}

