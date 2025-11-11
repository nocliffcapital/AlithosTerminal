/**
 * Participant-level detectors
 * 
 * Detects anomalies related to individual traders/wallets:
 * - Whale trades (large individual trades)
 * - Wallet concentration (few wallets dominating volume)
 * - New wallet impact (new traders making large moves)
 */

import type { Trade, AnomalyEvent, AnomalyDetectionConfig } from '../types';
import { getPercentile } from '../baselines';

/**
 * Detect whale trade anomalies
 * 
 * Detects unusually large individual trades compared to historical patterns.
 */
export function detectWhaleTrade(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  const marketTrades = trades.filter((t) => t.marketId === marketId);
  if (marketTrades.length === 0) {
    return anomalies;
  }

  // Get recent trades in window
  const windowStart = now - windowMs;
  const recentTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  if (recentTrades.length === 0) {
    return anomalies;
  }

  // Get historical trade sizes for baseline
  const historicalTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime < windowStart;
  });

  const historicalSizes = historicalTrades
    .map((t) => parseFloat(t.amount || '0'))
    .filter((size) => isFinite(size) && size > 0);

  if (historicalSizes.length < config.minimums.dataPoints) {
    return anomalies;
  }

  // Check each recent trade
  for (const trade of recentTrades) {
    const tradeSize = parseFloat(trade.amount || '0');
    if (!isFinite(tradeSize) || tradeSize <= 0) continue;

    // Check absolute threshold
    const exceedsAbsolute = tradeSize >= config.whale.absoluteThreshold;

    // Check percentile threshold
    const percentile98 = getPercentile(historicalSizes, 98);
    const exceedsPercentile = tradeSize >= percentile98;

    if (exceedsAbsolute || exceedsPercentile) {
      // Determine severity
      let severity: 'medium' | 'high' | 'extreme' = 'medium';
      if (tradeSize >= config.whale.absoluteThreshold * 2 || tradeSize >= getPercentile(historicalSizes, 99.5)) {
        severity = 'extreme';
      } else if (tradeSize >= config.whale.absoluteThreshold * 1.5 || tradeSize >= getPercentile(historicalSizes, 99)) {
        severity = 'high';
      }

      // Compute score (0-100)
      const sizeRatio = percentile98 > 0 ? tradeSize / percentile98 : 0;
      const score = Math.min(100, Math.max(0, (sizeRatio / 2) * 100));

      const direction = trade.outcome === 'YES' ? 'buy' : 'sell';
      const label = `Whale ${direction}`;
      const message = `Whale ${direction}: ${tradeSize.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC trade (top ${tradeSize >= percentile98 ? '2%' : '1%'} historically)`;

      // Use time-bucketed ID for determinism (5-minute buckets)
      const tradeTime = trade.timestamp * (trade.timestamp < 946684800000 ? 1000 : 1);
      const timeBucket = Math.floor(tradeTime / 300000) * 300000; // 5-minute bucket
      anomalies.push({
        id: `${marketId}-whale-trade-${trade.id}-${timeBucket}`,
        marketId,
        type: 'whale-trade',
        severity,
        score,
        timestamp: trade.timestamp * (trade.timestamp < 946684800000 ? 1000 : 1),
        label,
        message,
        context: {
          tradeSize,
          percentile98,
          absoluteThreshold: config.whale.absoluteThreshold,
          windowMs,
        },
        meta: {
          wallet: trade.user,
          outcomeId: trade.outcome,
        },
      });
    }
  }

  return anomalies;
}

/**
 * Detect wallet concentration anomalies
 * 
 * Detects when a small number of wallets dominate trading volume.
 */
