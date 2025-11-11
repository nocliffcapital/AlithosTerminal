/**
 * Type definitions for the anomaly detection engine
 * 
 * This module defines all TypeScript interfaces and types used throughout
 * the anomaly detection system.
 */

import type { Trade, OrderBook, Market } from '@/lib/api/polymarket';

/**
 * Extended Trade interface - re-exported for convenience
 * Uses existing Trade from polymarket.ts which has:
 * - id, marketId, outcome, amount, price, timestamp, user, transactionHash
 */
export type { Trade };

/**
 * Order book snapshot with timestamp for historical tracking
 */
export interface OrderBookSnapshot extends OrderBook {
  timestamp: number; // milliseconds
}

/**
 * Market metadata for anomaly detection context
 * Extends existing Market interface from polymarket.ts
 */
export interface MarketMetadata extends Market {
  // Additional fields already in Market:
  // - eventId, seriesId for grouping related markets
  // - endDate for pre-expiry detection
  // - category, tags for categorization
}

/**
 * All possible anomaly types detected by the system
 */
export type AnomalyType =
  | 'volume-spike'
  | 'flow-imbalance'
  | 'price-jump'
  | 'volatility-spike'
  | 'breakout'
  | 'spread-widening'
  | 'spread-tightening'
  | 'depth-change'
  | 'slippage-change'
  | 'whale-trade'
  | 'wallet-concentration'
  | 'new-wallet-impact'
  | 'cross-market-mispricing'
  | 'pre-expiry-anomaly'
  | 'composite-event';

/**
 * Severity levels for anomalies
 */
export type Severity = 'low' | 'medium' | 'high' | 'extreme';

/**
 * Anomaly event detected by the system
 */
export interface AnomalyEvent {
  id: string; // Unique identifier for this anomaly
  marketId: string;
  type: AnomalyType;
  severity: Severity;
  score: number; // 0-100 score for this specific anomaly
  timestamp: number; // milliseconds
  label: string; // Short tag: "Volume spike", "Whale buy", "Spread blowout"
  message: string; // Human-readable explanation with stats
  context?: Record<string, any>; // Numerical context used in detection
  meta?: {
    wallet?: string; // Wallet address if relevant
    outcomeId?: string; // Outcome if relevant
    groupId?: string; // Related market group if relevant
  };
}

/**
 * Market heat score - composite unusual activity score
 */
export interface MarketHeatScore {
  marketId: string;
  score: number; // 0-100 aggregate "unusual activity"
  components: Partial<Record<AnomalyType, number>>; // Contribution per anomaly type
  lastUpdated: number; // milliseconds
}

/**
 * Statistical distribution information
 */
export interface DistributionStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  percentile90: number;
  percentile99: number;
  count: number; // Number of data points
}

/**
 * Volume statistics for a market
 */
export interface VolumeStats extends DistributionStats {}

/**
 * Flow imbalance statistics
 */
export interface ImbalanceStats extends DistributionStats {}

/**
 * Spread statistics
 */
export interface SpreadStats extends DistributionStats {}

/**
 * Price return/volatility statistics
 */
export interface ReturnStats extends DistributionStats {
  volatility: number; // Realized volatility
}

/**
 * Configuration for anomaly detection
 */
export interface AnomalyDetectionConfig {
  // Window sizes in milliseconds
  windows: {
    short: number; // e.g., 5 minutes
    medium: number; // e.g., 15 minutes
    long: number; // e.g., 60 minutes
  };

  // Z-score thresholds
  thresholds: {
    volumeZScore: number; // e.g., 2.5
    priceZScore: number; // e.g., 2.5
    volatilityZScore: number; // e.g., 2.0
    spreadZScore: number; // e.g., 2.0
  };

  // Minimum values
  minimums: {
    volumeNotional: number; // Minimum volume in USDC for anomaly consideration
    dataPoints: number; // Minimum data points to build baseline
    priceMovePoints: number; // Minimum price move in percentage points
  };

  // Flow imbalance thresholds
  flowImbalance: {
    threshold: number; // e.g., 0.7 (70% imbalance)
    percentileThreshold: number; // e.g., 0.95 (top 5% historically)
  };

  // Anomaly type weights for composite scoring (should sum to ~1.0)
  weights: {
    volume: number;
    price: number;
    liquidity: number;
    participant: number;
    crossMarket: number;
  };

  // Severity bands for heat score
  severityBands: {
    calm: number; // 0-20
    mild: number; // 20-50
    hot: number; // 50-80
    onFire: number; // 80-100
  };

  // Whale trade detection
  whale: {
    absoluteThreshold: number; // e.g., 10000 USDC
    percentileThreshold: number; // e.g., 0.98 (top 2%)
  };

  // Wallet concentration
  walletConcentration: {
    threshold: number; // e.g., 0.7 (70% share)
    percentileThreshold: number; // e.g., 0.95
  };

  // Cross-market detection
  crossMarket: {
    stdDevThreshold: number; // e.g., 2.5
  };

  // Pre-expiry detection
  preExpiry: {
    timeThreshold: number; // milliseconds before expiry to start checking
  };
}

/**
 * Parameters for computing market anomalies
 */
export interface ComputeAnomaliesParams {
  now: number; // Current timestamp in milliseconds
  windowMs: number; // Detection window size in milliseconds
  tradesByMarket: Record<string, Trade[]>; // Trades grouped by marketId
  orderBooksByMarket?: Record<string, OrderBookSnapshot[]>; // Order book snapshots (optional)
  metadataByMarket?: Record<string, MarketMetadata>; // Market metadata (optional)
  config?: Partial<AnomalyDetectionConfig>; // Optional config overrides
}

/**
 * Result of anomaly computation
 */
export interface AnomalyDetectionResult {
  anomalies: AnomalyEvent[];
  heatScores: MarketHeatScore[];
}

/**
 * Options for querying anomalies
 */
export interface GetAnomaliesOptions {
  since?: number; // Only return anomalies after this timestamp
  types?: AnomalyType[]; // Filter by anomaly types
  severity?: Severity[]; // Filter by severity levels
  marketIds?: string[]; // Filter by market IDs
}

