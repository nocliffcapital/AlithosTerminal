/**
 * Tests for volume and flow detectors
 */

import {
  detectVolumeSpike,
  detectFlowImbalance,
  detectVolumeFlowAnomalies,
} from '../detectors/volume-flow';
import { DEFAULT_CONFIG } from '../config';
import type { Trade } from '../types';

describe('volume-flow detectors', () => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const baseTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

  function createTrade(
    id: string,
    marketId: string,
    outcome: 'YES' | 'NO',
    amount: string,
    timestamp: number
  ): Trade {
    return {
      id,
      marketId,
      outcome,
      amount,
      price: 0.5,
      timestamp: timestamp < 946684800000 ? timestamp * 1000 : timestamp,
      user: 'user1',
      transactionHash: `hash-${id}`,
    };
  }

  describe('detectVolumeSpike', () => {
    it('should not detect anomaly on normal volume', () => {
      const trades: Trade[] = [];
      
      // Create normal volume history
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push(createTrade(`trade-${i}`, 'market1', 'YES', '1000', windowStart + 1000));
      }

      // Add recent normal volume
      trades.push(createTrade('recent-1', 'market1', 'YES', '1000', now - 1000));
      trades.push(createTrade('recent-2', 'market1', 'NO', '1000', now - 2000));

      const anomaly = detectVolumeSpike('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomaly).toBeNull();
    });

    it('should detect volume spike', () => {
      const trades: Trade[] = [];
      
      // Create normal volume history
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push(createTrade(`trade-${i}`, 'market1', 'YES', '1000', windowStart + 1000));
      }

      // Add huge recent volume
      for (let i = 0; i < 10; i++) {
        trades.push(createTrade(`spike-${i}`, 'market1', 'YES', '10000', now - (i * 1000)));
      }

      const anomaly = detectVolumeSpike('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomaly).not.toBeNull();
      expect(anomaly?.type).toBe('volume-spike');
      expect(anomaly?.severity).toMatch(/medium|high|extreme/);
    });

    it('should not trigger below minimum volume threshold', () => {
      const trades: Trade[] = [];
      trades.push(createTrade('small', 'market1', 'YES', '50', now - 1000));

      const anomaly = detectVolumeSpike('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomaly).toBeNull();
    });
  });

  describe('detectFlowImbalance', () => {
    it('should not detect anomaly on balanced flow', () => {
      const trades: Trade[] = [];
      
      // Create balanced history
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push(createTrade(`buy-${i}`, 'market1', 'YES', '1000', windowStart + 1000));
        trades.push(createTrade(`sell-${i}`, 'market1', 'NO', '1000', windowStart + 2000));
      }

      // Add recent balanced flow
      trades.push(createTrade('recent-buy', 'market1', 'YES', '1000', now - 1000));
      trades.push(createTrade('recent-sell', 'market1', 'NO', '1000', now - 2000));

      const anomaly = detectFlowImbalance('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomaly).toBeNull();
    });

    it('should detect flow imbalance', () => {
      const trades: Trade[] = [];
      
      // Create balanced history
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push(createTrade(`buy-${i}`, 'market1', 'YES', '1000', windowStart + 1000));
        trades.push(createTrade(`sell-${i}`, 'market1', 'NO', '1000', windowStart + 2000));
      }

      // Add heavily imbalanced recent flow (mostly buys)
      for (let i = 0; i < 9; i++) {
        trades.push(createTrade(`buy-heavy-${i}`, 'market1', 'YES', '10000', now - (i * 1000)));
      }
      trades.push(createTrade('sell-light', 'market1', 'NO', '1000', now - 10000));

      const anomaly = detectFlowImbalance('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomaly).not.toBeNull();
      expect(anomaly?.type).toBe('flow-imbalance');
    });
  });

  describe('detectVolumeFlowAnomalies', () => {
    it('should return empty array for no anomalies', () => {
      const trades: Trade[] = [];
      const anomalies = detectVolumeFlowAnomalies('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomalies).toEqual([]);
    });

    it('should detect multiple anomaly types', () => {
      const trades: Trade[] = [];
      
      // Create history
      for (let i = 0; i < 20; i++) {
        const windowStart = baseTime + i * windowMs;
        trades.push(createTrade(`trade-${i}`, 'market1', 'YES', '1000', windowStart + 1000));
      }

      // Add volume spike
      for (let i = 0; i < 10; i++) {
        trades.push(createTrade(`spike-${i}`, 'market1', 'YES', '10000', now - (i * 1000)));
      }

      // Add imbalanced flow
      for (let i = 0; i < 8; i++) {
        trades.push(createTrade(`buy-${i}`, 'market1', 'YES', '5000', now - (i * 500)));
      }

      const anomalies = detectVolumeFlowAnomalies('market1', windowMs, trades, now, DEFAULT_CONFIG);
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });
});

