'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { validateNetwork, switchToPolygon } from '@/lib/web3/network-validation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NetworkValidationBanner() {
  const [validation, setValidation] = useState<any>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      setIsChecking(true);
      const result = await validateNetwork();
      setValidation(result);
      setIsChecking(false);
    };

    checkNetwork();

    // Listen for chain changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = () => {
        checkNetwork();
      };

      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    const success = await switchToPolygon();
    if (success) {
      // Re-check after switching
      const result = await validateNetwork();
      setValidation(result);
    }
    setIsSwitching(false);
  };

  // Don't show if network is valid, dismissed, or not checked yet
  if (!validation || validation.isValid || isDismissed || isChecking) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-yellow-400">
            Wrong Network Detected
          </div>
          <div className="text-xs text-muted-foreground">
            You&apos;re on {validation.chainName}. Please switch to Polygon to continue trading.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSwitchNetwork}
          disabled={isSwitching}
          className="h-7 px-3 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30"
        >
          {isSwitching ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Switching...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Switch to Polygon
            </>
          )}
        </Button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-yellow-500/20 rounded transition-colors"
          title="Dismiss"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3 text-yellow-400" />
        </button>
      </div>
    </div>
  );
}

