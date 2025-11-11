/**
 * Liquidity detectors
 * 
 * Detects anomalies in order book liquidity, spread, and depth.
 */

import type {
  OrderBookSnapshot,
  AnomalyEvent,
  AnomalyDetectionConfig,
} from '../types';
import { getSpreadStats, computeZScore } from '../baselines';

/**
 * Calculate spread from order book snapshot
 */
function calculateSpread(snapshot: OrderBookSnapshot): number | null {
  if (!snapshot.bids || !snapshot.asks || snapshot.bids.length === 0 || snapshot.asks.length === 0) {
    return null;
  }

  const bestBid = snapshot.bids[0]?.price;
  const bestAsk = snapshot.asks[0]?.price;

  if (!isFinite(bestBid) || !isFinite(bestAsk) || bestBid <= 0 || bestAsk <= 0) {
    return null;
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const spreadAbs = bestAsk - bestBid;
  const spreadPercent = (spreadAbs / midPrice) * 100;

  return isFinite(spreadPercent) && spreadPercent >= 0 ? spreadPercent : null;
}

/**
 * Detect spread widening anomalies
 */
export function detectSpreadWidening(
  marketId: string,
  currentSnapshot: OrderBookSnapshot,
  historicalSnapshots: OrderBookSnapshot[],
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const currentSpread = calculateSpread(currentSnapshot);
  if (currentSpread === null) {
    return null;
  }

  // Get baseline spread statistics
  const spreadStats = getSpreadStats(
    marketId,
    historicalSnapshots,
    config.minimums.dataPoints
  );

  if (!spreadStats || spreadStats.count < config.minimums.dataPoints) {
    return null;
  }

  // Compute z-score
  const zScore = computeZScore(currentSpread, spreadStats.mean, spreadStats.std);

  // Trigger if spread is significantly wider than average
  if (zScore >= config.thresholds.spreadZScore && currentSpread > spreadStats.mean) {
    const spreadRatio = spreadStats.mean > 0 ? currentSpread / spreadStats.mean : 0;

    // Determine severity
    let severity: 'medium' | 'high' = 'medium';
    if (spreadRatio >= 2.0 || zScore >= 3.0) {
      severity = 'high';
    }

    // Compute score (0-100)
    const score = Math.min(100, Math.max(0, (spreadRatio / 3) * 100));

    const label = 'Spread widening';
    const message = `Spread widened to ${currentSpread.toFixed(2)}% (avg ${spreadStats.mean.toFixed(2)}%, ${spreadRatio.toFixed(1)}x, z=${zScore.toFixed(2)})`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const timeBucket = Math.floor(currentSnapshot.timestamp / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-spread-widening-${timeBucket}`,
      marketId,
      type: 'spread-widening',
      severity,
      score,
      timestamp: currentSnapshot.timestamp,
      label,
      message,
      context: {
        currentSpread,
        meanSpread: spreadStats.mean,
        stdSpread: spreadStats.std,
        spreadRatio,
        zScore,
      },
    };
  }

  return null;
}

/**
 * Detect spread tightening anomalies
 */
export function detectSpreadTightening(
  marketId: string,
  currentSnapshot: OrderBookSnapshot,
  historicalSnapshots: OrderBookSnapshot[],
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const currentSpread = calculateSpread(currentSnapshot);
  if (currentSpread === null) {
    return null;
  }

  const spreadStats = getSpreadStats(
    marketId,
    historicalSnapshots,
    config.minimums.dataPoints
  );

  if (!spreadStats || spreadStats.count < config.minimums.dataPoints) {
    return null;
  }

  // Compute z-score (negative means tighter)
  const zScore = computeZScore(currentSpread, spreadStats.mean, spreadStats.std);

  // Trigger if spread is significantly tighter than average
  if (zScore <= -config.thresholds.spreadZScore && currentSpread < spreadStats.mean) {
    const spreadRatio = spreadStats.mean > 0 ? currentSpread / spreadStats.mean : 0;

    // Determine severity
    let severity: 'medium' | 'high' = 'medium';
    if (spreadRatio <= 0.5 || zScore <= -3.0) {
      severity = 'high';
    }

    // Compute score (0-100) - tighter is better, so invert
    const score = Math.min(100, Math.max(0, ((1 - spreadRatio) / 0.5) * 100));

    const label = 'Spread tightening';
    const message = `Spread tightened to ${currentSpread.toFixed(2)}% (avg ${spreadStats.mean.toFixed(2)}%, ${spreadRatio.toFixed(1)}x, z=${zScore.toFixed(2)})`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const timeBucket = Math.floor(currentSnapshot.timestamp / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-spread-tightening-${timeBucket}`,
      marketId,
      type: 'spread-tightening',
      severity,
      score,
      timestamp: currentSnapshot.timestamp,
      label,
      message,
      context: {
        currentSpread,
        meanSpread: spreadStats.mean,
        stdSpread: spreadStats.std,
        spreadRatio,
        zScore,
      },
    };
  }

  return null;
}

/**
 * Calculate depth at specific distance from mid price
 */
function calculateDepthAtDistance(
  snapshot: OrderBookSnapshot,
  distancePercent: number
): number {
  if (!snapshot.bids || !snapshot.asks || snapshot.bids.length === 0 || snapshot.asks.length === 0) {
    return 0;
  }

  const bestBid = snapshot.bids[0]?.price;
  const bestAsk = snapshot.asks[0]?.price;

  if (!isFinite(bestBid) || !isFinite(bestAsk) || bestBid <= 0 || bestAsk <= 0) {
    return 0;
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const targetPriceBid = midPrice * (1 - distancePercent / 100);
  const targetPriceAsk = midPrice * (1 + distancePercent / 100);

  // Sum depth on bid side up to target price
  const bidDepth = snapshot.bids
    .filter((bid) => bid.price >= targetPriceBid)
    .reduce((sum, bid) => sum + (bid.size || 0), 0);

  // Sum depth on ask side up to target price
  const askDepth = snapshot.asks
    .filter((ask) => ask.price <= targetPriceAsk)
    .reduce((sum, ask) => sum + (ask.size || 0), 0);

  return bidDepth + askDepth;
}

/**
 * Detect depth change anomalies
 */
export function detectDepthChange(
  marketId: string,
  currentSnapshot: OrderBookSnapshot,
  historicalSnapshots: OrderBookSnapshot[],
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  // Calculate depth at multiple levels
  const depthLevels = [1, 3, 5]; // 1%, 3%, 5% from mid
  const currentDepths = depthLevels.map((level) =>
    calculateDepthAtDistance(currentSnapshot, level)
  );

  // Calculate historical depths
  const historicalDepths: number[][] = [];
  for (const snapshot of historicalSnapshots) {
    if (snapshot.marketId === marketId) {
      const depths = depthLevels.map((level) =>
        calculateDepthAtDistance(snapshot, level)
      );
      historicalDepths.push(depths);
    }
  }

  if (historicalDepths.length < config.minimums.dataPoints) {
    return null;
  }

  // Check each depth level
  for (let i = 0; i < depthLevels.length; i++) {
    const currentDepth = currentDepths[i];
    const historicalDepthsAtLevel = historicalDepths.map((d) => d[i]).filter((d) => d > 0);

    if (historicalDepthsAtLevel.length < config.minimums.dataPoints) {
      continue;
    }

    const meanDepth =
      historicalDepthsAtLevel.reduce((sum, d) => sum + d, 0) /
      historicalDepthsAtLevel.length;
    const stdDepth = Math.sqrt(
      historicalDepthsAtLevel.reduce((sum, d) => sum + Math.pow(d - meanDepth, 2), 0) /
        historicalDepthsAtLevel.length
    );

    if (meanDepth === 0) continue;

    const zScore = computeZScore(currentDepth, meanDepth, stdDepth);
    const depthRatio = currentDepth / meanDepth;

    // Trigger if depth changed significantly (either collapse or spike)
    if (Math.abs(zScore) >= config.thresholds.spreadZScore) {
      const isCollapse = currentDepth < meanDepth;
      const severity: 'medium' | 'high' = Math.abs(zScore) >= 3.0 ? 'high' : 'medium';
      const score = Math.min(100, Math.max(0, Math.abs(zScore) * 20));

      const label = isCollapse ? 'Depth collapse' : 'Depth spike';
      const message = `Depth at ${depthLevels[i]}% ${isCollapse ? 'collapsed' : 'spiked'} to ${currentDepth.toFixed(0)} (avg ${meanDepth.toFixed(0)}, ${depthRatio.toFixed(1)}x, z=${zScore.toFixed(2)})`;

      // Use time-bucketed ID for determinism (5-minute buckets)
      const timeBucket = Math.floor(currentSnapshot.timestamp / 300000) * 300000; // 5-minute bucket
      return {
        id: `${marketId}-depth-change-${timeBucket}-${depthLevels[i]}`,
        marketId,
        type: 'depth-change',
        severity,
        score,
        timestamp: currentSnapshot.timestamp,
        label,
        message,
        context: {
          currentDepth,
          meanDepth,
          stdDepth,
          depthRatio,
          zScore,
          distancePercent: depthLevels[i],
        },
      };
    }
  }

  return null;
}

/**
 * Calculate slippage for a trade of given size
 */
function calculateSlippage(
  snapshot: OrderBookSnapshot,
  tradeSize: number,
  side: 'buy' | 'sell'
): number | null {
  if (!snapshot.bids || !snapshot.asks || snapshot.bids.length === 0 || snapshot.asks.length === 0) {
    return null;
  }

  const bestBid = snapshot.bids[0]?.price;
  const bestAsk = snapshot.asks[0]?.price;

  if (!isFinite(bestBid) || !isFinite(bestAsk) || bestBid <= 0 || bestAsk <= 0) {
    return null;
  }

  const midPrice = (bestBid + bestAsk) / 2;
  let executedPrice = midPrice;
  let remainingSize = tradeSize;

  if (side === 'buy') {
    // Walk the ask side
    for (const ask of snapshot.asks) {
      if (remainingSize <= 0) break;
      const size = Math.min(remainingSize, ask.size || 0);
      executedPrice = ask.price;
      remainingSize -= size;
    }
  } else {
    // Walk the bid side
    for (const bid of snapshot.bids) {
      if (remainingSize <= 0) break;
      const size = Math.min(remainingSize, bid.size || 0);
      executedPrice = bid.price;
      remainingSize -= size;
    }
  }

  const slippage = Math.abs(executedPrice - midPrice) / midPrice * 100;
  return isFinite(slippage) ? slippage : null;
}

/**
 * Detect slippage change anomalies
 */
export function detectSlippageChange(
  marketId: string,
  currentSnapshot: OrderBookSnapshot,
  historicalSnapshots: OrderBookSnapshot[],
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  // Test slippage for standard sizes
  const testSizes = [1000, 5000]; // $1k and $5k
  const sides: ('buy' | 'sell')[] = ['buy', 'sell'];

  for (const size of testSizes) {
    for (const side of sides) {
      const currentSlippage = calculateSlippage(currentSnapshot, size, side);
      if (currentSlippage === null) continue;

      // Calculate historical slippage
      const historicalSlippages: number[] = [];
      for (const snapshot of historicalSnapshots) {
        if (snapshot.marketId === marketId) {
          const slippage = calculateSlippage(snapshot, size, side);
          if (slippage !== null) {
            historicalSlippages.push(slippage);
          }
        }
      }

      if (historicalSlippages.length < config.minimums.dataPoints) {
        continue;
      }

      const meanSlippage =
        historicalSlippages.reduce((sum, s) => sum + s, 0) / historicalSlippages.length;
      const stdSlippage = Math.sqrt(
        historicalSlippages.reduce((sum, s) => sum + Math.pow(s - meanSlippage, 2), 0) /
          historicalSlippages.length
      );

      if (meanSlippage === 0) continue;

      const zScore = computeZScore(currentSlippage, meanSlippage, stdSlippage);
      const slippageRatio = currentSlippage / meanSlippage;

      // Trigger if slippage changed significantly
      if (Math.abs(zScore) >= config.thresholds.spreadZScore) {
        const isIncrease = currentSlippage > meanSlippage;
        const severity: 'medium' | 'high' = Math.abs(zScore) >= 3.0 ? 'high' : 'medium';
        const score = Math.min(100, Math.max(0, Math.abs(zScore) * 20));

        const label = isIncrease ? 'Slippage increase' : 'Slippage decrease';
        const message = `Slippage for $${size.toLocaleString()} ${side} ${isIncrease ? 'increased' : 'decreased'} to ${currentSlippage.toFixed(2)}% (avg ${meanSlippage.toFixed(2)}%, ${slippageRatio.toFixed(1)}x, z=${zScore.toFixed(2)})`;

        // Use time-bucketed ID for determinism (5-minute buckets)
        const timeBucket = Math.floor(currentSnapshot.timestamp / 300000) * 300000; // 5-minute bucket
        return {
          id: `${marketId}-slippage-change-${timeBucket}-${size}-${side}`,
          marketId,
          type: 'slippage-change',
          severity,
          score,
          timestamp: currentSnapshot.timestamp,
          label,
          message,
          context: {
            currentSlippage,
            meanSlippage,
            stdSlippage,
            slippageRatio,
            zScore,
            tradeSize: size,
            side,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Run all liquidity detectors for a market
 */
export function detectLiquidityAnomalies(
  marketId: string,
  currentSnapshot: OrderBookSnapshot,
  historicalSnapshots: OrderBookSnapshot[],
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Spread widening
  const spreadWidening = detectSpreadWidening(
    marketId,
    currentSnapshot,
    historicalSnapshots,
    config
  );
  if (spreadWidening) {
    anomalies.push(spreadWidening);
  }

  // Spread tightening
  const spreadTightening = detectSpreadTightening(
    marketId,
    currentSnapshot,
    historicalSnapshots,
    config
  );
  if (spreadTightening) {
    anomalies.push(spreadTightening);
  }

  // Depth change
  const depthChange = detectDepthChange(
    marketId,
    currentSnapshot,
    historicalSnapshots,
    config
  );
  if (depthChange) {
    anomalies.push(depthChange);
  }

  // Slippage change
  const slippageChange = detectSlippageChange(
    marketId,
    currentSnapshot,
    historicalSnapshots,
    config
  );
  if (slippageChange) {
    anomalies.push(slippageChange);
  }

  return anomalies;
}

