/**
 * Price and volatility detectors
 * 
 * Detects anomalies in price movements and volatility patterns.
 */

import type { Trade, AnomalyEvent, AnomalyDetectionConfig } from '../types';
import { getReturnStats, computeZScore } from '../baselines';

/**
 * Detect price jump anomalies
 * 
 * Detects sudden large price movements compared to historical patterns.
 */
export function detectPriceJump(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const marketTrades = trades.filter((t) => t.marketId === marketId);

  if (marketTrades.length < 2) {
    return null;
  }

  // CRITICAL: We need to track price for a specific outcome (YES or NO)
  // Since YES + NO = 1.0, we should track the most traded outcome in the window
  // or default to YES. Let's use YES as the standard for price tracking.
  const windowStart = now - windowMs;
  const windowTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  if (windowTrades.length < 2) {
    return null;
  }

  // Determine which outcome to track (use the one with more trades in the window)
  const yesTrades = windowTrades.filter((t) => t.outcome === 'YES');
  const noTrades = windowTrades.filter((t) => t.outcome === 'NO');
  const trackOutcome = yesTrades.length >= noTrades.length ? 'YES' : 'NO';
  const outcomeTrades = windowTrades.filter((t) => t.outcome === trackOutcome);

  if (outcomeTrades.length < 2) {
    return null;
  }

  // Sort trades by timestamp (same outcome only)
  const sortedTrades = [...outcomeTrades].sort((a, b) => {
    const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
    const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
    return timeA - timeB;
  });

  // Get first and last price in window (same outcome)
  const firstTrade = sortedTrades[0];
  const lastTrade = sortedTrades[sortedTrades.length - 1];

  const price1 = firstTrade.price;
  const price2 = lastTrade.price;

  if (!isFinite(price1) || !isFinite(price2) || price1 <= 0 || price2 <= 0) {
    return null;
  }

  // Compute price change as percentage points
  const priceChange = ((price2 - price1) / price1) * 100;
  const absPriceChange = Math.abs(priceChange);

  // Check minimum move threshold
  if (absPriceChange < config.minimums.priceMovePoints) {
    return null;
  }

  // Get baseline return statistics
  const returnStats = getReturnStats(
    marketId,
    windowMs,
    trades,
    now,
    config.minimums.dataPoints
  );

  if (!returnStats || returnStats.count < config.minimums.dataPoints) {
    return null;
  }

  // Compute z-score for absolute price change
  const zScore = computeZScore(absPriceChange, Math.abs(returnStats.mean), returnStats.std);

  // Trigger if z-score exceeds threshold OR absolute move is very large
  if (zScore >= config.thresholds.priceZScore || absPriceChange >= 20) {
    // Determine severity
    let severity: 'medium' | 'high' | 'extreme' = 'medium';
    if (absPriceChange >= 30 || zScore >= 4) {
      severity = 'extreme';
    } else if (absPriceChange >= 20 || zScore >= 3) {
      severity = 'high';
    }

    // Compute score (0-100)
    const score = Math.min(100, Math.max(0, (absPriceChange / 50) * 100));

    const direction = priceChange > 0 ? 'up' : 'down';
    const label = `Price ${direction === 'up' ? 'jump' : 'drop'}`;
    // Calculate actual percentage point change (difference in percentage)
    const pricePointChange = Math.abs((price2 - price1) * 100);
    const message = `Price moved ${direction} ${pricePointChange.toFixed(1)} percentage points (${absPriceChange.toFixed(1)}% change) in ${Math.round(windowMs / 60000)}m (z=${zScore.toFixed(2)}, from ${(price1 * 100).toFixed(1)}% to ${(price2 * 100).toFixed(1)}%)`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-price-jump-${timeBucket}`,
      marketId,
      type: 'price-jump',
      severity,
      score,
      timestamp: now,
      label,
      message,
      context: {
        priceChange,
        absPriceChange,
        price1,
        price2,
        zScore,
        meanReturn: returnStats.mean,
        stdReturn: returnStats.std,
        windowMs,
      },
    };
  }

  return null;
}

/**
 * Detect volatility spike anomalies
 * 
 * Detects when short-term volatility significantly exceeds long-term volatility.
 */
export function detectVolatilitySpike(
  marketId: string,
  shortWindowMs: number,
  longWindowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  // Get short-term volatility
  const shortReturnStats = getReturnStats(
    marketId,
    shortWindowMs,
    trades,
    now,
    config.minimums.dataPoints
  );

  // Get long-term volatility
  const longReturnStats = getReturnStats(
    marketId,
    longWindowMs,
    trades,
    now,
    config.minimums.dataPoints
  );

  if (!shortReturnStats || !longReturnStats) {
    return null;
  }

  const shortVol = shortReturnStats.volatility;
  const longVol = longReturnStats.volatility;

  if (longVol === 0 || !isFinite(shortVol) || !isFinite(longVol)) {
    return null;
  }

  const volRatio = shortVol / longVol;

  // Trigger if short-term vol is significantly higher than long-term
  if (volRatio >= 2.0) {
    // Determine severity
    let severity: 'medium' | 'high' | 'extreme' = 'medium';
    if (volRatio >= 4.0) {
      severity = 'extreme';
    } else if (volRatio >= 3.0) {
      severity = 'high';
    }

    // Compute score (0-100)
    const score = Math.min(100, Math.max(0, (volRatio / 5) * 100));

    const label = 'Volatility spike';
    const message = `Short-term volatility (${shortVol.toFixed(2)}%) is ${volRatio.toFixed(1)}x long-term volatility (${longVol.toFixed(2)}%)`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-volatility-spike-${timeBucket}`,
      marketId,
      type: 'volatility-spike',
      severity,
      score,
      timestamp: now,
      label,
      message,
      context: {
        shortVol,
        longVol,
        volRatio,
        shortWindowMs,
        longWindowMs,
      },
    };
  }

  return null;
}

