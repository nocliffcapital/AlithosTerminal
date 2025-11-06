// Liquidity metrics calculations
// Provides utilities for calculating depth, spread, and price impact

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface LiquidityMetrics {
  depth: number; // Total order book depth (sum of all bids + asks)
  spread: number; // Spread as percentage (0-100)
  spreadAbs: number; // Absolute spread (ask - bid)
  midPrice: number; // Mid price between best bid and ask
  bestBid: number | null;
  bestAsk: number | null;
  bidDepth: number; // Total depth on bid side
  askDepth: number; // Total depth on ask side
}

/**
 * Calculate liquidity metrics from order book
 */
export function calculateLiquidityMetrics(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[]
): LiquidityMetrics {
  const bestBid = bids[0]?.price || null;
  const bestAsk = asks[0]?.price || null;
  
  const bidDepth = bids.reduce((sum, bid) => sum + bid.size, 0);
  const askDepth = asks.reduce((sum, ask) => sum + ask.size, 0);
  const depth = bidDepth + askDepth;
  
  const spreadAbs = bestBid && bestAsk ? bestAsk - bestBid : 0;
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spread = midPrice > 0 ? (spreadAbs / midPrice) * 100 : 0;

  return {
    depth,
    spread,
    spreadAbs,
    midPrice,
    bestBid,
    bestAsk,
    bidDepth,
    askDepth,
  };
}

/**
 * Calculate price impact for a trade of given size
 * Price impact measures how much a trade would move the price
 * 
 * @param bids - Order book bids (sorted by price descending)
 * @param asks - Order book asks (sorted by price ascending)
 * @param tradeSize - Size of the trade in outcome tokens
 * @param side - 'buy' to buy from asks, 'sell' to sell to bids
 * @returns Price impact as percentage (0-100)
 */
export function calculatePriceImpact(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  tradeSize: number,
  side: 'buy' | 'sell'
): {
  impactPercent: number;
  averagePrice: number;
  executionPrice: number;
  totalCost: number;
} {
  if (tradeSize <= 0) {
    return {
      impactPercent: 0,
      averagePrice: 0,
      executionPrice: 0,
      totalCost: 0,
    };
  }

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk || 0;

  if (side === 'buy') {
    // Buying from asks (market buy)
    let remainingSize = tradeSize;
    let totalCost = 0;
    let totalTokens = 0;

    for (const ask of asks) {
      if (remainingSize <= 0) break;
      
      const sizeToFill = Math.min(remainingSize, ask.size);
      totalCost += sizeToFill * ask.price;
      totalTokens += sizeToFill;
      remainingSize -= sizeToFill;
    }

    if (totalTokens === 0) {
      return {
        impactPercent: 0,
        averagePrice: bestAsk,
        executionPrice: bestAsk,
        totalCost: 0,
      };
    }

    const averagePrice = totalCost / totalTokens;
    const impactPercent = midPrice > 0 ? ((averagePrice - midPrice) / midPrice) * 100 : 0;

    return {
      impactPercent: Math.max(0, impactPercent),
      averagePrice,
      executionPrice: averagePrice,
      totalCost,
    };
  } else {
    // Selling to bids (market sell)
    let remainingSize = tradeSize;
    let totalRevenue = 0;
    let totalTokens = 0;

    for (const bid of bids) {
      if (remainingSize <= 0) break;
      
      const sizeToFill = Math.min(remainingSize, bid.size);
      totalRevenue += sizeToFill * bid.price;
      totalTokens += sizeToFill;
      remainingSize -= sizeToFill;
    }

    if (totalTokens === 0) {
      return {
        impactPercent: 0,
        averagePrice: bestBid,
        executionPrice: bestBid,
        totalCost: 0,
      };
    }

    const averagePrice = totalRevenue / totalTokens;
    const impactPercent = midPrice > 0 ? ((midPrice - averagePrice) / midPrice) * 100 : 0;

    return {
      impactPercent: Math.max(0, impactPercent),
      averagePrice,
      executionPrice: averagePrice,
      totalCost: totalRevenue,
    };
  }
}

/**
 * Calculate price impact for common trade sizes
 * Returns impact for $100, $500, $1000, $5000 trades
 */
export function calculateCommonImpactSizes(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  currentPrice: number
): {
  buy: { size: number; impact: number }[];
  sell: { size: number; impact: number }[];
} {
  const sizes = [100, 500, 1000, 5000]; // USDC amounts
  
  const buyImpacts = sizes.map(size => {
    const tokenSize = size / currentPrice; // Convert USDC to tokens
    const impact = calculatePriceImpact(bids, asks, tokenSize, 'buy');
    return { size, impact: impact.impactPercent };
  });

  const sellImpacts = sizes.map(size => {
    const tokenSize = size / currentPrice; // Convert USDC to tokens
    const impact = calculatePriceImpact(bids, asks, tokenSize, 'sell');
    return { size, impact: impact.impactPercent };
  });

  return {
    buy: buyImpacts,
    sell: sellImpacts,
  };
}

