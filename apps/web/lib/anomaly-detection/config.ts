/**
 * Default configuration for anomaly detection
 * 
 * These values can be overridden when calling the detection functions.
 * All thresholds and parameters are tuned for prediction market trading.
 */

import type { AnomalyDetectionConfig } from './types';

/**
 * Default configuration with sensible values for prediction markets
 */
export const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  // Window sizes in milliseconds
  windows: {
    short: 5 * 60 * 1000, // 5 minutes
    medium: 15 * 60 * 1000, // 15 minutes
    long: 60 * 60 * 1000, // 60 minutes
  },

  // Z-score thresholds (number of standard deviations)
  thresholds: {
    volumeZScore: 2.5, // Volume spike threshold
    priceZScore: 2.5, // Price jump threshold
    volatilityZScore: 2.0, // Volatility spike threshold
    spreadZScore: 2.0, // Spread change threshold
  },

  // Minimum values for anomaly consideration
  minimums: {
    volumeNotional: 100, // Minimum 100 USDC volume to consider
    dataPoints: 10, // Need at least 10 data points for baseline
    priceMovePoints: 10, // Minimum 10 percentage points price move
  },

  // Flow imbalance detection
  flowImbalance: {
    threshold: 0.7, // 70% imbalance required
    percentileThreshold: 0.95, // Must be in top 5% historically
  },

  // Anomaly type weights for composite scoring
  // These should roughly sum to 1.0 for balanced scoring
  weights: {
    volume: 0.3, // Volume-related anomalies
    price: 0.3, // Price-related anomalies
    liquidity: 0.2, // Liquidity-related anomalies
    participant: 0.15, // Participant-related anomalies
    crossMarket: 0.05, // Cross-market anomalies
  },

  // Severity bands for heat score interpretation
  severityBands: {
    calm: 20, // 0-20: calm market
    mild: 50, // 20-50: mild activity
    hot: 80, // 50-80: hot market
    onFire: 100, // 80-100: on fire
  },

  // Whale trade detection
  whale: {
    absoluteThreshold: 10000, // 10,000 USDC absolute threshold
    percentileThreshold: 0.98, // Top 2% of trade sizes
  },

  // Wallet concentration detection
  walletConcentration: {
    threshold: 0.7, // 70% share by top wallet(s)
    percentileThreshold: 0.95, // Must be in top 5% historically
  },

  // Cross-market mispricing detection
  crossMarket: {
    stdDevThreshold: 2.5, // 2.5 standard deviations from group mean
  },

  // Pre-expiry behavior detection
  preExpiry: {
    timeThreshold: 24 * 60 * 60 * 1000, // 24 hours before expiry
  },
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig?: Partial<AnomalyDetectionConfig>
): AnomalyDetectionConfig {
  if (!userConfig) {
    return DEFAULT_CONFIG;
  }

  return {
    windows: {
      ...DEFAULT_CONFIG.windows,
      ...userConfig.windows,
    },
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...userConfig.thresholds,
    },
    minimums: {
      ...DEFAULT_CONFIG.minimums,
      ...userConfig.minimums,
    },
    flowImbalance: {
      ...DEFAULT_CONFIG.flowImbalance,
      ...userConfig.flowImbalance,
    },
    weights: {
      ...DEFAULT_CONFIG.weights,
      ...userConfig.weights,
    },
    severityBands: {
      ...DEFAULT_CONFIG.severityBands,
      ...userConfig.severityBands,
    },
    whale: {
      ...DEFAULT_CONFIG.whale,
      ...userConfig.whale,
    },
    walletConcentration: {
      ...DEFAULT_CONFIG.walletConcentration,
      ...userConfig.walletConcentration,
    },
    crossMarket: {
      ...DEFAULT_CONFIG.crossMarket,
      ...userConfig.crossMarket,
    },
    preExpiry: {
      ...DEFAULT_CONFIG.preExpiry,
      ...userConfig.preExpiry,
    },
  };
}

