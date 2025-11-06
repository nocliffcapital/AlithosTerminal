'use client';

import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';

interface SlippageWarningProps {
  slippage: number; // Percentage slippage
  priceImpact: number; // Price impact in percentage
  estimatedLoss: bigint; // Estimated loss in USDC (6 decimals)
  currentPrice: number;
  estimatedPrice: number;
  className?: string;
}

export function SlippageWarning({
  slippage,
  priceImpact,
  estimatedLoss,
  currentPrice,
  estimatedPrice,
  className,
}: SlippageWarningProps) {
  const isHighSlippage = slippage > 1; // More than 1% slippage
  const isVeryHighSlippage = slippage > 3; // More than 3% slippage
  const isHighImpact = priceImpact > 5; // More than 5% price impact

  const lossInUSDC = Number(formatUnits(estimatedLoss, 6));

  if (!isHighSlippage && !isHighImpact) {
    return null;
  }

  const getSeverity = () => {
    if (isVeryHighSlippage || isHighImpact) return 'high';
    if (isHighSlippage) return 'medium';
    return 'low';
  };

  const severity = getSeverity();

  const getColor = () => {
    if (severity === 'high') return 'text-red-400 border-red-500/20 bg-red-500/10';
    if (severity === 'medium') return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10';
    return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
  };

  return (
    <div className={cn('p-3 rounded border space-y-2', getColor(), className)}>
      <div className="flex items-start gap-2">
        {severity === 'high' ? (
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
        ) : (
          <TrendingDown className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium mb-1">
            {severity === 'high' ? 'High Slippage Warning' : 'Slippage Warning'}
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span>Estimated Slippage:</span>
              <span className="font-mono">{slippage.toFixed(2)}%</span>
            </div>
            {priceImpact > 0 && (
              <div className="flex items-center justify-between">
                <span>Price Impact:</span>
                <span className="font-mono">{priceImpact.toFixed(2)}%</span>
              </div>
            )}
            {estimatedLoss > 0n && (
              <div className="flex items-center justify-between">
                <span>Estimated Loss:</span>
                <span className="font-mono">${lossInUSDC.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-current/20">
              <span>Current Price:</span>
              <span className="font-mono">{(currentPrice * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated Price:</span>
              <span className="font-mono">{(estimatedPrice * 100).toFixed(2)}%</span>
            </div>
          </div>
          {severity === 'high' && (
            <div className="text-xs mt-2 pt-2 border-t border-current/20">
              <strong>Warning:</strong> This trade has high slippage. Consider reducing the trade size or waiting for better liquidity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

