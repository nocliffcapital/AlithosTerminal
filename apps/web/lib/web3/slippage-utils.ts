import { parseUnits, formatUnits } from 'viem';

/**
 * Slippage tolerance utilities
 */
export interface SlippageSettings {
  tolerance: number; // percentage (e.g., 0.5 for 0.5%)
  minOutcomeTokens?: bigint;
  maxOutcomeTokens?: bigint;
}

/**
 * Calculate minimum outcome tokens based on slippage tolerance
 */
export function calculateMinOutcomeTokens(
  expectedOutcomeTokens: bigint,
  slippageTolerance: number // percentage (e.g., 0.5 for 0.5%)
): bigint {
  const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance * 100) * 1e6));
  const minOutcomeTokens = (expectedOutcomeTokens * slippageMultiplier) / (100n * 1000000n);
  return minOutcomeTokens;
}

/**
 * Calculate maximum outcome tokens to sell based on slippage tolerance
 */
export function calculateMaxOutcomeTokens(
  expectedReturnAmount: bigint,
  currentPrice: number, // price as fraction (e.g., 0.5 for 50%)
  slippageTolerance: number // percentage
): bigint {
  // Calculate expected outcome tokens needed
  const expectedOutcomeTokens = expectedReturnAmount / BigInt(Math.floor(currentPrice * 1e6)) * 1000000n;
  
  // Add slippage buffer
  const slippageMultiplier = BigInt(Math.floor((100 + slippageTolerance * 100) * 1e6));
  const maxOutcomeTokens = (expectedOutcomeTokens * slippageMultiplier) / (100n * 1000000n);
  return maxOutcomeTokens;
}

/**
 * Check if slippage is acceptable
 */
export function isSlippageAcceptable(
  expectedPrice: number,
  actualPrice: number,
  maxSlippage: number
): boolean {
  const slippage = Math.abs(actualPrice - expectedPrice) / expectedPrice * 100;
  return slippage <= maxSlippage;
}

/**
 * Calculate slippage percentage
 */
export function calculateSlippage(
  expectedPrice: number,
  actualPrice: number
): number {
  return Math.abs(actualPrice - expectedPrice) / expectedPrice * 100;
}

/**
 * Format slippage for display
 */
export function formatSlippage(slippage: number): string {
  if (slippage < 0.01) {
    return '<0.01%';
  }
  return `${slippage.toFixed(2)}%`;
}

/**
 * Get default slippage tolerance based on market conditions
 */
export function getDefaultSlippageTolerance(volume24h?: number, liquidity?: number): number {
  // Higher volume/liquidity = tighter slippage tolerance
  if (volume24h && volume24h > 100000) {
    return 0.5; // 0.5% for high volume markets
  }
  if (liquidity && liquidity > 50000) {
    return 0.5;
  }
  // Default for lower liquidity markets
  return 1.0; // 1% default
}

/**
 * Validate slippage tolerance
 */
export function validateSlippageTolerance(tolerance: number): boolean {
  return tolerance >= 0.1 && tolerance <= 10; // 0.1% to 10%
}

