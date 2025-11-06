'use client';

import React, { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'viem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useMarketStore } from '@/stores/market-store';
import { useTrading } from '@/lib/hooks/useTrading';
import { TradeParams } from '@/lib/web3/polymarket-contracts';
import { usePrivy } from '@privy-io/react-auth';
import { RiskWarning } from '@/components/ui/RiskWarning';
import { useTradingSettingsStore } from '@/stores/trading-settings-store';
import { simulateTrade } from '@/lib/web3/trade-simulation';
import { TransactionStatusTracker } from '@/components/trading/TransactionStatusTracker';

export interface TransactionDetails {
  type: 'buy' | 'sell';
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: bigint; // in USDC (with decimals)
  amountDisplay: number; // in USDC (human-readable)
  currentPrice?: number;
  estimatedOutcomeTokens?: bigint;
  estimatedGas?: bigint;
  needsApproval?: boolean;
}

interface TransactionConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionDetails | null;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
  transactionHash?: string | null;
}

const POLYGONSCAN_BASE = 'https://polygonscan.com/tx';

export function TransactionConfirmModal({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  onCancel,
  transactionHash: externalHash,
}: TransactionConfirmModalProps) {
  const { getMarket } = useMarketStore();
  const { estimateGas, calculateBuyAmount, calculateSellAmount } = useTrading();
  const { user } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'confirming' | 'pending' | 'success' | 'error'>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimatedGasGwei, setEstimatedGasGwei] = useState<number | null>(null);
  const [estimatedOutcomeTokens, setEstimatedOutcomeTokens] = useState<bigint | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const { settings } = useTradingSettingsStore();

  // Update transaction hash when external hash changes
  useEffect(() => {
    if (externalHash) {
      setTransactionHash(externalHash);
      if (transactionStatus === 'pending') {
        setTransactionStatus('success');
      }
    }
  }, [externalHash, transactionStatus]);

  const market = transaction ? getMarket(transaction.marketId) : null;
  const currentPrice = transaction?.currentPrice || (market?.outcomePrices?.[transaction?.outcome || 'YES'] || 0.5);

  // Estimate gas and outcome tokens when transaction changes, and simulate
  useEffect(() => {
    if (!transaction || !open) return;

    const estimate = async () => {
      setIsEstimating(true);
      try {
        // Always simulate transaction first
        const simulation = await simulateTrade({
          marketId: transaction.marketId,
          outcome: transaction.outcome,
          amount: transaction.amount,
        }, currentPrice);

        setSimulationResult(simulation);

        if (simulation.success) {
          setEstimatedOutcomeTokens(simulation.estimatedOutcomeTokens);
        }

        // Estimate gas
        const gasEstimate = await estimateGas({
          marketId: transaction.marketId,
          outcome: transaction.outcome,
          amount: transaction.amount,
        });
        
        // Get gas price from provider
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = window.ethereum;
          const gasPrice = await provider.request({
            method: 'eth_gasPrice',
            params: [],
          });
          const gasPriceGwei = Number(formatUnits(BigInt(gasPrice as string), 9));
          setEstimatedGasGwei(gasPriceGwei);
        }

        // Calculate outcome tokens (fallback if simulation didn't work)
        if (!simulation.success || !estimatedOutcomeTokens) {
          if (transaction.type === 'buy') {
            const outcomeTokens = await calculateBuyAmount(transaction.amount, transaction.outcome);
            setEstimatedOutcomeTokens(outcomeTokens);
          } else {
            const outcomeTokens = await calculateSellAmount(transaction.amount, transaction.outcome);
            setEstimatedOutcomeTokens(outcomeTokens);
          }
        }
      } catch (err) {
        console.error('Error estimating transaction:', err);
      } finally {
        setIsEstimating(false);
      }
    };

    estimate();
  }, [transaction, open, currentPrice, estimateGas, calculateBuyAmount, calculateSellAmount]);

  const handleConfirm = async () => {
    if (!transaction) return;

    setIsLoading(true);
    setTransactionStatus('confirming');
    setError(null);

    try {
      await onConfirm();
      // If onConfirm doesn't throw, transaction was submitted
      // The transaction hash will be set by the parent component via externalHash prop
      setTransactionStatus('pending');
      setIsLoading(false);
      // If we already have a hash, mark as success immediately
      if (externalHash) {
        setTransactionHash(externalHash);
        setTransactionStatus('success');
      }
    } catch (err: any) {
      setTransactionStatus('error');
      setError(err.message || 'Transaction failed');
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
    // Reset state
    setTimeout(() => {
      setTransactionStatus('idle');
      setError(null);
      setTransactionHash(null);
      setIsLoading(false);
    }, 300);
  };

  const handleClose = () => {
    if (transactionStatus === 'pending' || transactionStatus === 'confirming') {
      // Don't close if transaction is in progress
      return;
    }
    handleCancel();
  };

  if (!transaction) return null;

  const estimatedGasCost = estimatedGasGwei && estimatedGasGwei > 0 
    ? (estimatedGasGwei * 300000) / 1e9 // Rough estimate: gas price * gas limit / 1e9
    : null;

  const outcomeTokenDisplay = estimatedOutcomeTokens 
    ? formatUnits(estimatedOutcomeTokens, 18)
    : null;

  const amountDisplay = transaction.amountDisplay.toFixed(2);
  const currentPricePercent = (currentPrice * 100).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {transactionStatus === 'idle' && `Confirm ${transaction.type === 'buy' ? 'Buy' : 'Sell'}`}
            {transactionStatus === 'confirming' && 'Confirming Transaction...'}
            {transactionStatus === 'pending' && 'Transaction Pending'}
            {transactionStatus === 'success' && 'Transaction Successful'}
            {transactionStatus === 'error' && 'Transaction Failed'}
          </DialogTitle>
          <DialogDescription>
            {transactionStatus === 'idle' && 'Review transaction details before confirming'}
            {transactionStatus === 'confirming' && 'Please confirm the transaction in your wallet'}
            {transactionStatus === 'pending' && 'Your transaction is being processed'}
            {transactionStatus === 'success' && 'Transaction completed successfully'}
            {transactionStatus === 'error' && 'Transaction could not be completed'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Risk Warning */}
          {transactionStatus === 'idle' && (
            <RiskWarning variant="modal" className="mb-4" />
          )}
          
          {/* Market Info */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Market</div>
            <div className="text-sm font-medium">{market?.question || transaction.marketId}</div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className={`text-sm font-medium ${transaction.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {transaction.type === 'buy' ? 'Buy' : 'Sell'} {transaction.outcome}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span className="text-sm font-medium">${amountDisplay} USDC</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current Price</span>
              <span className="text-sm font-medium">{currentPricePercent}%</span>
            </div>

            {outcomeTokenDisplay && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Estimated {transaction.outcome === 'YES' ? 'YES' : 'NO'} Tokens
                </span>
                <span className="text-sm font-medium">
                  {parseFloat(outcomeTokenDisplay).toFixed(4)}
                </span>
              </div>
            )}

            {estimatedGasCost && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimated Gas</span>
                <span className="text-sm font-medium">
                  ~{estimatedGasCost.toFixed(4)} MATIC
                </span>
              </div>
            )}

            {transaction.needsApproval && (
              <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span>USDC approval required. This will require two transactions.</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {transactionStatus === 'success' && transactionHash && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <div className="flex-1">
                <div>Transaction successful!</div>
                <a
                  href={`${POLYGONSCAN_BASE}/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs underline hover:no-underline mt-1"
                >
                  View on PolygonScan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isEstimating && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Estimating transaction costs...</span>
            </div>
          )}

          {/* Transaction Status */}
          {transactionStatus === 'confirming' && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for wallet confirmation...</span>
            </div>
          )}

          {transactionStatus === 'pending' && transactionHash && (
            <TransactionStatusTracker
              transactionHash={transactionHash}
              onComplete={() => {
                setTransactionStatus('success');
                setTimeout(() => {
                  onOpenChange(false);
                }, 3000);
              }}
              onError={(error: Error) => {
                setTransactionStatus('error');
                setError(error.message);
              }}
            />
          )}
        </div>

        <DialogFooter>
          {transactionStatus === 'idle' && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || isEstimating}
                className={transaction.type === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  `Confirm ${transaction.type === 'buy' ? 'Buy' : 'Sell'}`
                )}
              </Button>
            </>
          )}

          {(transactionStatus === 'success' || transactionStatus === 'error') && (
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

