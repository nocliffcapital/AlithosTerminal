'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits, Address, isAddress } from 'viem';
import { polygon } from 'viem/chains';
import { erc20ABI, USDC_ADDRESS } from '@/lib/web3/polymarket-contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance?: string;
}

/**
 * Withdraw modal for USDC withdrawals
 * Allows users to transfer USDC from their wallet to another address
 */
export function WithdrawModal({ open, onOpenChange, currentBalance }: WithdrawModalProps) {
  const { user, authenticated } = usePrivy();
  const { success, error: showError } = useToast();
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<string>('0');

  const walletAddress = user?.wallet?.address as Address | undefined;

  // Fetch current balance
  useEffect(() => {
    if (open && authenticated && walletAddress) {
      fetchBalance();
    }
  }, [open, authenticated, walletAddress]);

  const fetchBalance = async () => {
    if (!walletAddress) return;

    setIsCheckingBalance(true);
    try {
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com'),
      });

      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      });

      setAvailableBalance(formatUnits(balance, 6));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setAvailableBalance(currentBalance || '0');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const handleWithdraw = async () => {
    if (!authenticated || !walletAddress || !amount || !recipient) {
      showError('Invalid input', 'Please fill in all fields');
      return;
    }

    // Validate recipient address
    if (!isAddress(recipient)) {
      showError('Invalid address', 'Please enter a valid Ethereum address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showError('Invalid amount', 'Please enter a valid amount greater than 0');
      return;
    }

    const availableNum = parseFloat(availableBalance);
    if (amountNum > availableNum) {
      showError('Insufficient balance', `You have ${availableBalance} USDC available`);
      return;
    }

    setIsLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('No wallet found');
      }

      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom(window.ethereum),
      });

      const publicClient = createPublicClient({
        chain: polygon,
        transport: custom(window.ethereum),
      });

      // Convert amount to USDC (6 decimals)
      const amountWei = parseUnits(amountNum.toFixed(6), 6);

      // Transfer USDC
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'transfer',
        args: [recipient as Address, amountWei],
      });

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      success(
        'Withdrawal successful',
        `${amount} USDC has been sent to ${recipient.slice(0, 6)}...${recipient.slice(-6)}`
      );

      // Close modal and reset
      onOpenChange(false);
      setAmount('');
      setRecipient('');
      fetchBalance(); // Refresh balance
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process withdrawal';
      showError('Withdrawal failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxAmount = () => {
    if (availableBalance) {
      setAmount(availableBalance);
    }
  };

  const quickAmounts = [10, 50, 100, 500];

  const balanceNum = parseFloat(availableBalance);
  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum > 0 && amountNum <= balanceNum && isAddress(recipient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
          <DialogDescription>
            Transfer USDC from your wallet to another address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Available Balance */}
          <div className="space-y-2">
            <Label>Available Balance</Label>
            <div className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance:</span>
                {isCheckingBalance ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="font-mono font-semibold text-lg text-foreground">{availableBalance} USDC</span>
                )}
              </div>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label>Recipient Address</Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="font-mono text-xs"
              disabled={isLoading}
            />
            {recipient && !isAddress(recipient) && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Invalid address format
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount (USDC)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-mono flex-1"
                disabled={isLoading}
                max={availableBalance}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaxAmount}
                disabled={isLoading || !availableBalance || parseFloat(availableBalance) <= 0}
              >
                Max
              </Button>
            </div>
            <div className="flex gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const quickNum = parseFloat(availableBalance) >= quickAmount ? quickAmount : parseFloat(availableBalance);
                    setAmount(quickNum.toString());
                  }}
                  className="text-xs"
                  disabled={isLoading || parseFloat(availableBalance) < quickAmount}
                >
                  ${quickAmount}
                </Button>
              ))}
            </div>
            {amountNum > balanceNum && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Amount exceeds available balance
              </div>
            )}
          </div>

          {/* Transaction Info */}
          {isValid && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Amount:</span>
                <span className="text-sm font-medium">{amount} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Recipient:</span>
                <span className="text-sm font-medium font-mono">{recipient.slice(0, 8)}...{recipient.slice(-6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Network:</span>
                <span className="text-sm font-medium">Polygon</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-yellow-400">Warning</p>
              <p className="text-muted-foreground text-xs">
                Double-check the recipient address. Transactions cannot be reversed.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setAmount('');
              setRecipient('');
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={isLoading || !isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Withdraw'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

