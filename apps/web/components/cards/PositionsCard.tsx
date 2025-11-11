'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { usePositions, useTotalPnL, PositionWithPnL } from '@/lib/hooks/usePositions';
import { useMarketStore } from '@/stores/market-store';
import { Loader2, TrendingUp, TrendingDown, ExternalLink, ArrowUpRight, ArrowDownRight, Wallet, X, Minus } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { useTrading } from '@/lib/hooks/useTrading';
import { useToast } from '@/components/Toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

const POLYGONSCAN_BASE = 'https://polygonscan.com';

function PositionsCardComponent() {
  const { data: positions, isLoading, error, refetch } = usePositions(true);
  const { totalCostBasis, totalCurrentValue, totalUnrealizedPnL, totalRealizedPnL, totalPnL, positionCount } = useTotalPnL();
  const { selectMarket } = useMarketStore();
  const { sell } = useTrading();
  const { success: showSuccess, error: showError } = useToast();
  const [closingPosition, setClosingPosition] = useState<PositionWithPnL | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [partialCloseAmount, setPartialCloseAmount] = useState<number>(0);
  const [isPartialClose, setIsPartialClose] = useState(false);

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

  const handleClosePosition = useCallback((position: PositionWithPnL, e: React.MouseEvent, partial: boolean = false) => {
    e.stopPropagation(); // Prevent selecting the market
    setClosingPosition(position);
    setIsPartialClose(partial);
    if (partial) {
      setPartialCloseAmount(position.currentValue * 0.5); // Default to 50%
    } else {
      setPartialCloseAmount(0);
    }
    setShowCloseModal(true);
  }, []);

  const executeClosePosition = useCallback(async () => {
    if (!closingPosition || isClosing) return;

    setIsClosing(true);
    try {
      let returnAmountUSDC: bigint;
      let maxOutcomeTokens: bigint;

      if (isPartialClose && partialCloseAmount > 0) {
        // Partial close: calculate based on percentage
        const percentage = partialCloseAmount / closingPosition.currentValue;
        const partialValue = closingPosition.currentValue * percentage;
        returnAmountUSDC = parseUnits(partialValue.toFixed(6), 6);
        
        // Calculate proportional tokens to sell
        const positionAmount = parseFloat(closingPosition.amount);
        const tokensToSell = positionAmount * percentage;
        maxOutcomeTokens = parseUnits(tokensToSell.toFixed(18), 18);
      } else {
        // Full close
        returnAmountUSDC = parseUnits(closingPosition.currentValue.toFixed(6), 6);
        maxOutcomeTokens = parseUnits(closingPosition.amount, 18);
      }

      // Execute sell transaction
      const result = await sell({
        marketId: closingPosition.marketId,
        outcome: closingPosition.outcome,
        amount: returnAmountUSDC, // Return amount in USDC
        maxOutcomeTokens: maxOutcomeTokens, // Maximum tokens to sell
      });

      if (result.success) {
        const action = isPartialClose ? 'partially closed' : 'closed';
        showSuccess('Position Closed', `Successfully ${action} position for ${closingPosition.market?.question || closingPosition.marketId}`);
        setShowCloseModal(false);
        setClosingPosition(null);
        setIsPartialClose(false);
        setPartialCloseAmount(0);
        // Refetch positions to update the list
        refetch();
      } else {
        showError('Close Failed', result.error || 'Failed to close position');
      }
    } catch (error: any) {
      showError('Close Failed', error.message || 'Failed to close position');
    } finally {
      setIsClosing(false);
    }
  }, [closingPosition, isClosing, isPartialClose, partialCloseAmount, sell, showSuccess, showError, refetch]);

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
              className="border border-border rounded p-3 hover:bg-accent/50 transition-colors duration-200 cursor-pointer"
              onClick={() => selectMarket(position.marketId)}
            >
              {/* Market Info */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {position.market?.question || position.marketId.substring(0, 20) + '...'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
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
                  <div className="text-muted-foreground text-xs font-medium">Size</div>
                  <div className="font-mono font-medium">
                    {amount.toFixed(4)} tokens
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-medium">Value</div>
                  <div className="font-mono font-medium">
                    ${position.currentValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-medium">Entry Price</div>
                  <div className="font-mono">
                    {(entryPrice * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-medium">Current Price</div>
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

              {/* Close Position Buttons */}
              <div className="mt-2 pt-2 border-t border-border flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={(e) => handleClosePosition(position, e, true)}
                >
                  <Minus className="h-3 w-3 mr-1" />
                  Partial Close
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={(e) => handleClosePosition(position, e, false)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Close All
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Close Position Confirmation Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {isPartialClose ? 'Partial Close Position' : 'Close Position'}
            </DialogTitle>
            <DialogDescription>
              {isPartialClose 
                ? 'Enter the amount to close. The remaining position will stay open.'
                : 'Are you sure you want to close this position? This will sell all outcome tokens.'}
            </DialogDescription>
          </DialogHeader>

          {closingPosition && (
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Market</div>
                <div className="text-sm font-medium">
                  {closingPosition.market?.question || closingPosition.marketId}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Outcome</div>
                  <div className={`font-medium ${
                    closingPosition.outcome === 'YES' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {closingPosition.outcome}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Position Size</div>
                  <div className="font-mono font-medium">
                    {parseFloat(closingPosition.amount).toFixed(4)} tokens
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Current Value</div>
                  <div className="font-mono font-medium">
                    ${closingPosition.currentValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">P&L</div>
                  <div className={`font-mono font-medium ${
                    (closingPosition.unrealizedPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${((closingPosition.unrealizedPnL || 0) + (closingPosition.realizedPnL || 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              {isPartialClose && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Close Amount (USDC)</div>
                  <input
                    type="number"
                    min="0"
                    max={closingPosition.currentValue}
                    step="0.01"
                    value={partialCloseAmount}
                    onChange={(e) => setPartialCloseAmount(Math.max(0, Math.min(closingPosition.currentValue, parseFloat(e.target.value) || 0)))}
                    className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
                    placeholder="Enter amount to close"
                  />
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <Button
                        key={percent}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => setPartialCloseAmount((closingPosition.currentValue * percent) / 100)}
                      >
                        {percent}%
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Remaining: ${(closingPosition.currentValue - partialCloseAmount).toFixed(2)} USDC
                    ({((1 - partialCloseAmount / closingPosition.currentValue) * 100).toFixed(1)}% of position)
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {isPartialClose 
                    ? `You will receive approximately $${partialCloseAmount.toFixed(2)} USDC. The remaining position will stay open.`
                    : `This action cannot be undone. You will receive approximately $${closingPosition.currentValue.toFixed(2)} USDC.`}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCloseModal(false);
                setClosingPosition(null);
              }}
              disabled={isClosing}
            >
              Cancel
            </Button>
            <Button
              onClick={executeClosePosition}
              disabled={isClosing || !closingPosition || (isPartialClose && (partialCloseAmount <= 0 || partialCloseAmount > (closingPosition?.currentValue || 0)))}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClosing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Closing...
                </>
              ) : (
                isPartialClose ? 'Partial Close' : 'Close Position'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const PositionsCard = React.memo(PositionsCardComponent);

