'use client';

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Address, formatUnits, parseUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { erc20Abi } from 'viem';
import { USDC_ADDRESS, FPMM_ADDRESS } from '@/lib/web3/polymarket-contracts';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AllowanceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AllowanceManager({ open, onOpenChange }: AllowanceManagerProps) {
  const { user } = usePrivy();
  const { success, error: showError } = useToast();
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState<string>('');

  const walletAddress = user?.wallet?.address as Address | undefined;

  useEffect(() => {
    if (open && walletAddress) {
      loadAllowance();
    }
  }, [open, walletAddress]);

  const loadAllowance = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    try {
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com'),
      });

      const currentAllowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [walletAddress, FPMM_ADDRESS],
      }) as bigint;

      setAllowance(currentAllowance);
    } catch (error) {
      console.error('Failed to load allowance:', error);
      showError('Failed to load allowance', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const approveAllowance = async (amount: bigint) => {
    if (!walletAddress || !window.ethereum) {
      showError('Wallet required', 'Please connect your wallet');
      return;
    }

    setIsApproving(true);
    try {
      // Use viem to prepare the transaction
      const { createWalletClient, custom } = await import('viem');
      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom(window.ethereum),
      });

      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [FPMM_ADDRESS, amount],
        account: walletAddress,
      });

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com'),
      });

      await publicClient.waitForTransactionReceipt({ hash });

      success('Allowance approved', 'USDC allowance has been approved successfully.');
      await loadAllowance();
      setApprovalAmount('');
    } catch (error: any) {
      console.error('Failed to approve allowance:', error);
      showError('Failed to approve allowance', error.message || 'Unknown error');
    } finally {
      setIsApproving(false);
    }
  };

  const revokeAllowance = async () => {
    if (!walletAddress || !window.ethereum) {
      showError('Wallet required', 'Please connect your wallet');
      return;
    }

    setIsRevoking(true);
    try {
      // Revoke by setting allowance to 0
      await approveAllowance(0n);
      success('Allowance revoked', 'USDC allowance has been revoked successfully.');
    } catch (error: any) {
      console.error('Failed to revoke allowance:', error);
      showError('Failed to revoke allowance', error.message || 'Unknown error');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalAmount || isNaN(parseFloat(approvalAmount))) {
      showError('Invalid amount', 'Please enter a valid amount');
      return;
    }

    const amount = parseUnits(approvalAmount, 6); // USDC has 6 decimals
    await approveAllowance(amount);
  };

  const formatAllowance = (value: bigint) => {
    return formatUnits(value, 6);
  };

  const isUnlimited = allowance && allowance > parseUnits('1000000000', 6); // > 1 billion USDC

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>USDC Allowance Management</DialogTitle>
          <DialogDescription>
            Manage your USDC allowance for the Polymarket contract. You need to approve USDC before trading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Allowance */}
          <div className="space-y-2">
            <Label>Current Allowance</Label>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : allowance !== null ? (
                  <>
                    {isUnlimited ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : allowance > 0n ? (
                      <CheckCircle2 className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-sm font-mono">
                      {isUnlimited ? 'Unlimited' : `${formatAllowance(allowance)} USDC`}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Loading...</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadAllowance}
                disabled={isLoading}
                className="h-7 px-2"
              >
                <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Approval Amount Input */}
          <div className="space-y-2">
            <Label>Approve Amount (USDC)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={approvalAmount}
              onChange={(e) => setApprovalAmount(e.target.value)}
              disabled={isApproving || isRevoking}
              step="0.01"
              min="0"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalAmount('1000')}
                disabled={isApproving || isRevoking}
                className="text-xs"
              >
                $1,000
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalAmount('10000')}
                disabled={isApproving || isRevoking}
                className="text-xs"
              >
                $10,000
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalAmount('100000')}
                disabled={isApproving || isRevoking}
                className="text-xs"
              >
                $100,000
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalAmount('1000000000')}
                disabled={isApproving || isRevoking}
                className="text-xs"
              >
                Unlimited
              </Button>
            </div>
          </div>

          {/* Warning */}
          {allowance !== null && allowance > 0n && !isUnlimited && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">Current Allowance Active</div>
                <div className="text-muted-foreground">
                  You have an active allowance of {formatAllowance(allowance)} USDC. Approving a new amount will replace the current allowance.
                </div>
              </div>
            </div>
          )}

          {isUnlimited && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">Unlimited Allowance Active</div>
                <div className="text-muted-foreground">
                  You have an unlimited USDC allowance. You can revoke it to set a specific limit.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApproving || isRevoking}
          >
            Close
          </Button>
          <Button
            variant="destructive"
            onClick={revokeAllowance}
            disabled={isApproving || isRevoking || !allowance || allowance === 0n}
          >
            {isRevoking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Revoking...
              </>
            ) : (
              'Revoke Allowance'
            )}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApproving || isRevoking || !approvalAmount}
          >
            {isApproving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              'Approve Allowance'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

