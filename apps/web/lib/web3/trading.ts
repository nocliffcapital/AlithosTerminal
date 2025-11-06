// Web3 trading execution for Polymarket
import { createPublicClient, createWalletClient, custom, parseUnits, formatUnits, Address } from 'viem';
import { polygon } from 'viem/chains';
import { usePrivy } from '@privy-io/react-auth';
import {
  CONDITIONAL_TOKENS_ADDRESS,
  FPMM_ADDRESS,
  USDC_ADDRESS,
  fpmmABI,
  erc20ABI,
  conditionalTokensABI,
  TradeParams,
  TradeResult,
} from './polymarket-contracts';

// Helper to get viem clients from Privy wallet
export function useTrading() {
  const { user, getAccessToken } = usePrivy();
  const wallet = user?.wallet;

  const getPublicClient = () => {
    return createPublicClient({
      chain: polygon,
      transport: custom(window.ethereum),
    });
  };

  const getWalletClient = async () => {
    if (!window.ethereum) {
      throw new Error('No wallet found');
    }
    return createWalletClient({
      chain: polygon,
      transport: custom(window.ethereum),
    });
  };

  const checkAndApproveUSDC = async (amount: bigint): Promise<boolean> => {
    try {
      const publicClient = getPublicClient();
      
      if (!user?.wallet?.address) {
        throw new Error('No wallet connected');
      }

      const address = user.wallet.address as Address;
      
      // Check current allowance
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [address, FPMM_ADDRESS],
      });

      if (allowance >= amount) {
        return true; // Already approved
      }

      // Approve USDC
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'approve',
        args: [FPMM_ADDRESS, amount],
        account: address,
      });

      // Wait for confirmation
      const publicClient2 = getPublicClient();
      await publicClient2.waitForTransactionReceipt({ hash });

      return true;
    } catch (error) {
      console.error('USDC approval error:', error);
      return false;
    }
  };

  const estimateGas = async (params: TradeParams): Promise<bigint> => {
    try {
      const publicClient = getPublicClient();
      
      // Estimate gas for trade
      const gasEstimate = await publicClient.estimateGas({
        account: user?.wallet?.address as Address,
        to: FPMM_ADDRESS,
        data: '0x', // Simplified - would include actual call data
      });

      return gasEstimate;
    } catch (error) {
      console.error('Gas estimation error:', error);
      return BigInt(300000); // Default fallback
    }
  };

  const buy = async (params: TradeParams): Promise<TradeResult> => {
    try {
      if (!user?.wallet?.address) {
        throw new Error('No wallet connected');
      }

      const address = user.wallet.address as Address;
      
      // Validate network
      const networkValidation = await validateNetwork();
      if (!networkValidation.isValid) {
        throw new Error(networkValidation.error || 'Please switch to Polygon network');
      }

      // Verify contract ABI (only in development or first time)
      if (process.env.NODE_ENV === 'development') {
        try {
          const abiValidation = await verifyFPMMABI();
          if (!abiValidation.isValid) {
            console.warn('FPMM ABI validation failed:', abiValidation.error);
            // Don't throw - just log warning
          }
        } catch (error) {
          console.warn('ABI verification error:', error);
          // Don't throw - just log warning
        }
      }

      // Check balance before transaction
      const balanceCheck = await checkUSDCBalance(address, params.amount);
      if (!balanceCheck.hasEnoughBalance) {
        throw new Error(getBalanceErrorMessage(balanceCheck, 'USDC'));
      }

      // Estimate gas cost
      const gasEstimate = await estimateGas(params);
      const gasPrice = await getPublicClient().getGasPrice();
      const estimatedGasCost = gasEstimate * gasPrice;

      // Check POL balance for gas
      const polBalanceCheck = await checkPOLBalance(address, estimatedGasCost);
      if (!polBalanceCheck.hasEnoughBalance) {
        throw new Error(getBalanceErrorMessage(polBalanceCheck, 'POL'));
      }

      // Always simulate transaction before execution
      const simulation = await simulateTrade(params, 0.5); // Would get current price
      if (!simulation.success) {
        throw new Error(simulation.error || 'Transaction simulation failed');
      }

      const publicClient = getPublicClient();
      const walletClient = await getWalletClient();

      // Calculate outcome index (0 = YES, 1 = NO)
      const outcomeIndex = params.outcome === 'YES' ? 0n : 1n;

      // Check and approve USDC if needed
      const approved = await checkAndApproveUSDC(params.amount);
      if (!approved) {
        throw new Error('USDC approval failed');
      }

      // Get minimum outcome tokens (optional - can calculate from current price)
      const minOutcomeTokens = params.minOutcomeTokens || 0n;

      // Execute buy
      const hash = await walletClient.writeContract({
        address: FPMM_ADDRESS,
        abi: fpmmABI,
        functionName: 'buy',
        args: [params.amount, outcomeIndex, minOutcomeTokens],
        account: address,
        gas: await estimateGas(params),
      });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Parse result from receipt logs if needed
        return {
          success: true,
          transactionHash: hash,
          outcomeTokensBought: BigInt(0), // Would parse from receipt logs
        };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Buy error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  const sell = async (params: TradeParams): Promise<TradeResult> => {
    try {
      if (!user?.wallet?.address) {
        throw new Error('No wallet connected');
      }

      const address = user.wallet.address as Address;
      const publicClient = getPublicClient();
      const walletClient = await getWalletClient();

      const outcomeIndex = params.outcome === 'YES' ? 0n : 1n;
      const maxOutcomeTokens = params.maxOutcomeTokens || BigInt('999999999999999999999999');

      // Execute sell
      const hash = await walletClient.writeContract({
        address: FPMM_ADDRESS,
        abi: fpmmABI,
        functionName: 'sell',
        args: [params.amount, outcomeIndex, maxOutcomeTokens],
        account: address,
        gas: await estimateGas(params),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        return {
          success: true,
          transactionHash: hash,
        };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Sell error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  const calculateBuyAmount = async (
    investmentAmount: bigint,
    outcome: 'YES' | 'NO'
  ): Promise<bigint> => {
    try {
      const publicClient = getPublicClient();
      const outcomeIndex = outcome === 'YES' ? 0 : 1;

      const result = await publicClient.readContract({
        address: FPMM_ADDRESS,
        abi: fpmmABI,
        functionName: 'calcBuyAmount',
        args: [investmentAmount, BigInt(outcomeIndex)],
      });

      return result as bigint;
    } catch (error) {
      console.error('Calculate buy amount error:', error);
      return 0n;
    }
  };

  const calculateSellAmount = async (
    returnAmount: bigint,
    outcome: 'YES' | 'NO'
  ): Promise<bigint> => {
    try {
      const publicClient = getPublicClient();
      const outcomeIndex = outcome === 'YES' ? 0 : 1;

      const result = await publicClient.readContract({
        address: FPMM_ADDRESS,
        abi: fpmmABI,
        functionName: 'calcSellAmount',
        args: [returnAmount, BigInt(outcomeIndex)],
      });

      return result as bigint;
    } catch (error) {
      console.error('Calculate sell amount error:', error);
      return 0n;
    }
  };

  return {
    buy,
    sell,
    calculateBuyAmount,
    calculateSellAmount,
    checkAndApproveUSDC,
    estimateGas,
  };
}