/**
 * Detect breakout anomalies
 * 
 * Detects when price breaks above/below historical quantiles (5th/95th percentiles).
 */
export function detectBreakout(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const marketTrades = trades.filter((t) => t.marketId === marketId);

  if (marketTrades.length === 0) {
    return null;
  }

  // Get recent price
  const recentTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= now - windowMs && tradeTime <= now;
  });

  if (recentTrades.length === 0) {
    return null;
  }

  // Get latest price
  const latestTrade = recentTrades[recentTrades.length - 1];
  const currentPrice = latestTrade.price;

  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  // Get historical prices for quantile calculation
  const maxHistory = 7 * 24 * 60 * 60 * 1000; // 7 days
  const historicalTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= now - maxHistory && tradeTime < now - windowMs; // Exclude recent window
  });

  if (historicalTrades.length < config.minimums.dataPoints) {
    return null;
  }

  const historicalPrices = historicalTrades
    .map((t) => t.price)
    .filter((p) => isFinite(p) && p > 0);

  if (historicalPrices.length < config.minimums.dataPoints) {
    return null;
  }

  // Compute quantiles
  const sortedPrices = [...historicalPrices].sort((a, b) => a - b);
  const percentile5 = sortedPrices[Math.floor(sortedPrices.length * 0.05)];
  const percentile95 = sortedPrices[Math.floor(sortedPrices.length * 0.95)];

  // Check for breakout
  const isBreakoutUp = currentPrice > percentile95;
  const isBreakoutDown = currentPrice < percentile5;

  if (isBreakoutUp || isBreakoutDown) {
    // Check if there's also volume activity (breakout with volume is more significant)
    // This is a simplified check - in practice, you'd want to check volume spike too
    const direction = isBreakoutUp ? 'up' : 'down';
    const threshold = isBreakoutUp ? percentile95 : percentile5;
    const distance = isBreakoutUp
      ? ((currentPrice - threshold) / threshold) * 100
      : ((threshold - currentPrice) / threshold) * 100;

    // Determine severity
    let severity: 'medium' | 'high' = 'medium';
    if (distance >= 5) {
      severity = 'high';
    }

    // Compute score (0-100)
    const score = Math.min(100, Math.max(0, distance * 10));

    const label = `Breakout ${direction}`;
    const message = `Price broke ${direction} ${(currentPrice * 100).toFixed(1)}% (${threshold * 100}% ${isBreakoutUp ? 'upper' : 'lower'} quantile, ${distance.toFixed(1)}% beyond)`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-breakout-${timeBucket}`,
      marketId,
      type: 'breakout',
      severity,
      score,
      timestamp: now,
      label,
      message,
      context: {
        currentPrice,
        percentile5,
        percentile95,
        distance,
        direction,
        windowMs,
      },
    };
  }

  return null;
}

/**
 * Run all price and volatility detectors for a market
 */
export function detectPriceVolatilityAnomalies(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Price jump detection
  const priceJump = detectPriceJump(marketId, windowMs, trades, now, config);
  if (priceJump) {
    anomalies.push(priceJump);
  }

  // Volatility spike detection (compare short vs long window)
  const shortWindow = windowMs;
  const longWindow = config.windows.long;
  const volSpike = detectVolatilitySpike(
    marketId,
    shortWindow,
    longWindow,
    trades,
    now,
    config
  );
  if (volSpike) {
    anomalies.push(volSpike);
  }

  // Breakout detection
  const breakout = detectBreakout(marketId, windowMs, trades, now, config);
  if (breakout) {
    anomalies.push(breakout);
  }

  return anomalies;
}

