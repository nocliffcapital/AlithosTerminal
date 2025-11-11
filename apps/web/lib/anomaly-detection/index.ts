/**
 * Public API for anomaly detection engine
 * 
 * This module provides the main entry point for detecting anomalies
 * in prediction market trading activity.
 * 
 * Pure functions - no I/O, no React dependencies.
 * Can be used both client-side and server-side.
 */

import type {
  ComputeAnomaliesParams,
  AnomalyDetectionResult,
  AnomalyEvent,
  MarketHeatScore,
  GetAnomaliesOptions,
  AnomalyDetectionConfig,
} from './types';
import { mergeConfig } from './config';
import { detectVolumeFlowAnomalies } from './detectors/volume-flow';
import { detectPriceVolatilityAnomalies } from './detectors/price-volatility';
import { detectLiquidityAnomalies } from './detectors/liquidity';
import { detectParticipantAnomalies } from './detectors/participant';
import { detectCrossMarketAnomalies } from './detectors/cross-market';
import { computeHeatScores, getSeverityBand } from './scoring';

// Internal cache for heat scores (optional, can be cleared)
let heatScoreCache: Map<string, MarketHeatScore> = new Map();
let anomalyCache: Map<string, AnomalyEvent[]> = new Map();

/**
 * Compute anomalies for all markets
 * 
 * This is the main entry point for anomaly detection.
 * It runs all detectors and computes heat scores.
 * 
 * @param params - Parameters for anomaly computation
 * @returns Anomaly detection results with anomalies and heat scores
 */
export function computeMarketAnomalies(
  params: ComputeAnomaliesParams
): AnomalyDetectionResult {
  const {
    now,
    windowMs,
    tradesByMarket,
    orderBooksByMarket = {},
    metadataByMarket = {},
    config: userConfig,
  } = params;

  // Merge user config with defaults
  const config = mergeConfig(userConfig);

  // Collect all anomalies
  const allAnomalies: AnomalyEvent[] = [];

  // Process each market
  for (const marketId of Object.keys(tradesByMarket)) {
    const trades = tradesByMarket[marketId];
    if (!trades || trades.length === 0) {
      continue;
    }

    // Volume and flow anomalies
    const volumeFlowAnomalies = detectVolumeFlowAnomalies(
      marketId,
      windowMs,
      trades,
      now,
      config
    );
    allAnomalies.push(...volumeFlowAnomalies);

    // Price and volatility anomalies
    const priceVolAnomalies = detectPriceVolatilityAnomalies(
      marketId,
      windowMs,
      trades,
      now,
      config
    );
    allAnomalies.push(...priceVolAnomalies);

    // Participant anomalies
    const participantAnomalies = detectParticipantAnomalies(
      marketId,
      windowMs,
      trades,
      now,
      config
    );
    allAnomalies.push(...participantAnomalies);

    // Cross-market anomalies (needs all anomalies so far)
    const crossMarketAnomalies = detectCrossMarketAnomalies(
      marketId,
      windowMs,
      trades,
      now,
      allAnomalies, // Pass all anomalies for linked event detection
      metadataByMarket,
      config
    );
    allAnomalies.push(...crossMarketAnomalies);

    // Liquidity anomalies (if order book data available)
    const currentSnapshot = orderBooksByMarket[marketId]?.[
      orderBooksByMarket[marketId].length - 1
    ];
    if (currentSnapshot) {
      const historicalSnapshots = orderBooksByMarket[marketId] || [];
      const liquidityAnomalies = detectLiquidityAnomalies(
        marketId,
        currentSnapshot,
        historicalSnapshots,
        config
      );
      allAnomalies.push(...liquidityAnomalies);
    }
  }

  // Group anomalies by market
  const anomaliesByMarket: Record<string, AnomalyEvent[]> = {};
  for (const anomaly of allAnomalies) {
    if (!anomaliesByMarket[anomaly.marketId]) {
      anomaliesByMarket[anomaly.marketId] = [];
    }
    anomaliesByMarket[anomaly.marketId].push(anomaly);
  }

  // Compute heat scores
  const heatScores = computeHeatScores(anomaliesByMarket, config, now);

  // Update caches
  for (const heatScore of heatScores) {
    heatScoreCache.set(heatScore.marketId, heatScore);
  }
  for (const [marketId, anomalies] of Object.entries(anomaliesByMarket)) {
    anomalyCache.set(marketId, anomalies);
  }

  return {
    anomalies: allAnomalies,
    heatScores,
  };
}

/**
 * Get heat score for a specific market
 * 
 * @param marketId - Market identifier
 * @param useCache - Whether to use cached value (default: true)
 * @returns Market heat score or undefined if not found
 */
export function getHeatScoreForMarket(
  marketId: string,
  useCache: boolean = true
): MarketHeatScore | undefined {
  if (useCache) {
    return heatScoreCache.get(marketId);
  }
  return undefined;
}

/**
 * Get anomalies for a specific market
 * 
 * @param marketId - Market identifier
 * @param options - Filtering options
 * @returns Array of anomaly events
 */
export function getAnomaliesForMarket(
  marketId: string,
  options: GetAnomaliesOptions = {}
): AnomalyEvent[] {
  const { since, types, severity, marketIds } = options;

  // If marketIds filter is provided and this market isn't in it, return empty
  if (marketIds && !marketIds.includes(marketId)) {
    return [];
  }

  // Get cached anomalies for this market
  let anomalies = anomalyCache.get(marketId) || [];

  // Apply filters
  if (since !== undefined) {
    anomalies = anomalies.filter((a) => a.timestamp >= since);
  }

  if (types && types.length > 0) {
    anomalies = anomalies.filter((a) => types.includes(a.type));
  }

  if (severity && severity.length > 0) {
    anomalies = anomalies.filter((a) => severity.includes(a.severity));
  }

  // Sort by timestamp descending (most recent first)
  anomalies.sort((a, b) => b.timestamp - a.timestamp);

  return anomalies;
}

/**
 * Clear internal caches
 * 
 * Useful for testing or when you want to force fresh computation.
 */
export function clearCache(): void {
  heatScoreCache.clear();
  anomalyCache.clear();
}

/**
 * Get all heat scores from cache
 */
export function getAllHeatScores(): MarketHeatScore[] {
  return Array.from(heatScoreCache.values());
}

/**
 * Get all anomalies from cache
 */
export function getAllAnomalies(): AnomalyEvent[] {
  return Array.from(anomalyCache.values()).flat();
}

// Re-export types for convenience
export type {
  AnomalyEvent,
  AnomalyType,
  Severity,
  MarketHeatScore,
  AnomalyDetectionConfig,
  ComputeAnomaliesParams,
  AnomalyDetectionResult,
  GetAnomaliesOptions,
} from './types';

// Re-export config for convenience
export { DEFAULT_CONFIG, mergeConfig } from './config';

// Re-export scoring utilities
export { getSeverityBand } from './scoring';

