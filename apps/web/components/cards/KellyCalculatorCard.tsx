'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { kellyFraction as calculateKellyFraction, breakEvenProb, evPerDollar } from '@alithos-terminal/shared';
import { Loader2, Search, Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MarketSelector } from '@/components/MarketSelector';
import { Slider } from '@/components/ui/slider';

function KellyCalculatorCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // Subscribe to real-time price updates for instant updates
  useRealtimePrice(selectedMarketId || null, 'YES');
  
  // User inputs
  const [belief, setBelief] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [profitFee, setProfitFee] = useState<string>('2');
  const [kellyFraction, setKellyFraction] = useState<string>('100');
  const [maxPosition, setMaxPosition] = useState<string>('100');
  const [bankroll, setBankroll] = useState<string>('1000');

  const market = selectedMarketId ? getMarket(selectedMarketId) : null;
  const currentProbability = price && typeof price === 'object' && 'probability' in price 
    ? (price as { probability: number }).probability 
    : 0;

  // Calculate Kelly and related metrics
  const calculations = useMemo(() => {
    if (!belief || !entryPrice || !profitFee) return null;

    const beliefNum = parseFloat(belief) / 100; // Convert % to decimal
    const entryNum = parseFloat(entryPrice) / 100; // Convert % to decimal
    const feeNum = parseFloat(profitFee) / 100; // Convert % to decimal
    const kellyFrac = parseFloat(kellyFraction) / 100; // Convert % to decimal
    const maxPos = parseFloat(maxPosition) / 100; // Convert % to decimal
    const bankrollNum = parseFloat(bankroll);

    if (isNaN(beliefNum) || isNaN(entryNum) || isNaN(feeNum) || beliefNum <= 0 || beliefNum >= 1 || entryNum <= 0 || entryNum >= 1) {
      return null;
    }

    // Break-even probability
    const breakEven = breakEvenProb(entryNum, feeNum);
    
    // Expected value per dollar
    const ev = evPerDollar(beliefNum, entryNum, feeNum);
    
    // Kelly fraction
    const kelly = calculateKellyFraction(beliefNum, entryNum, feeNum, kellyFrac, maxPos, false);
    
    // Position size in dollars
    const positionSize = kelly * bankrollNum;
    
    // Edge (difference between belief and break-even)
    const edge = beliefNum - breakEven;
    const edgePercent = edge * 100;

    return {
      breakEven: breakEven * 100,
      ev: ev,
      evPercent: ev * 100,
      kelly: kelly * 100,
      positionSize: positionSize,
      edge: edgePercent,
      isPositiveEV: ev > 0,
      isAboveBreakEven: beliefNum > breakEven,
    };
  }, [belief, entryPrice, profitFee, kellyFraction, maxPosition, bankroll]);

  const handleUseCurrentPrice = () => {
    if (currentProbability > 0) {
      setEntryPrice(currentProbability.toFixed(2));
    }
  };

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <Calculator className="h-8 w-8 text-muted-foreground" />
          <div className="text-muted-foreground text-sm mb-2">
            Select a market to calculate Kelly position size
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
          <LoadingSpinner size="sm" text="Loading market data..." />
        </div>
      ) : (
        <div className="flex flex-col space-y-3 flex-1 min-h-0">
          {/* Belief Input */}
          <div className="space-y-2 flex-shrink-0">
            <Label>Your Belief (Probability %)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={belief}
              onChange={(e) => setBelief(e.target.value)}
              className="text-sm font-mono"
              placeholder="e.g., 68.5"
            />
          </div>

          {/* Entry Price Input */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label>Entry Price (Probability %)</Label>
              {currentProbability > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-2"
                  onClick={handleUseCurrentPrice}
                >
                  Use Current ({currentProbability.toFixed(1)}%)
                </Button>
              )}
            </div>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="text-sm font-mono"
              placeholder="e.g., 62.0"
            />
          </div>

          {/* Profit Fee Input */}
          <div className="space-y-2 flex-shrink-0">
            <Label>Profit Fee (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={profitFee}
              onChange={(e) => setProfitFee(e.target.value)}
              className="text-sm font-mono"
              placeholder="2.0"
            />
          </div>

          {/* Kelly Fraction Slider */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label>Kelly Fraction (%)</Label>
              <span className="text-xs text-muted-foreground font-mono">{kellyFraction}%</span>
            </div>
            <Slider
              value={[parseFloat(kellyFraction) || 100]}
              onValueChange={([value]) => setKellyFraction(value.toString())}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Max Position Slider */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label>Max Position (%)</Label>
              <span className="text-xs text-muted-foreground font-mono">{maxPosition}%</span>
            </div>
            <Slider
              value={[parseFloat(maxPosition) || 100]}
              onValueChange={([value]) => setMaxPosition(value.toString())}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Bankroll Input */}
          <div className="space-y-2 flex-shrink-0">
            <Label>Bankroll (USDC)</Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              className="text-sm font-mono"
              placeholder="1000"
            />
          </div>

          {/* Results */}
          {calculations && (
            <div className="space-y-0 flex-shrink-0 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold text-foreground">Calculations</span>
              </div>
              
              <div className="space-y-0 text-xs">
                <div className="flex items-center justify-between py-2.5 px-3 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Break-Even:</span>
                  <span className="font-mono font-semibold text-foreground">{calculations.breakEven.toFixed(2)}%</span>
                </div>
                
                <div className="flex items-center justify-between py-2.5 px-3 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Edge:</span>
                  <span className={`font-mono font-semibold ${calculations.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {calculations.edge > 0 ? '+' : ''}{calculations.edge.toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2.5 px-3 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">Expected Value:</span>
                  <span className={`font-mono font-semibold ${calculations.isPositiveEV ? 'text-green-400' : 'text-red-400'}`}>
                    {calculations.evPercent > 0 ? '+' : ''}{calculations.evPercent.toFixed(2)}% per $1
                  </span>
                </div>
                
                <div className="pt-2.5 px-3 pb-2.5 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground">Kelly Position:</span>
                    <span className="font-mono font-semibold">{calculations.kelly.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Position Size:</span>
                    <span className="font-mono font-semibold text-lg">
                      ${calculations.positionSize.toFixed(2)}
                    </span>
                  </div>
                </div>

                {!calculations.isAboveBreakEven && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs">Belief is below break-even. Trade may not be profitable.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const KellyCalculatorCard = React.memo(KellyCalculatorCardComponent);

