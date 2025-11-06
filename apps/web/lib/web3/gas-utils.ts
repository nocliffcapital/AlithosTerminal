import { createPublicClient, http, Address } from 'viem';
import { polygon } from 'viem/chains';

/**
 * Gas price estimation utilities
 */
export interface GasPrice {
  slow: bigint; // gwei
  standard: bigint; // gwei
  fast: bigint; // gwei
  instant: bigint; // gwei
}

export interface GasSettings {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasLimit?: bigint;
}

/**
 * Get current gas prices from network
 */
export async function getGasPrices(): Promise<GasPrice> {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    // Get fee data from network
    const feeData = await publicClient.estimateFeesPerGas();

    // Convert to gwei
    const standard = feeData.maxFeePerGas || 30n * 10n ** 9n; // 30 gwei default
    const priority = feeData.maxPriorityFeePerGas || 30n * 10n ** 8n; // 3 gwei default

    // Calculate different gas price tiers
    const slow = standard * 80n / 100n; // 80% of standard
    const standardPrice = standard;
    const fast = standard * 120n / 100n; // 120% of standard
    const instant = standard * 150n / 100n; // 150% of standard

    return {
      slow: slow / 10n ** 9n, // Convert to gwei
      standard: standardPrice / 10n ** 9n,
      fast: fast / 10n ** 9n,
      instant: instant / 10n ** 9n,
    };
  } catch (error) {
    console.error('Failed to fetch gas prices:', error);
    // Return default values
    return {
      slow: 30n,
      standard: 40n,
      fast: 50n,
      instant: 60n,
    };
  }
}

/**
 * Estimate gas limit for a transaction
 */
export async function estimateGasLimit(
  to: Address,
  data: `0x${string}`,
  from: Address
): Promise<bigint> {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    const gasEstimate = await publicClient.estimateGas({
      to,
      data,
      account: from,
    });

    // Add 20% buffer for safety
    return (gasEstimate * 120n) / 100n;
  } catch (error) {
    console.error('Gas estimation failed:', error);
    // Return default fallback
    return 300000n;
  }
}

/**
 * Get gas settings based on priority
 */
export async function getGasSettings(priority: 'slow' | 'standard' | 'fast' | 'instant' = 'standard'): Promise<GasSettings> {
  const gasPrices = await getGasPrices();
  
  const selectedPrice = gasPrices[priority];
  const maxFeePerGas = selectedPrice * 10n ** 9n; // Convert back to wei
  const maxPriorityFeePerGas = maxFeePerGas * 10n / 100n; // 10% of max fee

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

/**
 * Format gas price for display
 */
export function formatGasPrice(gwei: bigint): string {
  return `${gwei.toString()} gwei`;
}

/**
 * Calculate gas cost in USD (approximate)
 */
export function calculateGasCostUSD(gasLimit: bigint, gasPriceGwei: bigint, maticPriceUSD: number = 0.5): number {
  const gasUsed = Number(gasLimit);
  const gasPrice = Number(gasPriceGwei);
  const gasCostMatic = (gasUsed * gasPrice) / 1e9; // Convert to MATIC
  return gasCostMatic * maticPriceUSD;
}

