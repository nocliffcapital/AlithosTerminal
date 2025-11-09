'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RiskWarningProps {
  variant?: 'banner' | 'inline' | 'modal';
  dismissible?: boolean;
  className?: string;
  onDismiss?: () => void;
}

const STORAGE_KEY = 'risk-warning-dismissed';

/**
 * RiskWarning - Displays trading risk warnings and disclaimers
 */
export function RiskWarning({ 
  variant = 'banner', 
  dismissible = false,
  className,
  onDismiss 
}: RiskWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (dismissible && typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
      if (isDismissed) {
        setDismissed(true);
      }
    }
  }, [dismissible]);

  // Update CSS variable with banner height (only for banner variant)
  useEffect(() => {
    if (variant === 'banner' && bannerRef.current && !dismissed) {
      const height = bannerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--risk-banner-height', `${height}px`);
    } else if (variant === 'banner') {
      document.documentElement.style.setProperty('--risk-banner-height', '0px');
    }
  }, [variant, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onDismiss?.();
  };

  if (dismissed && dismissible) {
    return null;
  }

  const warningText = (
    <>
      <strong>Trading Risk Warning:</strong> Prediction markets involve substantial risk of loss. 
      You may lose some or all of your invested capital. Past performance does not guarantee future results. 
      Only trade with funds you can afford to lose. Markets may be illiquid, and prices can be highly volatile. 
      Smart contracts are subject to technical risks and potential bugs. Always do your own research.
    </>
  );

  if (variant === 'modal') {
    return (
      <div className={cn('p-4 bg-red-500/10 border border-red-500/20 rounded-lg', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="text-sm font-semibold text-red-400">Trading Risk Warning</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {warningText}
            </div>
            <div className="text-[10px] text-muted-foreground/80 space-y-1 mt-3">
              <div><strong>Key Risks:</strong></div>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Market resolution may be ambiguous or disputed</li>
                <li>Liquidity can be low, causing high slippage</li>
                <li>Smart contract bugs or exploits could result in loss of funds</li>
                <li>Regulatory changes could affect market operations</li>
                <li>Prices can move rapidly and unpredictably</li>
              </ul>
            </div>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
            >
              <X className="h-4 w-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs', className)}>
        <div className="flex items-start gap-2">
          <Info className="h-3 w-3 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-muted-foreground">
            {warningText}
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="p-0.5 hover:bg-yellow-500/20 rounded transition-colors"
            >
              <X className="h-3 w-3 text-yellow-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Banner variant (default)
  // Position below NetworkValidationBanner if it exists
  return (
    <div 
      ref={bannerRef}
      className={cn('fixed left-0 right-0 z-40 bg-gradient-to-r from-red-500/10 via-red-500/8 to-red-500/10 border-b border-red-500/20 backdrop-blur-sm', className)} 
      style={{ top: 'var(--network-banner-height, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          </div>
          <div className="flex-1 text-xs text-red-200/90 leading-relaxed">
            <span className="font-semibold text-red-300">Risk Warning:</span> Trading involves substantial risk of loss. 
            Only trade with funds you can afford to lose. Smart contracts may have bugs or be exploited.
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors group flex-shrink-0"
              title="Dismiss warning"
              aria-label="Dismiss warning"
            >
              <X className="h-3.5 w-3.5 text-red-300 group-hover:text-red-200" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

