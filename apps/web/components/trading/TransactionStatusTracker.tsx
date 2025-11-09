'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/Toast';

interface TransactionStatusTrackerProps {
  transactionHash: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

type TransactionStatus = 'pending' | 'confirming' | 'processing' | 'success' | 'error';

export function TransactionStatusTracker({ transactionHash, onComplete, onError }: TransactionStatusTrackerProps) {
  const [status, setStatus] = useState<TransactionStatus>('pending');
  const [confirmations, setConfirmations] = useState(0);
  const [estimatedConfirmations, setEstimatedConfirmations] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const { success, error: showError } = useToast();

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  // Poll transaction status
  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', transactionHash],
    queryFn: async () => {
      try {
        const tx = await publicClient.getTransaction({ hash: transactionHash as `0x${string}` });
        const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash as `0x${string}` });
        
        if (receipt) {
          if (receipt.status === 'success') {
            setStatus('success');
            setConfirmations(estimatedConfirmations);
            if (onComplete) {
              onComplete();
            }
            success('Transaction confirmed', 'Transaction has been successfully confirmed.');
          } else {
            setStatus('error');
            setError('Transaction failed on-chain');
            if (onError) {
              onError(new Error('Transaction failed'));
            }
            showError('Transaction failed', 'Transaction was reverted on-chain.');
          }
          return receipt;
        }
        
        // Transaction is pending
        setStatus('confirming');
        
        // Estimate confirmations based on block number
        const currentBlock = await publicClient.getBlockNumber();
        const blockNumber = tx.blockNumber || currentBlock;
        const confirmationsCount = Number(currentBlock - blockNumber);
        setConfirmations(confirmationsCount);
        
        // Estimate time remaining (Polygon averages ~2 seconds per block)
        const blocksRemaining = estimatedConfirmations - confirmationsCount;
        const secondsRemaining = blocksRemaining * 2;
        setEstimatedTimeRemaining(secondsRemaining);
        
        return { tx, receipt: null };
      } catch (err) {
        console.error('Transaction status error:', err);
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transaction status';
        setError(errorMessage);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
        throw err;
      }
    },
    enabled: !!transactionHash && status !== 'success' && status !== 'error',
    refetchInterval: (data) => {
      // Stop polling if transaction is confirmed
      if (data && typeof data === 'object' && 'receipt' in data && data.receipt) {
        return false;
      }
      // Also stop if data is a TransactionReceipt (successful transaction)
      if (data && typeof data === 'object' && 'status' in data && data.status === 'success') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  const confirmationProgress = (confirmations / estimatedConfirmations) * 100;

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-400" />;
      case 'confirming':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'pending':
        return 'Transaction submitted to network';
      case 'confirming':
        return `Confirming... (${confirmations}/${estimatedConfirmations} confirmations)`;
      case 'processing':
        return 'Processing transaction...';
      case 'success':
        return 'Transaction confirmed successfully';
      case 'error':
        return error || 'Transaction failed';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="text-sm font-medium">{getStatusMessage()}</div>
          {status === 'confirming' && (
            <div className="text-xs text-muted-foreground mt-1">
              {estimatedTimeRemaining !== null && `Estimated time remaining: ${formatTime(estimatedTimeRemaining)}`}
            </div>
          )}
        </div>
      </div>

      {status === 'confirming' && (
        <div className="space-y-2">
          <Progress value={confirmationProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Block confirmations: {confirmations}/{estimatedConfirmations}</span>
            <span>{confirmationProgress.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Transaction confirmed on Polygon</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error || 'Transaction failed'}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <a
          href={`https://polygonscan.com/tx/${transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View on PolygonScan
        </a>
        {status === 'success' && (
          <span className="text-xs text-muted-foreground">
            • Completed in {Math.round((Date.now() - startTime) / 1000)}s
          </span>
        )}
      </div>
    </div>
  );
}