export function detectWalletConcentration(
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

  // Get recent trades in window
  const windowStart = now - windowMs;
  const recentTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  if (recentTrades.length === 0) {
    return null;
  }

  // Calculate volume per wallet
  const walletVolumes: Record<string, number> = {};
  let totalVolume = 0;

  for (const trade of recentTrades) {
    const amount = parseFloat(trade.amount || '0');
    if (!isFinite(amount) || amount <= 0) continue;

    const wallet = trade.user || 'unknown';
    walletVolumes[wallet] = (walletVolumes[wallet] || 0) + amount;
    totalVolume += amount;
  }

  if (totalVolume === 0) {
    return null;
  }

  // Sort wallets by volume
  const sortedWallets = Object.entries(walletVolumes)
    .map(([wallet, volume]) => ({ wallet, volume, share: volume / totalVolume }))
    .sort((a, b) => b.volume - a.volume);

  // Check top wallet concentration
  const topWallet = sortedWallets[0];
  if (!topWallet) {
    return null;
  }

  // Check if top wallet exceeds threshold
  if (topWallet.share >= config.walletConcentration.threshold) {
    // Get historical concentration for comparison
    const historicalTrades = marketTrades.filter((t) => {
      const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
      return tradeTime < windowStart;
    });

    // Calculate historical concentrations
    const historicalConcentrations: number[] = [];
    const historicalWindowSize = windowMs;
    const maxHistory = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (let histStart = now - maxHistory; histStart < windowStart; histStart += historicalWindowSize) {
      const histEnd = histStart + historicalWindowSize;
      const histWindowTrades = historicalTrades.filter((t) => {
        const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
        return tradeTime >= histStart && tradeTime < histEnd;
      });

      if (histWindowTrades.length === 0) continue;

      const histWalletVolumes: Record<string, number> = {};
      let histTotalVolume = 0;

      for (const trade of histWindowTrades) {
        const amount = parseFloat(trade.amount || '0');
        if (!isFinite(amount) || amount <= 0) continue;
        const wallet = trade.user || 'unknown';
        histWalletVolumes[wallet] = (histWalletVolumes[wallet] || 0) + amount;
        histTotalVolume += amount;
      }

      if (histTotalVolume > 0) {
        const histSorted = Object.values(histWalletVolumes)
          .sort((a, b) => b - a);
        const histTopShare = histSorted[0] / histTotalVolume;
        historicalConcentrations.push(histTopShare);
      }
    }

    if (historicalConcentrations.length >= config.minimums.dataPoints) {
      const percentile95 = getPercentile(historicalConcentrations, 95);
      const isTopPercentile = topWallet.share >= percentile95;

      if (isTopPercentile) {
        // Determine severity
        let severity: 'medium' | 'high' = 'medium';
        if (topWallet.share >= 0.9) {
          severity = 'high';
        }

        // Compute score (0-100)
        const score = Math.min(100, Math.max(0, topWallet.share * 100));

        const label = 'Wallet concentration';
        const message = `Top wallet controls ${(topWallet.share * 100).toFixed(0)}% of volume in last ${Math.round(windowMs / 60000)}m (top 5% historically)`;

        // Use time-bucketed ID for determinism (5-minute buckets)
        const timeBucket = Math.floor(now / 300000) * 300000; // 5-minute bucket
        return {
          id: `${marketId}-wallet-concentration-${timeBucket}`,
          marketId,
          type: 'wallet-concentration',
          severity,
          score,
          timestamp: now,
          label,
          message,
          context: {
            topWalletShare: topWallet.share,
            topWalletVolume: topWallet.volume,
            totalVolume,
            percentile95,
            windowMs,
          },
          meta: {
            wallet: topWallet.wallet,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Detect new wallet impact anomalies
 * 
 * Detects when wallets with minimal/no history make large trades that move price.
 */
export function detectNewWalletImpact(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  const marketTrades = trades.filter((t) => t.marketId === marketId);
  if (marketTrades.length === 0) {
    return anomalies;
  }

  // Get recent trades in window
  const windowStart = now - windowMs;
  const recentTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime >= windowStart && tradeTime <= now;
  });

  if (recentTrades.length === 0) {
    return anomalies;
  }

  // Get historical trades to identify new wallets
  const historicalTrades = marketTrades.filter((t) => {
    const tradeTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
    return tradeTime < windowStart;
  });

  // Build wallet history map
  const walletHistory: Record<string, number> = {};
  for (const trade of historicalTrades) {
    const wallet = trade.user || 'unknown';
    walletHistory[wallet] = (walletHistory[wallet] || 0) + 1;
  }

  // Check recent trades for new wallets
  for (const trade of recentTrades) {
    const wallet = trade.user || 'unknown';
    const tradeSize = parseFloat(trade.amount || '0');
    if (!isFinite(tradeSize) || tradeSize <= 0) continue;

    // Check if wallet is new (no or minimal history)
    const historicalTradeCount = walletHistory[wallet] || 0;
    const isNewWallet = historicalTradeCount < 3; // Less than 3 historical trades

    if (isNewWallet && tradeSize >= config.whale.absoluteThreshold * 0.5) {
      // Check if price moved significantly after this trade
      // Get price immediately before and after trade (tighter window for accuracy)
      const tradeTime = trade.timestamp * (trade.timestamp < 946684800000 ? 1000 : 1);
      const beforeWindow = 2 * 60 * 1000; // 2 minutes before (tighter window)
      const afterWindow = 2 * 60 * 1000; // 2 minutes after (tighter window)

      // CRITICAL: Filter trades by the same outcome as the trade in question
      // YES and NO prices are complementary (YES + NO = 1.0), so we must compare like-for-like
      const sameOutcomeTrades = marketTrades.filter((t) => t.outcome === trade.outcome);
      
      // Get trades sorted by timestamp (only same outcome)
      const sortedTrades = [...sameOutcomeTrades].sort((a, b) => {
        const timeA = a.timestamp * (a.timestamp < 946684800000 ? 1000 : 1);
        const timeB = b.timestamp * (b.timestamp < 946684800000 ? 1000 : 1);
        return timeA - timeB;
      });

      // Find the trade index
      const tradeIndex = sortedTrades.findIndex((t) => {
        const tTime = t.timestamp * (t.timestamp < 946684800000 ? 1000 : 1);
        return t.id === trade.id && Math.abs(tTime - tradeTime) < 1000; // Within 1 second
      });

      if (tradeIndex === -1) continue;

      // Get price before: look backwards from this trade (same outcome only)
      let priceBefore = trade.price; // Default to trade's own price
      for (let i = tradeIndex - 1; i >= 0; i--) {
        const tTime = sortedTrades[i].timestamp * (sortedTrades[i].timestamp < 946684800000 ? 1000 : 1);
        if (tTime >= tradeTime - beforeWindow && tTime < tradeTime) {
          priceBefore = sortedTrades[i].price;
          break;
        }
      }

      // Get price after: look forwards from this trade (same outcome only)
      let priceAfter = trade.price; // Default to trade's own price
      for (let i = tradeIndex + 1; i < sortedTrades.length; i++) {
        const tTime = sortedTrades[i].timestamp * (sortedTrades[i].timestamp < 946684800000 ? 1000 : 1);
        if (tTime > tradeTime && tTime <= tradeTime + afterWindow) {
          priceAfter = sortedTrades[i].price;
          break;
        }
      }

      // Only proceed if we found actual price movement (not just using the trade's own price)
      if (priceBefore !== trade.price || priceAfter !== trade.price) {
        if (isFinite(priceBefore) && isFinite(priceAfter) && priceBefore > 0) {
          // Calculate percentage change (relative change)
          const priceChangePercent = ((priceAfter - priceBefore) / priceBefore) * 100;
          const absPriceChangePercent = Math.abs(priceChangePercent);
          
          // Calculate percentage point change (absolute difference in percentage)
          const pricePointChange = Math.abs((priceAfter - priceBefore) * 100);

          // Trigger if price moved significantly (>= 5% change or >= 5 percentage points)
          if (absPriceChangePercent >= 5 || pricePointChange >= 5) {
            // Determine severity
            let severity: 'medium' | 'high' = 'medium';
            if (tradeSize >= config.whale.absoluteThreshold || absPriceChangePercent >= 10 || pricePointChange >= 10) {
              severity = 'high';
            }

            // Compute score (0-100) based on both percentage change and point change
            const score = Math.min(100, Math.max(0, (absPriceChangePercent / 20) * 50 + (pricePointChange / 20) * 50 + (tradeSize / config.whale.absoluteThreshold) * 50));

            const direction = trade.outcome === 'YES' ? 'buy' : 'sell';
            const label = 'New wallet impact';
            // Show percentage point change (more intuitive) and percentage change in parentheses
            const message = `New wallet ${direction}: ${tradeSize.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC moved price ${pricePointChange.toFixed(1)} percentage points (${absPriceChangePercent.toFixed(1)}% change, from ${(priceBefore * 100).toFixed(1)}% to ${(priceAfter * 100).toFixed(1)}%)`;

            // Use time-bucketed ID for determinism (5-minute buckets)
            const timeBucket = Math.floor(tradeTime / 300000) * 300000; // 5-minute bucket
            anomalies.push({
              id: `${marketId}-new-wallet-impact-${trade.id}-${timeBucket}`,
              marketId,
              type: 'new-wallet-impact',
              severity,
              score,
              timestamp: tradeTime,
              label,
              message,
              context: {
                tradeSize,
                priceChange: absPriceChangePercent,
                pricePointChange,
                priceBefore,
                priceAfter,
                historicalTradeCount,
                windowMs,
              },
              meta: {
                wallet: trade.user,
                outcomeId: trade.outcome,
              },
            });
          }
        }
      }
    }
  }

  return anomalies;
}

/**
 * Run all participant detectors for a market
 */
export function detectParticipantAnomalies(
  marketId: string,
  windowMs: number,
  trades: Trade[],
  now: number,
  config: AnomalyDetectionConfig
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Whale trade detection
  const whaleTrades = detectWhaleTrade(marketId, windowMs, trades, now, config);
  anomalies.push(...whaleTrades);

  // Wallet concentration detection
  const walletConcentration = detectWalletConcentration(
    marketId,
    windowMs,
    trades,
    now,
    config
  );
  if (walletConcentration) {
    anomalies.push(walletConcentration);
  }

  // New wallet impact detection
  const newWalletImpacts = detectNewWalletImpact(
    marketId,
    windowMs,
    trades,
    now,
    config
  );
  anomalies.push(...newWalletImpacts);

  return anomalies;
}

