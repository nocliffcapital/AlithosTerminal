'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { kellyFraction as calculateKellyFraction, breakEvenProb, evPerDollar, breakEvenCost } from '@alithos-terminal/shared';
import { Loader2, Search, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarketSelector } from '@/components/MarketSelector';

function PositionSizingCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // User inputs
  const [belief, setBelief] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [profitFee, setProfitFee] = useState<string>('2');
  const [bankroll, setBankroll] = useState<string>('1000');
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [useKelly, setUseKelly] = useState(true);
  const [customPositionPercent, setCustomPositionPercent] = useState<string>('');

  const market = selectedMarketId ? getMarket(selectedMarketId) : null;
  const currentProbability = price && typeof price === 'object' && 'probability' in price 
    ? (price as { probability: number }).probability 
    : 0;

  // Risk tolerance settings
  const riskSettings = {
    conservative: { kellyFraction: 0.25, maxPosition: 0.10 },
    moderate: { kellyFraction: 0.50, maxPosition: 0.25 },
    aggressive: { kellyFraction: 1.0, maxPosition: 0.50 },
  };

  // Calculate position sizing
  const calculations = useMemo(() => {
    if (!belief || !entryPrice || !profitFee) return null;

    const beliefNum = parseFloat(belief) / 100;
    const entryNum = parseFloat(entryPrice) / 100;
    const feeNum = parseFloat(profitFee) / 100;
    const bankrollNum = parseFloat(bankroll);

    if (isNaN(beliefNum) || isNaN(entryNum) || isNaN(feeNum) || beliefNum <= 0 || beliefNum >= 1 || entryNum <= 0 || entryNum >= 1) {
      return null;
    }

    const settings = riskSettings[riskTolerance];
    
    // Break-even calculations
    const breakEven = breakEvenProb(entryNum, feeNum);
    const breakEvenCostForBelief = breakEvenCost(beliefNum, feeNum);
    
    // EV calculations
    const ev = evPerDollar(beliefNum, entryNum, feeNum);
    
    // Kelly calculations
    const fullKelly = calculateKellyFraction(beliefNum, entryNum, feeNum, 1, 1, false);
    const adjustedKelly = calculateKellyFraction(beliefNum, entryNum, feeNum, settings.kellyFraction, settings.maxPosition, false);
    
    // Position sizing
    let positionPercent: number;
    let positionSize: number;
    
    if (useKelly) {
      positionPercent = adjustedKelly * 100;
      positionSize = adjustedKelly * bankrollNum;
    } else {
      positionPercent = parseFloat(customPositionPercent) || 0;
      positionSize = (positionPercent / 100) * bankrollNum;
    }
    
    // Risk metrics
    const edge = beliefNum - breakEven;
    const edgePercent = edge * 100;
    const riskOfRuin = positionPercent > 0 ? Math.exp(-2 * bankrollNum * edge / positionSize) : 0;
    
    // Expected profit
    const expectedProfit = ev * positionSize;
    const expectedProfitPercent = (expectedProfit / bankrollNum) * 100;

    return {
      breakEven: breakEven * 100,
      breakEvenCostForBelief: breakEvenCostForBelief * 100,
      ev: ev,
      evPercent: ev * 100,
      fullKelly: fullKelly * 100,
      adjustedKelly: adjustedKelly * 100,
      positionPercent: positionPercent,
      positionSize: positionSize,
      edge: edgePercent,
      riskOfRuin: riskOfRuin * 100,
      expectedProfit: expectedProfit,
      expectedProfitPercent: expectedProfitPercent,
      isPositiveEV: ev > 0,
      isAboveBreakEven: beliefNum > breakEven,
      recommendedEntry: breakEvenCostForBelief * 100,
    };
  }, [belief, entryPrice, profitFee, bankroll, riskTolerance, useKelly, customPositionPercent]);

  const handleUseCurrentPrice = () => {
    if (currentProbability > 0) {
      setEntryPrice(currentProbability.toFixed(2));
    }
  };

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <Target className="h-8 w-8 text-muted-foreground" />
          <div className="text-muted-foreground text-sm mb-2">
            Select a market for position sizing
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
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col space-y-3 flex-1 min-h-0">
          {/* Belief Input */}
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">Your Belief (Probability %)</Label>
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
          <div className="space-y-1 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Entry Price (Probability %)</Label>
              {currentProbability > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
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
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">Profit Fee (%)</Label>
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

          {/* Bankroll Input */}
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">Bankroll (USDC)</Label>
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

          {/* Risk Tolerance */}
          <div className="space-y-1 flex-shrink-0">
            <Label className="text-xs">Risk Tolerance</Label>
            <div className="flex gap-2">
              {(['conservative', 'moderate', 'aggressive'] as const).map((level) => (
                <Button
                  key={level}
                  variant={riskTolerance === level ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs capitalize"
                  onClick={() => setRiskTolerance(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          {/* Position Sizing Method */}
          <div className="space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useKelly"
                checked={useKelly}
                onChange={(e) => setUseKelly(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="useKelly" className="text-xs cursor-pointer">
                Use Kelly Criterion
              </Label>
            </div>
            {!useKelly && (
              <div className="space-y-1">
                <Label className="text-xs">Custom Position (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={customPositionPercent}
                  onChange={(e) => setCustomPositionPercent(e.target.value)}
                  className="text-sm font-mono"
                  placeholder="5.0"
                />
              </div>
            )}
          </div>

          {/* Results */}
          {calculations && (
            <div className="space-y-3 flex-shrink-0">
              {/* Position Recommendation */}
              <div className="p-3 bg-muted rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-semibold">Position Recommendation</span>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Position Size:</span>
                    <span className="font-mono font-semibold text-lg">
                      ${calculations.positionSize.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Position %:</span>
                    <span className="font-mono font-medium">{calculations.positionPercent.toFixed(2)}%</span>
                  </div>
                  {useKelly && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Full Kelly:</span>
                      <span className="font-mono">{calculations.fullKelly.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="p-3 bg-muted rounded-lg border border-border">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Break-Even:</span>
                    <span className="font-mono font-medium">{calculations.breakEven.toFixed(2)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Edge:</span>
                    <span className={`font-mono font-medium ${calculations.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {calculations.edge > 0 ? '+' : ''}{calculations.edge.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expected Value:</span>
                    <span className={`font-mono font-medium ${calculations.isPositiveEV ? 'text-green-400' : 'text-red-400'}`}>
                      {calculations.evPercent > 0 ? '+' : ''}{calculations.evPercent.toFixed(2)}% per $1
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expected Profit:</span>
                    <span className={`font-mono font-medium ${calculations.expectedProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${calculations.expectedProfit > 0 ? '+' : ''}{calculations.expectedProfit.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expected Return:</span>
                    <span className={`font-mono font-medium ${calculations.expectedProfitPercent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {calculations.expectedProfitPercent > 0 ? '+' : ''}{calculations.expectedProfitPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {!calculations.isAboveBreakEven && (
                <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-medium mb-1">Warning: Below Break-Even</div>
                    <div>Your belief ({belief}%) is below the break-even probability ({calculations.breakEven.toFixed(2)}%). This trade may not be profitable.</div>
                  </div>
                </div>
              )}

              {calculations.riskOfRuin > 5 && (
                <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-medium mb-1">High Risk of Ruin</div>
                    <div>Risk of ruin is {calculations.riskOfRuin.toFixed(2)}%. Consider reducing position size.</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const PositionSizingCard = React.memo(PositionSizingCardComponent);

