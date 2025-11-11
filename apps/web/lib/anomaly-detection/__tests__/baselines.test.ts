/**
 * Tests for baseline statistical computation functions
 */

import {
  computeZScore,
  getPercentile,
  getVolumeStats,
  getImbalanceStats,
  getCurrentVolume,
  getCurrentImbalance,
} from '../baselines';
import type { Trade } from '../types';

describe('baselines', () => {
  describe('computeZScore', () => {
    it('should compute z-score correctly', () => {
      expect(computeZScore(100, 50, 25)).toBeCloseTo(2, 1);
      expect(computeZScore(50, 50, 25)).toBeCloseTo(0, 1);
      expect(computeZScore(0, 50, 25)).toBeCloseTo(-2, 1);
    });

    it('should handle zero std dev', () => {
      expect(computeZScore(100, 50, 0)).toBe(0);
    });

    it('should handle non-finite values', () => {
      expect(computeZScore(NaN, 50, 25)).toBe(0);
      expect(computeZScore(100, Infinity, 25)).toBe(0);
    });
  });

  describe('getPercentile', () => {
    it('should compute percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(getPercentile(values, 50)).toBeCloseTo(5.5, 1);
      expect(getPercentile(values, 90)).toBeCloseTo(9.5, 1);
      expect(getPercentile(values, 10)).toBeCloseTo(1.5, 1);
    });

    it('should handle single value', () => {
      expect(getPercentile([5], 50)).toBe(5);
    });

    it('should handle empty array', () => {
      expect(getPercentile([], 50)).toBe(0);
    });
  });

  describe('getVolumeStats', () => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes

    it('should return null for empty trades', () => {
      const result = getVolumeStats('market1', windowMs, [], now, 10);
      expect(result).toBeNull();
    });

    it('should compute volume stats with sufficient data', () => {
      const trades: Trade[] = [];
      const baseTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

      // Create trades in windows
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push({
          id: `trade-${i}-1`,
          marketId: 'market1',
          outcome: 'YES',
          amount: '1000',
          price: 0.5,
          timestamp: windowStart + 1000,
          user: 'user1',
          transactionHash: `hash-${i}`,
        });
        trades.push({
          id: `trade-${i}-2`,
          marketId: 'market1',
          outcome: 'NO',
          amount: '2000',
          price: 0.5,
          timestamp: windowStart + 2000,
          user: 'user2',
          transactionHash: `hash-${i}-2`,
        });
      }

      const result = getVolumeStats('market1', windowMs, trades, now, 10);
      expect(result).not.toBeNull();
      expect(result?.mean).toBeGreaterThan(0);
      expect(result?.std).toBeGreaterThanOrEqual(0);
      expect(result?.count).toBeGreaterThanOrEqual(10);
    });

    it('should return null with insufficient data', () => {
      const trades: Trade[] = [
        {
          id: 'trade-1',
          marketId: 'market1',
          outcome: 'YES',
          amount: '1000',
          price: 0.5,
          timestamp: now - 1000,
          user: 'user1',
          transactionHash: 'hash1',
        },
      ];

      const result = getVolumeStats('market1', windowMs, trades, now, 10);
      expect(result).toBeNull();
    });
  });

  describe('getCurrentVolume', () => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    it('should compute current volume in window', () => {
      const trades: Trade[] = [
        {
          id: 'trade-1',
          marketId: 'market1',
          outcome: 'YES',
          amount: '1000',
          price: 0.5,
          timestamp: now - 1000,
          user: 'user1',
          transactionHash: 'hash1',
        },
        {
          id: 'trade-2',
          marketId: 'market1',
          outcome: 'NO',
          amount: '2000',
          price: 0.5,
          timestamp: now - 2000,
          user: 'user2',
          transactionHash: 'hash2',
        },
        {
          id: 'trade-3',
          marketId: 'market1',
          outcome: 'YES',
          amount: '500',
          price: 0.5,
          timestamp: now - windowMs - 1000, // Outside window
          user: 'user3',
          transactionHash: 'hash3',
        },
      ];

      const volume = getCurrentVolume('market1', windowMs, trades, now);
      expect(volume).toBe(3000); // 1000 + 2000
    });
  });

  describe('getCurrentImbalance', () => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    it('should compute imbalance correctly', () => {
      const trades: Trade[] = [
        {
          id: 'trade-1',
          marketId: 'market1',
          outcome: 'YES',
          amount: '800',
          price: 0.5,
          timestamp: now - 1000,
          user: 'user1',
          transactionHash: 'hash1',
        },
        {
          id: 'trade-2',
          marketId: 'market1',
          outcome: 'NO',
          amount: '200',
          price: 0.5,
          timestamp: now - 2000,
          user: 'user2',
          transactionHash: 'hash2',
        },
      ];

      const imbalance = getCurrentImbalance('market1', windowMs, trades, now);
      expect(imbalance).not.toBeNull();
      expect(imbalance).toBeCloseTo(0.6, 1); // |800 - 200| / 1000 = 0.6
    });

    it('should return null for no trades', () => {
      const imbalance = getCurrentImbalance('market1', windowMs, [], now);
      expect(imbalance).toBeNull();
    });
  });
});

