/**
 * Tests for composite scoring
 */

import { computeHeatScore, getSeverityBand, computeHeatScores } from '../scoring';
import { DEFAULT_CONFIG } from '../config';
import type { AnomalyEvent } from '../types';

describe('scoring', () => {
  const now = Date.now();

  function createAnomaly(
    type: AnomalyEvent['type'],
    score: number,
    severity: AnomalyEvent['severity'] = 'medium'
  ): AnomalyEvent {
    return {
      id: `anomaly-${type}-${now}`,
      marketId: 'market1',
      type,
      severity,
      score,
      timestamp: now,
      label: type.replace(/-/g, ' '),
      message: `Test ${type}`,
    };
  }

  describe('computeHeatScore', () => {
    it('should return zero score for no anomalies', () => {
      const heatScore = computeHeatScore('market1', [], DEFAULT_CONFIG, now);
      expect(heatScore.score).toBe(0);
      expect(heatScore.marketId).toBe('market1');
    });

    it('should compute weighted score correctly', () => {
      const anomalies: AnomalyEvent[] = [
        createAnomaly('volume-spike', 50), // Volume weight: 0.3
        createAnomaly('price-jump', 50), // Price weight: 0.3
      ];

      const heatScore = computeHeatScore('market1', anomalies, DEFAULT_CONFIG, now);
      
      // Each anomaly contributes: 0.5 (normalized) * weight * 100
      // Volume: 0.5 * 0.3 * 100 = 15
      // Price: 0.5 * 0.3 * 100 = 15
      // Total: 30
      expect(heatScore.score).toBeCloseTo(30, 0);
    });

    it('should clamp score to 0-100', () => {
      const anomalies: AnomalyEvent[] = [
        createAnomaly('volume-spike', 200), // Would exceed 100
      ];

      const heatScore = computeHeatScore('market1', anomalies, DEFAULT_CONFIG, now);
      expect(heatScore.score).toBeLessThanOrEqual(100);
      expect(heatScore.score).toBeGreaterThanOrEqual(0);
    });

    it('should track components', () => {
      const anomalies: AnomalyEvent[] = [
        createAnomaly('volume-spike', 50),
        createAnomaly('flow-imbalance', 30),
      ];

      const heatScore = computeHeatScore('market1', anomalies, DEFAULT_CONFIG, now);
      expect(heatScore.components['volume-spike']).toBeDefined();
      expect(heatScore.components['flow-imbalance']).toBeDefined();
    });
  });

  describe('getSeverityBand', () => {
    it('should return correct severity bands', () => {
      expect(getSeverityBand(10, DEFAULT_CONFIG)).toBe('calm');
      expect(getSeverityBand(30, DEFAULT_CONFIG)).toBe('mild');
      expect(getSeverityBand(60, DEFAULT_CONFIG)).toBe('hot');
      expect(getSeverityBand(90, DEFAULT_CONFIG)).toBe('on-fire');
    });
  });

  describe('computeHeatScores', () => {
    it('should compute scores for multiple markets', () => {
      const anomaliesByMarket: Record<string, AnomalyEvent[]> = {
        market1: [createAnomaly('volume-spike', 50)],
        market2: [createAnomaly('price-jump', 80)],
        market3: [],
      };

      const heatScores = computeHeatScores(anomaliesByMarket, DEFAULT_CONFIG, now);
      
      expect(heatScores.length).toBe(3);
      expect(heatScores[0].score).toBeGreaterThanOrEqual(heatScores[1].score); // Sorted descending
      expect(heatScores.find((hs) => hs.marketId === 'market3')?.score).toBe(0);
    });

    it('should sort by score descending', () => {
      const anomaliesByMarket: Record<string, AnomalyEvent[]> = {
        market1: [createAnomaly('volume-spike', 30)],
        market2: [createAnomaly('volume-spike', 70)],
        market3: [createAnomaly('volume-spike', 50)],
      };

      const heatScores = computeHeatScores(anomaliesByMarket, DEFAULT_CONFIG, now);
      
      expect(heatScores[0].marketId).toBe('market2');
      expect(heatScores[1].marketId).toBe('market3');
      expect(heatScores[2].marketId).toBe('market1');
    });
  });
});

