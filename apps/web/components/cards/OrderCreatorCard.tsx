'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useTrading } from '@/lib/hooks/useTrading';
import { parseUnits } from 'viem';
import { Loader2, ArrowUp, ArrowDown, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MarketSelector } from '@/components/MarketSelector';
import { useToast } from '@/components/Toast';

function OrderCreatorCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // Subscribe to real-time price updates for instant updates
  useRealtimePrice(selectedMarketId || null, 'YES');

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
  const [targetProbability, setTargetProbability] = useState<string>('');
  const [sizeBy, setSizeBy] = useState<'usdc' | 'risk' | 'bankroll'>('usdc');
  const [size, setSize] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Hooks must be called unconditionally - before any early returns
  const { buy, sell } = useTrading();
  const { error: showErrorToast } = useToast();

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
        const errorMessage = result.error || 'Unknown error';
        setLastResult(`Error: ${errorMessage}`);
        // Show toast notification for balance errors
        if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
          showErrorToast('Insufficient Balance', errorMessage);
        } else {
          showErrorToast('Transaction Failed', errorMessage);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setLastResult(`Error: ${errorMessage}`);
      // Show toast notification for balance errors
      if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
        showErrorToast('Insufficient Balance', errorMessage);
      }
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

  const [showLimitSettings, setShowLimitSettings] = useState(false);
  
  const impact = calculateImpact();

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Market Info Header */}
      <div className="flex-shrink-0 space-y-1">
        <div className="text-xs font-semibold text-foreground truncate">{market?.question || 'Market'}</div>
        <div className="text-xs text-muted-foreground">
          Current: <span className="font-mono font-semibold text-foreground">{currentProbability.toFixed(1)}%</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <LoadingSpinner size="sm" text="Loading market data..." />
        </div>
      ) : (
        <div className="flex flex-col space-y-4 flex-1 min-h-0">
          {/* Order Type (Buy/Sell) - Segmented Control */}
          <div className="flex gap-1.5 p-1 bg-muted/30 rounded-lg flex-shrink-0">
            <button
              onClick={() => setOrderType('buy')}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-all duration-200 ${
                orderType === 'buy'
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setOrderType('sell')}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded transition-all duration-200 ${
                orderType === 'sell'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Order Mode Toggle */}
          <div className="flex-shrink-0">
            <button
              onClick={() => {
                if (orderMode === 'market') {
                  setOrderMode('limit');
                  setShowLimitSettings(true);
                } else {
                  setOrderMode('market');
                  setShowLimitSettings(false);
                }
              }}
              className={`w-full px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all duration-200 flex items-center justify-between ${
                orderMode === 'market'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              <span>{orderMode === 'market' ? 'Market Order' : 'Limit Order'}</span>
              {orderMode === 'limit' ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Limit Settings (Collapsible) */}
          {orderMode === 'limit' && showLimitSettings && (
            <div className="space-y-3 flex-shrink-0 p-3 rounded-lg border border-border/50 bg-muted/20">
              {/* Target Probability */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
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
                    className="flex-1 text-sm font-mono bg-background"
                    placeholder={currentProbability.toFixed(1)}
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => nudgePrice('up', 0.1)}
                      className="p-1.5 hover:bg-accent rounded border border-border/50 transition-colors bg-background"
                      title="Nudge +0.1%"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => nudgePrice('down', 0.1)}
                      className="p-1.5 hover:bg-accent rounded border border-border/50 transition-colors bg-background"
                      title="Nudge -0.1%"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Impact Estimator */}
              {impact && (
                <div className="space-y-0 border border-border/30 rounded overflow-hidden text-xs bg-background/50">
                  <div className="px-3 py-2 border-b border-border/30 bg-muted/30">
                    <div className="font-semibold text-foreground text-xs">Impact Estimate</div>
                  </div>
                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-2 px-3 border-b border-border/30">
                      <span className="text-muted-foreground font-medium text-xs">Slippage:</span>
                      <span className="font-mono font-semibold text-foreground text-xs">{impact.impact}%</span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 border-b border-border/30">
                      <span className="text-muted-foreground font-medium text-xs">Blended Price:</span>
                      <span className="font-mono font-semibold text-foreground text-xs">{impact.blendedPrice}%</span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3">
                      <span className="text-muted-foreground font-medium text-xs">Fill Probability:</span>
                      <span className="font-mono font-semibold text-foreground text-xs">{impact.fillProbability}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Market order info */}
          {orderMode === 'market' && (
            <div className="p-3 rounded-lg border border-border/50 text-xs flex-shrink-0 bg-muted/20">
              <div className="text-muted-foreground font-medium text-xs">
                Executes at current price: <span className="font-mono font-semibold text-foreground">{currentProbability.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Size Configuration */}
          <div className="space-y-3 flex-shrink-0">
            {/* Size Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Size by</Label>
              <select
                value={sizeBy}
                onChange={(e) => setSizeBy(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-border/50 rounded-lg bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
              >
                <option value="usdc">USDC</option>
                <option value="risk">Risk %</option>
                <option value="bankroll">Bankroll %</option>
              </select>
            </div>

            {/* Size Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Size ({sizeBy === 'usdc' ? 'USDC' : sizeBy === 'risk' ? 'Risk %' : 'Bankroll %'})
              </Label>
              <Input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="text-sm font-mono bg-background"
                placeholder="0"
              />
            </div>
          </div>

          {/* Spacer to push buttons to bottom */}
          <div className="flex-1 min-h-0" />

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            variant={orderType === 'buy' ? 'buy' : 'sell'}
            className="w-full flex-shrink-0 text-xs font-semibold h-10"
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
              className={`text-xs p-3 rounded-lg flex-shrink-0 border ${
                lastResult.includes('Success')
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
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

