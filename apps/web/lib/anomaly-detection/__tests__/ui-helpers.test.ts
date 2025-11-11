/**
 * Unit tests for anomaly detection UI helpers
 */

import {
  getAnomalyCategory,
  formatRelativeTime,
} from '../ui-helpers';
import type { AnomalyType } from '../types';

describe('getAnomalyCategory', () => {
  it('should categorize volume-flow anomalies correctly', () => {
    expect(getAnomalyCategory('volume-spike')).toBe('volume-flow');
    expect(getAnomalyCategory('flow-imbalance')).toBe('volume-flow');
  });

  it('should categorize price-vol anomalies correctly', () => {
    expect(getAnomalyCategory('price-jump')).toBe('price-vol');
    expect(getAnomalyCategory('volatility-spike')).toBe('price-vol');
    expect(getAnomalyCategory('breakout')).toBe('price-vol');
  });

  it('should categorize liquidity anomalies correctly', () => {
    expect(getAnomalyCategory('spread-widening')).toBe('liquidity');
    expect(getAnomalyCategory('spread-tightening')).toBe('liquidity');
    expect(getAnomalyCategory('depth-change')).toBe('liquidity');
    expect(getAnomalyCategory('slippage-change')).toBe('liquidity');
  });

  it('should categorize participant anomalies correctly', () => {
    expect(getAnomalyCategory('whale-trade')).toBe('participants');
    expect(getAnomalyCategory('wallet-concentration')).toBe('participants');
    expect(getAnomalyCategory('new-wallet-impact')).toBe('participants');
  });

  it('should return other for unknown types', () => {
    expect(getAnomalyCategory('cross-market-mispricing' as AnomalyType)).toBe('other');
    expect(getAnomalyCategory('pre-expiry-anomaly' as AnomalyType)).toBe('other');
  });
});

describe('formatRelativeTime', () => {
  const now = 1000000000000; // Fixed timestamp for testing

  it('should format seconds ago correctly', () => {
    const timestamp = now - 30 * 1000; // 30 seconds ago
    expect(formatRelativeTime(timestamp, now)).toBe('30s ago');
  });

  it('should format minutes ago correctly', () => {
    const timestamp = now - 5 * 60 * 1000; // 5 minutes ago
    expect(formatRelativeTime(timestamp, now)).toBe('5m ago');
  });

  it('should format hours ago correctly', () => {
    const timestamp = now - 2 * 60 * 60 * 1000; // 2 hours ago
    expect(formatRelativeTime(timestamp, now)).toBe('2h ago');
  });

  it('should format older events with locale time string', () => {
    const timestamp = now - 25 * 60 * 60 * 1000; // 25 hours ago
    const result = formatRelativeTime(timestamp, now);
    // Should not contain 'ago' for events older than 24 hours
    expect(result).not.toContain('ago');
    // Should be a time string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle edge case of exactly 1 hour', () => {
    const timestamp = now - 60 * 60 * 1000; // Exactly 1 hour ago
    expect(formatRelativeTime(timestamp, now)).toBe('1h ago');
  });

  it('should handle edge case of exactly 24 hours', () => {
    const timestamp = now - 24 * 60 * 60 * 1000; // Exactly 24 hours ago
    const result = formatRelativeTime(timestamp, now);
    // Should not contain 'ago' for 24+ hours
    expect(result).not.toContain('ago');
  });
});

