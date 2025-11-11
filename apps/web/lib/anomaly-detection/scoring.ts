/**
 * Composite heat score computation
 * 
 * Combines multiple anomaly events into a single "heat score" (0-100)
 * representing overall unusual activity in a market.
 */

import type {
  AnomalyEvent,
  AnomalyType,
  MarketHeatScore,
  AnomalyDetectionConfig,
} from './types';

/**
 * Map anomaly type to category for weighting
 */
function getAnomalyCategory(type: AnomalyType): 'volume' | 'price' | 'liquidity' | 'participant' | 'crossMarket' {
  switch (type) {
    case 'volume-spike':
    case 'flow-imbalance':
      return 'volume';
    case 'price-jump':
    case 'volatility-spike':
    case 'breakout':
      return 'price';
    case 'spread-widening':
    case 'spread-tightening':
    case 'depth-change':
    case 'slippage-change':
      return 'liquidity';
    case 'whale-trade':
    case 'wallet-concentration':
    case 'new-wallet-impact':
      return 'participant';
    case 'cross-market-mispricing':
    case 'pre-expiry-anomaly':
    case 'composite-event':
      return 'crossMarket';
    default:
      return 'volume'; // Default fallback
  }
}

/**
 * Get weight for an anomaly type based on config
 */
function getAnomalyWeight(
  type: AnomalyType,
  config: AnomalyDetectionConfig
): number {
  const category = getAnomalyCategory(type);
  return config.weights[category] || 0;
}

/**
 * Compute composite heat score for a market from its anomalies
 * 
 * @param marketId - Market identifier
 * @param anomalies - Array of anomaly events for this market
 * @param config - Configuration with weights
 * @returns Market heat score
 */
export function computeHeatScore(
  marketId: string,
  anomalies: AnomalyEvent[],
  config: AnomalyDetectionConfig,
  now: number
): MarketHeatScore {
  if (anomalies.length === 0) {
    return {
      marketId,
      score: 0,
      components: {},
      lastUpdated: now,
    };
  }

  // Normalize each anomaly score to 0-1 and apply weights
  let weightedSum = 0;
  const components: Partial<Record<AnomalyType, number>> = {};

  for (const anomaly of anomalies) {
    // Normalize score to 0-1
    const normalizedScore = anomaly.score / 100;
    
    // Get weight for this anomaly type
    const weight = getAnomalyWeight(anomaly.type, config);
    
    // Add to weighted sum
    const contribution = normalizedScore * weight;
    weightedSum += contribution;

    // Track contribution per type
    const currentContribution = components[anomaly.type] || 0;
    components[anomaly.type] = currentContribution + contribution;
  }

  // Clamp to 0-100 and convert back to 0-100 scale
  const score = Math.max(0, Math.min(100, weightedSum * 100));

  return {
    marketId,
    score,
    components,
    lastUpdated: now,
  };
}

/**
 * Get severity band label from score
 */
export function getSeverityBand(score: number, config: AnomalyDetectionConfig): string {
  if (score < config.severityBands.calm) {
    return 'calm';
  } else if (score < config.severityBands.mild) {
    return 'mild';
  } else if (score < config.severityBands.hot) {
    return 'hot';
  } else {
    return 'on-fire';
  }
}

/**
 * Compute heat scores for multiple markets
 */
export function computeHeatScores(
  anomaliesByMarket: Record<string, AnomalyEvent[]>,
  config: AnomalyDetectionConfig,
  now: number
): MarketHeatScore[] {
  const heatScores: MarketHeatScore[] = [];

  for (const [marketId, anomalies] of Object.entries(anomaliesByMarket)) {
    const heatScore = computeHeatScore(marketId, anomalies, config, now);
    heatScores.push(heatScore);
  }

  // Sort by score descending
  heatScores.sort((a, b) => b.score - a.score);

  return heatScores;
}

