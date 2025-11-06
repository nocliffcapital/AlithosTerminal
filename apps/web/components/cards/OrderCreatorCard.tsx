'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useTrading } from '@/lib/hooks/useTrading';
import { parseUnits } from 'viem';
import { Loader2, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarketSelector } from '@/components/MarketSelector';

function OrderCreatorCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
  const [targetProbability, setTargetProbability] = useState<string>('');
  const [sizeBy, setSizeBy] = useState<'usdc' | 'risk' | 'bankroll'>('usdc');
  const [size, setSize] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Hooks must be called unconditionally - before any early returns
  const { buy, sell } = useTrading();

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <div className="text-muted-foreground text-sm mb-2">
            Select a market to create an order
          </div>
          <Button
            onClick={() => setShowMarketSelector(true)}
            variant="outline"
            size="sm"
          >
            <Search className="h-4 w-4 mr-2" />
            Select Market
          </Button>
        </div>
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
        />
      </>
    );
  }

  const market = getMarket(selectedMarketId);
  const currentProbability = price?.probability || 0;

  const handleSubmit = async () => {
    // For limit orders, require target probability
    if (orderMode === 'limit' && !targetProbability) return;
    if (!size || !selectedMarketId) return;

    setIsSubmitting(true);
    setLastResult(null);

    try {
      const sizeNum = parseFloat(size);
      
      // Convert size to USDC amount (with 6 decimals for USDC)
      let usdcAmount: bigint;
      if (sizeBy === 'usdc') {
        usdcAmount = parseUnits(sizeNum.toFixed(6), 6);
      } else {
        // For risk% and bankroll%, would need to calculate from portfolio
        // Simplified: assume 1000 USDC bankroll
        const bankroll = 1000;
        const amount = (sizeNum / 100) * bankroll;
        usdcAmount = parseUnits(amount.toFixed(6), 6);
      }

      // For market orders, use current price; for limit orders, use target price
      const targetPrice = orderMode === 'market' 
        ? currentProbability / 100 
        : parseFloat(targetProbability) / 100;

      const result =
        orderType === 'buy'
          ? await buy({
              marketId: selectedMarketId,
              outcome: 'YES',
              amount: usdcAmount,
              // TODO: Add limit price support when implementing limit orders
            })
          : await sell({
              marketId: selectedMarketId,
              outcome: 'YES',
              amount: usdcAmount,
              // TODO: Add limit price support when implementing limit orders
            });

      if (result.success) {
        setLastResult(`Success! Transaction: ${result.transactionHash?.slice(0, 10)}...`);
        // Reset form
        setTargetProbability('');
        setSize('');
      } else {
        setLastResult(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setLastResult(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nudgePrice = (direction: 'up' | 'down', amount: number) => {
    const current = parseFloat(targetProbability || String(currentProbability));
    const newPrice = direction === 'up' ? current + amount : current - amount;
    setTargetProbability(Math.max(0, Math.min(100, newPrice)).toFixed(1));
  };

  // Calculate impact estimate (simplified)
  const calculateImpact = () => {
    if (!targetProbability || !size || orderMode !== 'limit') return null;

    const target = parseFloat(targetProbability);
    const sizeNum = parseFloat(size);
    const diff = Math.abs(target - currentProbability);
    
    // Simplified impact calculation
    const impact = diff * 0.1; // 0.1% slippage per 1% move
    const blendedPrice = currentProbability + (target > currentProbability ? impact : -impact);

    return {
      impact: impact.toFixed(2),
      blendedPrice: blendedPrice.toFixed(2),
      fillProbability: Math.max(0, Math.min(100, 100 - impact * 10)),
    };
  };

  const impact = calculateImpact();

  return (
    <div className="h-full flex flex-col p-3 space-y-3 overflow-y-auto">
      {/* Market Info */}
      <div className="text-xs flex-shrink-0 border-b border-border pb-2">
        <div className="font-medium truncate">{market?.question || 'Market'}</div>
        <div className="text-muted-foreground mt-0.5">
          Current: {currentProbability.toFixed(1)}%
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col space-y-3 flex-1 min-h-0">
          {/* Order Type (Buy/Sell) */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant={orderType === 'buy' ? 'default' : 'outline'}
              size="sm"
              className={`flex-1 text-xs ${
                orderType === 'buy'
                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                  : 'border-green-600/50 text-green-400 hover:bg-green-600/10'
              }`}
              onClick={() => setOrderType('buy')}
            >
              Buy
            </Button>
            <Button
              variant={orderType === 'sell' ? 'default' : 'outline'}
              size="sm"
              className={`flex-1 text-xs ${
                orderType === 'sell'
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                  : 'border-red-600/50 text-red-400 hover:bg-red-600/10'
              }`}
              onClick={() => setOrderType('sell')}
            >
              Sell
            </Button>
          </div>

          {/* Order Mode (Market/Limit) */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant={orderMode === 'market' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setOrderMode('market')}
            >
              Market
            </Button>
            <Button
              variant={orderMode === 'limit' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setOrderMode('limit')}
            >
              Limit
            </Button>
          </div>

          {/* Target Probability (only show for Limit orders) */}
          {orderMode === 'limit' && (
            <div className="space-y-1 flex-shrink-0">
              <Label className="text-xs">
                {orderType === 'buy' ? 'Buy at' : 'Sell at'} Probability (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={targetProbability}
                  onChange={(e) => setTargetProbability(e.target.value)}
                  className="flex-1 text-sm font-mono"
                  placeholder={currentProbability.toFixed(1)}
                />
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => nudgePrice('up', 0.1)}
                    className="p-1 hover:bg-accent rounded"
                    title="Nudge +0.1%"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => nudgePrice('down', 0.1)}
                    className="p-1 hover:bg-accent rounded"
                    title="Nudge -0.1%"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Market order info */}
          {orderMode === 'market' && (
            <div className="p-2 bg-muted rounded text-xs flex-shrink-0">
              <div className="text-muted-foreground">
                Market order will execute at current price: {currentProbability.toFixed(1)}%
              </div>
            </div>
          )}

          {/* Size Type */}
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">Size by</Label>
            <select
              value={sizeBy}
              onChange={(e) => setSizeBy(e.target.value as any)}
              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
            >
              <option value="usdc">USDC</option>
              <option value="risk">Risk %</option>
              <option value="bankroll">Bankroll %</option>
            </select>
          </div>

          {/* Size Input */}
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">
              Size ({sizeBy === 'usdc' ? 'USDC' : sizeBy === 'risk' ? 'Risk %' : 'Bankroll %'})
            </Label>
            <Input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="text-sm font-mono"
              placeholder="0"
            />
          </div>

          {/* Impact Estimator (only for Limit orders) */}
          {orderMode === 'limit' && impact && (
            <div className="p-2 bg-muted rounded text-xs space-y-1 flex-shrink-0">
              <div className="font-medium">Impact Estimate</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Slippage:</span>
                <span className="font-mono">{impact.impact}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Blended Price:</span>
                <span className="font-mono">{impact.blendedPrice}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fill Probability:</span>
                <span className="font-mono">{impact.fillProbability}%</span>
              </div>
            </div>
          )}

          {/* Spacer to push buttons to bottom */}
          <div className="flex-1 min-h-0" />

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            className={`w-full flex-shrink-0 ${
              orderType === 'buy'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            disabled={
              (orderMode === 'limit' && !targetProbability) || 
              !size || 
              isSubmitting
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                {orderType === 'buy' ? 'Buy' : 'Sell'}{' '}
                {orderMode === 'market' 
                  ? `at Market (${currentProbability.toFixed(1)}%)`
                  : `at ${targetProbability || '...'}%`
                }
              </>
            )}
          </Button>

          {/* Result Message */}
          {lastResult && (
            <div
              className={`text-xs p-2 rounded flex-shrink-0 ${
                lastResult.includes('Success')
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {lastResult}
            </div>
          )}

          {/* One-Tap Reversal */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs flex-shrink-0"
            onClick={() => {
              setOrderType(orderType === 'buy' ? 'sell' : 'buy');
            }}
          >
            Reverse to {orderType === 'buy' ? 'Sell' : 'Buy'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const OrderCreatorCard = React.memo(OrderCreatorCardComponent);

