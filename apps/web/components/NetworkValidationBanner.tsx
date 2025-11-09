'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { validateNetwork, switchToPolygon } from '@/lib/web3/network-validation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NetworkValidationBanner() {
  const [validation, setValidation] = useState<any>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Update CSS variable with banner height
    if (bannerRef.current && !isDismissed && validation && !validation.isValid) {
      const height = bannerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--network-banner-height', `${height}px`);
    } else {
      document.documentElement.style.setProperty('--network-banner-height', '0px');
    }
  }, [validation, isDismissed]);

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
    <div 
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border-b border-amber-500/30 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-300 mb-0.5">
                Wrong Network Detected
              </div>
              <div className="text-xs text-amber-200/80">
                Connected to <span className="font-medium">{validation.chainName}</span>. Switch to Polygon to continue trading.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
              className="h-8 px-4 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm hover:shadow transition-all"
            >
              {isSwitching ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Switch to Polygon
                </>
              )}
            </Button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 hover:bg-amber-500/20 rounded-md transition-colors group"
              title="Dismiss warning"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4 text-amber-300 group-hover:text-amber-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

