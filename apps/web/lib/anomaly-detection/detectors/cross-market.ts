/**
 * Cross-market and structural detectors
 * 
 * Detects anomalies across related markets and structural patterns:
 * - Cross-market mispricing (arbitrage opportunities)
 * - Linked event anomalies (markets that should move together)
 * - Pre-expiry behavior (unusual activity near resolution)
 */

import type {
  Trade,
  MarketMetadata,
  AnomalyEvent,
  AnomalyDetectionConfig,
} from '../types';
import { computeZScore } from '../baselines';

/**
 * Detect cross-market mispricing anomalies
 * 
 * Detects when a market's implied probability deviates significantly from
 * related markets in the same group (eventId or seriesId).
 */
export function detectCrossMarketMispricing(
  marketId: string,
  trades: Trade[],
  metadataByMarket: Record<string, MarketMetadata>,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const marketMetadata = metadataByMarket[marketId];
  if (!marketMetadata) {
    return null;
  }

  // Get group identifier (eventId or seriesId)
  const groupId = marketMetadata.eventId || marketMetadata.seriesId;
  if (!groupId) {
    return null;
  }

  // Find related markets in the same group
  const relatedMarkets = Object.values(metadataByMarket).filter(
    (m) =>
      m.id !== marketId &&
      (m.eventId === groupId || m.seriesId === groupId)
  );

  if (relatedMarkets.length === 0) {
    return null;
  }

  // Get current price for this market
  const marketTrades = trades.filter((t) => t.marketId === marketId);
  if (marketTrades.length === 0) {
    return null;
  }

  // Sort by timestamp and get latest price
  const sortedTrades = [...marketTrades].sort((a, b) => {
    const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
    const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
    return timeB - timeA; // Descending
  });

  const currentPrice = sortedTrades[0]?.price;
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  // Get prices for related markets
  const relatedPrices: number[] = [];
  for (const relatedMarket of relatedMarkets) {
    const relatedTrades = trades.filter((t) => t.marketId === relatedMarket.id);
    if (relatedTrades.length === 0) continue;

    const sortedRelated = [...relatedTrades].sort((a, b) => {
      const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
      const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
      return timeB - timeA;
    });

    const price = sortedRelated[0]?.price;
    if (isFinite(price) && price > 0) {
      relatedPrices.push(price);
    }
  }

  if (relatedPrices.length < 2) {
    return null;
  }

  // Compute group statistics
  const meanPrice =
    relatedPrices.reduce((sum, p) => sum + p, 0) / relatedPrices.length;
  const variance =
    relatedPrices.reduce((sum, p) => sum + Math.pow(p - meanPrice, 2), 0) /
    relatedPrices.length;
  const stdPrice = Math.sqrt(variance);

  if (stdPrice === 0) {
    return null;
  }

  // Compute z-score for this market's price
  const zScore = computeZScore(currentPrice, meanPrice, stdPrice);

  // Trigger if deviation exceeds threshold
  if (Math.abs(zScore) >= config.crossMarket.stdDevThreshold) {
    const deviation = ((currentPrice - meanPrice) / meanPrice) * 100;
    const direction = currentPrice > meanPrice ? 'above' : 'below';

    // Determine severity
    let severity: 'medium' | 'high' = 'medium';
    if (Math.abs(zScore) >= 3.5 || Math.abs(deviation) >= 15) {
      severity = 'high';
    }

    // Compute score (0-100)
    const score = Math.min(100, Math.max(0, Math.abs(zScore) * 20));

    const label = 'Cross-market mispricing';
    const message = `Price ${(currentPrice * 100).toFixed(1)}% is ${Math.abs(deviation).toFixed(1)}% ${direction} group average ${(meanPrice * 100).toFixed(1)}% (z=${zScore.toFixed(2)})`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const now = Date.now();
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-cross-market-mispricing-${timeBucket}`,
      marketId,
      type: 'cross-market-mispricing',
      severity,
      score,
      timestamp: now,
      label,
      message,
      context: {
        currentPrice,
        meanPrice,
        stdPrice,
        zScore,
        deviation,
        groupSize: relatedPrices.length,
      },
      meta: {
        groupId,
      },
    };
  }

  return null;
}

/**
 * Detect linked event anomalies
 * 
 * Detects when a large anomaly occurs in one market but related markets don't react.
 */
export function detectLinkedEventAnomaly(
  marketId: string,
  allAnomalies: AnomalyEvent[],
  metadataByMarket: Record<string, MarketMetadata>,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const marketMetadata = metadataByMarket[marketId];
  if (!marketMetadata) {
    return null;
  }

  const groupId = marketMetadata.eventId || marketMetadata.seriesId;
  if (!groupId) {
    return null;
  }

  // Find related markets
  const relatedMarkets = Object.values(metadataByMarket).filter(
    (m) =>
      m.id !== marketId &&
      (m.eventId === groupId || m.seriesId === groupId)
  );

  if (relatedMarkets.length === 0) {
    return null;
  }

  // Check if this market has a high-severity anomaly
  const marketAnomalies = allAnomalies.filter((a) => a.marketId === marketId);
  const hasHighSeverityAnomaly = marketAnomalies.some(
    (a) => a.severity === 'high' || a.severity === 'extreme'
  );

  if (!hasHighSeverityAnomaly) {
    return null;
  }

  // Check if related markets have similar anomalies
  const relatedMarketIds = relatedMarkets.map((m) => m.id);
  const relatedAnomalies = allAnomalies.filter((a) =>
    relatedMarketIds.includes(a.marketId)
  );

  const relatedHighSeverity = relatedAnomalies.some(
    (a) => a.severity === 'high' || a.severity === 'extreme'
  );

  // If this market has high severity but related markets don't, flag as out of sync
  if (!relatedHighSeverity) {
    const label = 'Out of sync';
    const message = `High-severity anomaly detected but related markets in group not reacting (${relatedMarkets.length} related markets)`;

    // Use time-bucketed ID for determinism (5-minute buckets)
    const now = Date.now();
    const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
    return {
      id: `${marketId}-linked-event-${timeBucket}`,
      marketId,
      type: 'composite-event',
      severity: 'medium',
      score: 50,
      timestamp: now,
      label,
      message,
      context: {
        marketAnomalyCount: marketAnomalies.length,
        relatedAnomalyCount: relatedAnomalies.length,
        groupSize: relatedMarkets.length,
      },
      meta: {
        groupId,
      },
    };
  }

  return null;
}

/**
 * Detect pre-expiry behavior anomalies
 * 
 * Detects unusual activity patterns as markets approach resolution.
 */
export function detectPreExpiryAnomaly(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  metadataByMarket: Record<string, MarketMetadata>,
  config: AnomalyDetectionConfig
): AnomalyEvent | null {
  const marketMetadata = metadataByMarket[marketId];
  if (!marketMetadata || !marketMetadata.endDate) {
    return null;
  }

  // Parse end date
  let endTime: number;
  try {
    endTime = new Date(marketMetadata.endDate).getTime();
  } catch {
    return null;
  }

  // Check if market is close to expiry
  const timeToExpiry = endTime - now;
  if (timeToExpiry > config.preExpiry.timeThreshold || timeToExpiry <= 0) {
    return null;
  }

  const marketTrades = trades.filter((t) => t.marketId === marketId);
  if (marketTrades.length === 0) {
    return null;
  }

  // Get recent volume
  const windowStart = now - windowMs;
  const recentTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  const recentVolume = recentTrades.reduce((sum, t) => {
    const amount = parseFloat(t.amount || '0');
    return sum + (isFinite(amount) ? amount : 0);
  }, 0);

  // Get historical volume for comparison (same time window, but earlier)
  const historicalWindowStart = now - (2 * windowMs);
  const historicalWindowEnd = now - windowMs;
  const historicalTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= historicalWindowStart && tradeTime < historicalWindowEnd;
  });

  const historicalVolume = historicalTrades.reduce((sum, t) => {
    const amount = parseFloat(t.amount || '0');
    return sum + (isFinite(amount) ? amount : 0);
  }, 0);

  // Check for unusual patterns near expiry
  const hoursToExpiry = timeToExpiry / (60 * 60 * 1000);

  // Pattern 1: Very high uncertainty (large spread) very close to expiry
  // Pattern 2: Sudden volume spike very close to expiry
  // Pattern 3: Large price swings near expiry

  // For now, detect sudden volume spike near expiry
  if (hoursToExpiry < 1 && recentVolume > 0 && historicalVolume > 0) {
    const volumeRatio = recentVolume / historicalVolume;

    if (volumeRatio >= 3.0) {
      // Determine severity
      let severity: 'medium' | 'high' = 'medium';
      if (volumeRatio >= 5.0 || hoursToExpiry < 0.5) {
        severity = 'high';
      }

      // Compute score (0-100)
      const score = Math.min(100, Math.max(0, (volumeRatio / 5) * 100));

      const label = 'Pre-expiry anomaly';
      const message = `Unusual volume spike (${volumeRatio.toFixed(1)}x) ${hoursToExpiry.toFixed(1)}h before expiry: ${recentVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

      // Use time-bucketed ID for determinism (5-minute buckets)
      const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
      return {
        id: `${marketId}-pre-expiry-${timeBucket}`,
        marketId,
        type: 'pre-expiry-anomaly',
        severity,
        score,
        timestamp: now,
        label,
        message,
        context: {
          recentVolume,
          historicalVolume,
          volumeRatio,
          hoursToExpiry,
          timeToExpiry,
          windowMs,
        },
      };
    }
  }

  return null;
}

/**
 * Run all cross-market detectors for a market
 */
export function detectCrossMarketAnomalies(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  allAnomalies: AnomalyEvent[],
  metadataByMarket: Record<string, MarketMetadata>,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Cross-market mispricing
  const mispricing = detectCrossMarketMispricing(
    marketId,
    trades,
    metadataByMarket,
    config
  );
  if (mispricing) {
    anomalies.push(mispricing);
  }

  // Linked event anomaly
  const linkedEvent = detectLinkedEventAnomaly(
    marketId,
    allAnomalies,
    metadataByMarket,
    config
  );
  if (linkedEvent) {
    anomalies.push(linkedEvent);
  }

  // Pre-expiry anomaly
  const preExpiry = detectPreExpiryAnomaly(
    marketId,
    windowMs,
    trades,
    now,
    metadataByMarket,
    config
  );
  if (preExpiry) {
    anomalies.push(preExpiry);
  }

  return anomalies;
}

