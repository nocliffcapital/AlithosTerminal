import { Address, formatUnits, parseUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { USDC_ADDRESS, FPMM_ADDRESS } from './polymarket-contracts';
import { erc20Abi } from 'viem';

export interface BalanceCheckResult {
  hasEnoughBalance: boolean;
  currentBalance: bigint;
  requiredBalance: bigint;
  balanceShortfall: bigint;
  error?: string;
}

/**
 * Check if user has sufficient USDC balance for a transaction
 */
export async function checkUSDCBalance(
  userAddress: Address,
  requiredAmount: bigint
): Promise<BalanceCheckResult> {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    // Get USDC balance (6 decimals)
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;

    const hasEnoughBalance = balance >= requiredAmount;
    const balanceShortfall = hasEnoughBalance ? 0n : requiredAmount - balance;

    return {
      hasEnoughBalance,
      currentBalance: balance,
      requiredBalance: requiredAmount,
      balanceShortfall,
    };
  } catch (error) {
    console.error('USDC balance check error:', error);
    return {
      hasEnoughBalance: false,
      currentBalance: 0n,
      requiredBalance: requiredAmount,
      balanceShortfall: requiredAmount,
      error: error instanceof Error ? error.message : 'Failed to check balance',
    };
  }
}

/**
 * Check if user has sufficient POL balance for gas
 */
export async function checkPOLBalance(
  userAddress: Address,
  estimatedGasCost: bigint
): Promise<BalanceCheckResult> {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    // Get native POL balance
    const balance = await publicClient.getBalance({ address: userAddress });

    const hasEnoughBalance = balance >= estimatedGasCost;
    const balanceShortfall = hasEnoughBalance ? 0n : estimatedGasCost - balance;

    return {
      hasEnoughBalance,
      currentBalance: balance,
      requiredBalance: estimatedGasCost,
      balanceShortfall,
    };
  } catch (error) {
    console.error('POL balance check error:', error);
    return {
      hasEnoughBalance: false,
      currentBalance: 0n,
      requiredBalance: estimatedGasCost,
      balanceShortfall: estimatedGasCost,
      error: error instanceof Error ? error.message : 'Failed to check balance',
    };
  }
}

/**
 * Check if user has sufficient outcome tokens for a sell
 */
export async function checkOutcomeTokenBalance(
  userAddress: Address,
  conditionId: string,
  outcomeIndex: number,
  requiredAmount: bigint
): Promise<BalanceCheckResult> {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    });

    // Get outcome token balance from Conditional Tokens contract
    // This would require the Conditional Tokens contract ABI
    // For now, we'll return a placeholder
    // TODO: Implement actual outcome token balance check
    
    return {
      hasEnoughBalance: true, // Placeholder
      currentBalance: 0n,
      requiredBalance: requiredAmount,
      balanceShortfall: 0n,
    };
  } catch (error) {
    console.error('Outcome token balance check error:', error);
    return {
      hasEnoughBalance: false,
      currentBalance: 0n,
      requiredBalance: requiredAmount,
      balanceShortfall: requiredAmount,
      error: error instanceof Error ? error.message : 'Failed to check balance',
    };
  }
}

/**
 * Format balance for display
 */
export function formatBalance(balance: bigint, decimals: number = 6): string {
  return formatUnits(balance, decimals);
}

/**
 * Get user-friendly error message for insufficient balance
 */
export function getBalanceErrorMessage(result: BalanceCheckResult, currency: 'USDC' | 'POL' = 'USDC'): string {
  if (result.hasEnoughBalance) {
    return '';
  }

  const shortfall = formatBalance(result.balanceShortfall, currency === 'USDC' ? 6 : 18);
  const current = formatBalance(result.currentBalance, currency === 'USDC' ? 6 : 18);
  const required = formatBalance(result.requiredBalance, currency === 'USDC' ? 6 : 18);

  return `Insufficient ${currency} balance. You have ${current} ${currency}, but need ${required} ${currency}. Please deposit ${shortfall} more ${currency}.`;
}

