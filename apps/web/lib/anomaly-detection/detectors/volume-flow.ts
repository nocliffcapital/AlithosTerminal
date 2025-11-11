/**
 * Volume and flow imbalance detectors
 * 
 * Detects anomalies in trading volume and buy/sell flow patterns.
 * Refactored from the original simple detector with proper statistical baselines.
 */

import type { Trade, AnomalyEvent, AnomalyDetectionConfig } from '../types';
import {
  getVolumeStats,
  getImbalanceStats,
  getCurrentVolume,
  getCurrentImbalance,
  computeZScore,
  getPercentile,
} from '../baselines';

/**
 * Detect volume spike anomalies
 * 
 * Compares current volume in window to historical baseline using z-scores
 * and percentile analysis.
 */
export function detectVolumeSpike(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  // Get current volume in window
  const currentVolume = getCurrentVolume(marketId, windowMs, trades, now);

  // Check minimum volume threshold
  if (currentVolume < config.minimums.volumeNotional) {
    return null;
  }

  // Get baseline statistics
  const volumeStats = getVolumeStats(
    marketId,
    windowMs,
    trades,
    now,
    config.minimums.dataPoints
  );

  if (!volumeStats || volumeStats.count < config.minimums.dataPoints) {
    return null;
  }

  // Compute z-score
  const zScore = computeZScore(currentVolume, volumeStats.mean, volumeStats.std);

  // Check if volume is in top percentiles
  const volumeRatio = volumeStats.mean > 0 ? currentVolume / volumeStats.mean : 0;
  const isTopPercentile = currentVolume >= volumeStats.percentile90;

  // Trigger if z-score exceeds threshold AND is in top percentile
  if (zScore >= config.thresholds.volumeZScore && isTopPercentile) {
    // Determine severity
    let severity: 'medium' | 'high' | 'extreme' = 'medium';
    if (zScore >= 4 || volumeRatio >= 10) {
      severity = 'extreme';
    } else if (zScore >= 3 || volumeRatio >= 5) {
      severity = 'high';
    }

    // Compute score (0-100) based on z-score and ratio
    const score = Math.min(100, Math.max(0, (zScore / 5) * 50 + (volumeRatio / 10) * 50));

    const label = 'Volume spike';
    const message = `Last ${Math.round(windowMs / 60000)}m volume: ${currentVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC vs avg ${volumeStats.mean.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC (+${volumeRatio.toFixed(1)}x, z=${zScore.toFixed(2)})`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    // This ensures the same anomaly gets the same ID across recomputations
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-volume-spike-${timeBucket}`,
      marketId,
      type: 'volume-spike',
      severity,
      score,
      timestamp: now,
      label,
      message,
      context: {
        currentVolume,
        meanVolume: volumeStats.mean,
        stdVolume: volumeStats.std,
        zScore,
        volumeRatio,
        windowMs,
      },
    };
  }

  return null;
}

/**
 * Detect flow imbalance anomalies
 * 
 * Detects when buy/sell flow is heavily imbalanced compared to historical patterns.
 */
export function detectFlowImbalance(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  // Get current imbalance
  const currentImbalance = getCurrentImbalance(marketId, windowMs, trades, now);

  if (currentImbalance === null) {
    return null;
  }

  // Check if imbalance exceeds threshold
  if (currentImbalance < config.flowImbalance.threshold) {
    return null;
  }

  // Get baseline statistics
  const imbalanceStats = getImbalanceStats(
    marketId,
    windowMs,
    trades,
    now,
    config.minimums.dataPoints
  );

  if (!imbalanceStats || imbalanceStats.count < config.minimums.dataPoints) {
    return null;
  }

  // Check if current imbalance is in top percentile historically
  const isTopPercentile = currentImbalance >= imbalanceStats.percentile90;

  if (!isTopPercentile) {
    return null;
  }

  // Get buy/sell volumes for message
  const marketTrades = trades.filter((t) => t.marketId === marketId);
  const windowStart = now - windowMs;

  const windowTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  const buyVolume = windowTrades
    .filter((t) => t.outcome === 'YES')
    .reduce((sum, t) => {
      const amount = parseFloat(t.amount || '0');
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

  const sellVolume = windowTrades
    .filter((t) => t.outcome === 'NO')
    .reduce((sum, t) => {
      const amount = parseFloat(t.amount || '0');
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

  const totalVolume = buyVolume + sellVolume;
  const buyPercent = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
  const sellPercent = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0;

  // Determine severity
  let severity: 'medium' | 'high' = 'medium';
  if (currentImbalance >= 0.9) {
    severity = 'high';
  }

  // Compute percentile rank
  const percentileRank = currentImbalance >= imbalanceStats.percentile99 ? 99 :
                         currentImbalance >= imbalanceStats.percentile90 ? 90 : 50;

  // Compute score (0-100)
  const score = Math.min(100, Math.max(0, currentImbalance * 100));

  const direction = buyVolume > sellVolume ? 'Buy' : 'Sell';
  const label = 'Flow imbalance';
  const message = `Flow imbalance: ${(currentImbalance * 100).toFixed(0)}% (${buyPercent.toFixed(0)}% Buy, ${sellPercent.toFixed(0)}% Sell in last ${Math.round(windowMs / 60000)}m, top ${percentileRank}% historically)`;

  // Use time-bucketed ID for determinism (5-minute buckets)
  const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
  return {
    id: `${marketId}-flow-imbalance-${timeBucket}`,
    marketId,
    type: 'flow-imbalance',
    severity,
    score,
    timestamp: now,
    label,
    message,
    context: {
      imbalance: currentImbalance,
      buyVolume,
      sellVolume,
      totalVolume,
      meanImbalance: imbalanceStats.mean,
      percentileRank,
      windowMs,
    },
  };
}

/**
 * Run all volume and flow detectors for a market
 */
export function detectVolumeFlowAnomalies(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Volume spike detection
  const volumeSpike = detectVolumeSpike(marketId, windowMs, trades, now, config);
  if (volumeSpike) {
    anomalies.push(volumeSpike);
  }

  // Flow imbalance detection
  const flowImbalance = detectFlowImbalance(marketId, windowMs, trades, now, config);
  if (flowImbalance) {
    anomalies.push(flowImbalance);
  }

  return anomalies;
}

