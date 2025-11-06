'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Address } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ExternalLink, Copy } from 'lucide-react';
import { useToast } from './Toast';

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Deposit modal for USDC deposits
 * Allows users to transfer USDC to their wallet
 */
export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { user } = usePrivy();
  const { success } = useToast();

  const walletAddress = user?.wallet?.address as Address | undefined;

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      success('Address copied', 'Wallet address copied to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deposit USDC</DialogTitle>
          <DialogDescription>
            Transfer USDC to your wallet to start trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <Label>Your Wallet Address</Label>
            <div className="flex items-center gap-2">
              <Input
                value={walletAddress || ''}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
                className="flex-shrink-0"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-xs text-muted-foreground">Instructions:</div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground ml-2">
              <li>Send USDC to the address above</li>
              <li>Ensure you're on Polygon network</li>
              <li>Wait for confirmation (usually 1-2 minutes)</li>
              <li>Your balance will update automatically</li>
            </ol>
            <div className="pt-2">
              <a
                href={`https://polygonscan.com/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-sm"
              >
                View on PolygonScan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopyAddress}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

