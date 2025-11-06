'use client';

import React, { useMemo } from 'react';
import { usePositions, useTotalPnL } from '@/lib/hooks/usePositions';
import { useMarketStore } from '@/stores/market-store';
import { Loader2, TrendingUp, TrendingDown, ExternalLink, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';

const POLYGONSCAN_BASE = 'https://polygonscan.com';

function PositionsCardComponent() {
  const { data: positions, isLoading, error } = usePositions(true);
  const { totalCostBasis, totalCurrentValue, totalUnrealizedPnL, totalRealizedPnL, totalPnL, positionCount } = useTotalPnL();
  const { selectMarket } = useMarketStore();

  // Calculate P&L percentage
  const pnlPercentage = totalCostBasis > 0 
    ? ((totalPnL / totalCostBasis) * 100) 
    : 0;

  // Sort positions by unrealized P&L (highest first)
  const sortedPositions = useMemo(() => {
    if (!positions) return [];
    return [...positions].sort((a, b) => {
      const aPnL = a.unrealizedPnL || 0;
      const bPnL = b.unrealizedPnL || 0;
      return bPnL - aPnL;
    });
  }, [positions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="md" text="Loading positions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
        <div className="text-xs text-destructive">
          Failed to load positions
        </div>
        <div className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No positions found"
        description="Start trading to see your positions here. Your open positions will appear with real-time P&L calculations."
      />
    );
  }

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header with Summary */}
      <div className="flex-shrink-0 mb-3 space-y-2 border-b border-border pb-3">
        <div className="text-xs font-medium">Portfolio Summary</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Positions</div>
            <div className="font-mono font-medium">{positionCount}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Value</div>
            <div className="font-mono font-medium">
              ${totalCurrentValue.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Cost</div>
            <div className="font-mono font-medium">
              ${totalCostBasis.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total P&L</div>
            <div className={`font-mono font-medium flex items-center gap-1 ${
              totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {totalPnL >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              ${totalPnL.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
            </div>
          </div>
        </div>
        
        {/* P&L Breakdown */}
        {(totalRealizedPnL !== 0 || totalUnrealizedPnL !== 0) && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
            <div>
              <div className="text-muted-foreground">Realized P&L</div>
              <div className={`font-mono ${
                totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${totalRealizedPnL.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Unrealized P&L</div>
              <div className={`font-mono ${
                totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${totalUnrealizedPnL.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Positions List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedPositions.map((position) => {
          const amount = parseFloat(position.amount);
          const unrealizedPnL = position.unrealizedPnL || 0;
          const realizedPnL = position.realizedPnL || 0;
          const totalPositionPnL = unrealizedPnL + realizedPnL;
          const positionPnLPercentage = position.costBasis > 0
            ? ((totalPositionPnL / position.costBasis) * 100)
            : 0;
          
          const entryPrice = position.entryPrice || 0.5;
          const currentPrice = position.currentPrice || entryPrice;
          const priceChange = currentPrice - entryPrice;
          const priceChangePercent = entryPrice > 0 
            ? ((priceChange / entryPrice) * 100)
            : 0;

          return (
            <div
              key={`${position.marketId}-${position.outcome}`}
              className="border border-border rounded p-2 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => selectMarket(position.marketId)}
            >
              {/* Market Info */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {position.market?.question || position.marketId.substring(0, 20) + '...'}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {position.outcome} • {position.market?.slug || 'Unknown market'}
                  </div>
                </div>
                <div className={`text-xs font-mono flex items-center gap-1 ${
                  position.outcome === 'YES' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {position.outcome}
                </div>
              </div>

              {/* Position Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px]">Size</div>
                  <div className="font-mono font-medium">
                    {amount.toFixed(4)} tokens
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Value</div>
                  <div className="font-mono font-medium">
                    ${position.currentValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Entry Price</div>
                  <div className="font-mono">
                    {(entryPrice * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Current Price</div>
                  <div className={`font-mono flex items-center gap-1 ${
                    priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(currentPrice * 100).toFixed(1)}%
                    {priceChange >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>

              {/* P&L */}
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">P&L</div>
                  <div className={`text-xs font-mono font-medium flex items-center gap-1 ${
                    totalPositionPnL >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {totalPositionPnL >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    ${totalPositionPnL.toFixed(2)} ({positionPnLPercentage.toFixed(2)}%)
                  </div>
                </div>
                {(realizedPnL !== 0 || unrealizedPnL !== 0) && (
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <div className="text-muted-foreground">
                      Realized: <span className={realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${realizedPnL.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Unrealized: <span className={unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${unrealizedPnL.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Market End Date */}
              {position.market?.endDate && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Ends: {new Date(position.market.endDate).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PositionsCard = React.memo(PositionsCardComponent);

