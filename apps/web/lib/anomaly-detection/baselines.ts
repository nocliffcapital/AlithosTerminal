/**
 * Statistical baseline computation for anomaly detection
 * 
 * This module provides functions to compute statistical baselines from historical
 * data, including means, standard deviations, percentiles, and z-scores.
 * All functions use sliding windows on historical data.
 */

import type {
  Trade,
  OrderBookSnapshot,
  VolumeStats,
  ImbalanceStats,
  SpreadStats,
  ReturnStats,
  DistributionStats,
} from './types';

/**
 * Compute z-score: (value - mean) / std
 * Returns 0 if std is 0 or invalid to avoid division by zero
 */
export function computeZScore(value: number, mean: number, std: number): number {
  if (!isFinite(value) || !isFinite(mean) || !isFinite(std)) {
    return 0;
  }
  if (std === 0 || !isFinite(std)) {
    return 0;
  }
  return (value - mean) / std;
}

/**
 * Get percentile value from sorted array
 * Uses linear interpolation between nearest ranks
 */
export function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Compute mean of values
 */
function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + (isFinite(val) ? val : 0), 0);
  return sum / values.length;
}

/**
 * Compute standard deviation of values
 */
function computeStd(values: number[], mean?: number): number {
  if (values.length === 0) return 0;
  const actualMean = mean !== undefined ? mean : computeMean(values);
  const variance =
    values.reduce((acc, val) => {
      const diff = isFinite(val) ? val - actualMean : 0;
      return acc + diff * diff;
    }, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute distribution statistics from values
 */
function computeDistributionStats(values: number[]): DistributionStats {
  if (values.length === 0) {
    return {
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      percentile90: 0,
      percentile99: 0,
      count: 0,
    };
  }

  const validValues = values.filter((v) => isFinite(v));
  if (validValues.length === 0) {
    return {
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      percentile90: 0,
      percentile99: 0,
      count: 0,
    };
  }

  const mean = computeMean(validValues);
  const std = computeStd(validValues, mean);
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const percentile90 = getPercentile(validValues, 90);
  const percentile99 = getPercentile(validValues, 99);

  return {
    mean,
    std,
    min,
    max,
    percentile90,
    percentile99,
    count: validValues.length,
  };
}

/**
 * Get volume statistics for a market over a specific window
 * 
 * @param marketId - Market identifier
 * @param windowMs - Window size in milliseconds
 * @param trades - All trades for the market (will be filtered by window)
 * @param now - Current timestamp in milliseconds
 * @param minDataPoints - Minimum number of windows needed for baseline
 * @returns Volume statistics or null if insufficient data
 */
export function getVolumeStats(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  minDataPoints: number = 10
): VolumeStats | null {
  // Filter trades for this market
  const marketTrades = trades.filter((t) => t.marketId === marketId);

  if (marketTrades.length === 0) {
    return null;
  }

  // Group trades into windows
  // We'll create windows going back in time
  const windowVolumes: number[] = [];
  const maxHistory = 24 * 60 * 60 * 1000; // 24 hours of history
  const startTime = now - maxHistory;

  // Create sliding windows
  for (let windowStart = startTime; windowStart < now; windowStart += windowMs) {
    const windowEnd = windowStart + windowMs;
    const windowTrades = marketTrades.filter(
      (t) => {
        const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1); // Convert to ms if needed
        return tradeTime >= windowStart && tradeTime < windowEnd;
      }
    );

    const volume = windowTrades.reduce((sum, t) => {
      const amount = parseFloat(t.amount || '0');
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

    if (volume > 0) {
      windowVolumes.push(volume);
    }
  }

  if (windowVolumes.length < minDataPoints) {
    return null;
  }

  return computeDistributionStats(windowVolumes);
}

/**
 * Get flow imbalance statistics for a market
 * 
 * Flow imbalance is measured as |buyVolume - sellVolume| / totalVolume
 * 
 * @param marketId - Market identifier
 * @param windowMs - Window size in milliseconds
 * @param trades - All trades for the market
 * @param now - Current timestamp in milliseconds
 * @param minDataPoints - Minimum number of windows needed
 * @returns Imbalance statistics or null if insufficient data
 */
export function getImbalanceStats(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  minDataPoints: number = 10
): ImbalanceStats | null {
  const marketTrades = trades.filter((t) => t.marketId === marketId);

  if (marketTrades.length === 0) {
    return null;
  }

  const imbalances: number[] = [];
  const maxHistory = 24 * 60 * 60 * 1000; // 24 hours
  const startTime = now - maxHistory;

  for (let windowStart = startTime; windowStart < now; windowStart += windowMs) {
    const windowEnd = windowStart + windowMs;
    const windowTrades = marketTrades.filter((t) => {
      const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
      return tradeTime >= windowStart && tradeTime < windowEnd;
    });

    if (windowTrades.length === 0) continue;

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

    if (totalVolume > 0) {
      const imbalance = Math.abs(buyVolume - sellVolume) / totalVolume;
      imbalances.push(imbalance);
    }
  }

  if (imbalances.length < minDataPoints) {
    return null;
  }

  return computeDistributionStats(imbalances);
}

/**
 * Get spread statistics from order book snapshots
 * 
 * Spread is calculated as (bestAsk - bestBid) / midPrice * 100 (percentage)
 * 
 * @param marketId - Market identifier
 * @param snapshots - Order book snapshots (should be sorted by timestamp)
 * @param minDataPoints - Minimum number of snapshots needed
 * @returns Spread statistics or null if insufficient data
 */
export function getSpreadStats(
  marketId: string,
  snapshots: OrderBookSnapshot[],
  minDataPoints: number = 10
): SpreadStats | null {
  const marketSnapshots = snapshots.filter((s) => s.marketId === marketId);

  if (marketSnapshots.length < minDataPoints) {
    return null;
  }

  const spreads: number[] = [];

  for (const snapshot of marketSnapshots) {
    if (!snapshot.bids || !snapshot.asks || snapshot.bids.length === 0 || snapshot.asks.length === 0) {
      continue;
    }

    const bestBid = snapshot.bids[0]?.price;
    const bestAsk = snapshot.asks[0]?.price;

    if (!isFinite(bestBid) || !isFinite(bestAsk) || bestBid <= 0 || bestAsk <= 0) {
      continue;
    }

    const midPrice = (bestBid + bestAsk) / 2;
    const spreadAbs = bestAsk - bestBid;
    const spreadPercent = (spreadAbs / midPrice) * 100;

    if (isFinite(spreadPercent) && spreadPercent >= 0) {
      spreads.push(spreadPercent);
    }
  }

  if (spreads.length < minDataPoints) {
    return null;
  }

  return computeDistributionStats(spreads);
}

/**
 * Get price return and volatility statistics
 * 
 * Computes returns over a horizon and calculates realized volatility
 * 
 * @param marketId - Market identifier
 * @param horizonMs - Time horizon for returns (e.g., 5 minutes)
 * @param trades - All trades for the market
 * @param now - Current timestamp in milliseconds
 * @param minDataPoints - Minimum number of return observations needed
 * @returns Return statistics or null if insufficient data
 */
export function getReturnStats(
  marketId: string,
  horizonMs: number,
  trades: Trade[],
  now: number,
  minDataPoints: number = 10
): ReturnStats | null {
  const marketTrades = trades.filter((t) => t.marketId === marketId);

  if (marketTrades.length < 2) {
    return null;
  }

  // Sort trades by timestamp
  const sortedTrades = [...marketTrades].sort((a, b) => {
    const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
    const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
    return timeA - timeB;
  });

  // Compute returns over the horizon
  const returns: number[] = [];
  const maxHistory = 24 * 60 * 60 * 1000; // 24 hours

  for (let i = 0; i < sortedTrades.length - 1; i++) {
    const trade1 = sortedTrades[i];
    const trade2 = sortedTrades[i + 1];

    const time1 = trade1.timestamp * (trade1.timestamp < 946684800000 ? 1000 : 1);
    const time2 = trade2.timestamp * (trade2.timestamp < 946684800000 ? 1000 : 1);

    // Only consider trades within the horizon
    if (time2 - time1 > horizonMs) continue;
    if (time1 < now - maxHistory) continue;

    const price1 = trade1.price;
    const price2 = trade2.price;

    if (!isFinite(price1) || !isFinite(price2) || price1 <= 0 || price2 <= 0) {
      continue;
    }

    // Compute return as percentage change
    const returnPct = ((price2 - price1) / price1) * 100;
    if (isFinite(returnPct)) {
      returns.push(returnPct);
    }
  }

  if (returns.length < minDataPoints) {
    return null;
  }

  const stats = computeDistributionStats(returns);
  
  // Realized volatility is the standard deviation of returns
  const volatility = stats.std;

  return {
    ...stats,
    volatility,
  };
}

/**
 * Get current volume in a window
 */
export function getCurrentVolume(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number
): number {
  const marketTrades = trades.filter((t) => t.marketId === marketId);
  const windowStart = now - windowMs;

  return marketTrades.reduce((sum, t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    if (tradeTime >= windowStart && tradeTime <= now) {
      const amount = parseFloat(t.amount || '0');
      return sum + (isFinite(amount) ? amount : 0);
    }
    return sum;
  }, 0);
}

/**
 * Get current flow imbalance in a window
 */
export function getCurrentImbalance(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number
): number | null {
  const marketTrades = trades.filter((t) => t.marketId === marketId);
  const windowStart = now - windowMs;

  const windowTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  if (windowTrades.length === 0) {
    return null;
  }

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

  if (totalVolume === 0) {
    return null;
  }

  return Math.abs(buyVolume - sellVolume) / totalVolume;
}

