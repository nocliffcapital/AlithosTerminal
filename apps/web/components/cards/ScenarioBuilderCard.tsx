'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { usePositions } from '@/lib/hooks/usePositions';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, TrendingDown, Plus, Wallet, ToggleLeft, ToggleRight, Info, BarChart3, Calculator, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketSelector } from '@/components/MarketSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatUnits } from 'viem';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Scenario {
  marketId: string;
  probability: number;
}

function ScenarioBuilderCardComponent() {
  const { selectedMarketId, getPrice, getMarket } = useMarketStore();
  const [selectedMarkets, setSelectedMarkets] = useState<Scenario[]>([]);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [useRealPositions, setUseRealPositions] = useState(false);
  
  // Fetch real positions if enabled
  const { data: positions = [], isLoading: isLoadingPositions } = usePositions(true);

  const addMarket = (marketId: string) => {
    if (selectedMarkets.find((s) => s.marketId === marketId)) return;
    const price = getPrice(marketId);
    const probability = price?.probability || 50;
    setSelectedMarkets([...selectedMarkets, { marketId, probability }]);
  };

  const updateProbability = (marketId: string, probability: number) => {
    setSelectedMarkets(
      selectedMarkets.map((s) =>
        s.marketId === marketId ? { ...s, probability } : s
      )
    );
  };

  const removeMarket = (marketId: string) => {
    setSelectedMarkets(selectedMarkets.filter((s) => s.marketId !== marketId));
  };

  // Calculate P&L for scenario using real positions or manual entry
  const { pnl, positionDetails } = useMemo(() => {
    let totalPnL = 0;
    const details: Array<{
      marketId: string;
      positionSize: number;
      entryPrice: number;
      currentPrice: number;
      scenarioPrice: number;
      pnl: number;
    }> = [];

    selectedMarkets.forEach((scenario) => {
      const currentPrice = getPrice(scenario.marketId);
      const currentProb = currentPrice?.probability || 50;
      const scenarioProb = scenario.probability;
      
      let positionSize = 0;
      let entryPrice = 0;
      let currentPriceValue = currentProb / 100;
      let scenarioPriceValue = scenarioProb / 100;

      if (useRealPositions) {
        // Use real position data
        const position = positions.find((p) => p.marketId === scenario.marketId);
        if (position) {
          positionSize = parseFloat(position.amount || '0');
          entryPrice = position.entryPrice || position.costBasis / positionSize || 0.5;
          currentPriceValue = position.currentPrice || entryPrice;
          scenarioPriceValue = scenarioProb / 100;
          
          // Calculate P&L based on position
          // P&L = (scenarioPrice - entryPrice) * positionSize for YES
          // For NO: P&L = ((1 - scenarioPrice) - (1 - entryPrice)) * positionSize
          if (position.outcome === 'YES') {
            const pnl = (scenarioPriceValue - entryPrice) * positionSize;
            totalPnL += pnl;
            details.push({
              marketId: scenario.marketId,
              positionSize,
              entryPrice,
              currentPrice: currentPriceValue,
              scenarioPrice: scenarioPriceValue,
              pnl,
            });
          } else {
            const pnl = ((1 - scenarioPriceValue) - (1 - entryPrice)) * positionSize;
            totalPnL += pnl;
            details.push({
              marketId: scenario.marketId,
              positionSize,
              entryPrice: 1 - entryPrice,
              currentPrice: 1 - currentPriceValue,
              scenarioPrice: 1 - scenarioPriceValue,
              pnl,
            });
          }
        } else {
          // No position for this market, skip
          details.push({
            marketId: scenario.marketId,
            positionSize: 0,
            entryPrice: 0,
            currentPrice: currentPriceValue,
            scenarioPrice: scenarioPriceValue,
            pnl: 0,
          });
        }
      } else {
        // Use manual entry (assume $100 position per market)
        positionSize = 100;
        entryPrice = currentPriceValue;
        scenarioPriceValue = scenarioProb / 100;
        const pnl = (scenarioPriceValue - entryPrice) * positionSize;
        totalPnL += pnl;
        details.push({
          marketId: scenario.marketId,
          positionSize,
          entryPrice,
          currentPrice: currentPriceValue,
          scenarioPrice: scenarioPriceValue,
          pnl,
        });
      }
    });

    return { pnl: totalPnL, positionDetails: details };
  }, [selectedMarkets, useRealPositions, positions, getPrice]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-border bg-accent/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Scenario Builder</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Build scenarios by adjusting market probabilities and see how they affect your portfolio P&L</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle for real positions vs manual entry */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setUseRealPositions(!useRealPositions)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] transition-colors border",
                    useRealPositions 
                      ? "bg-primary/20 text-primary border-primary/30" 
                      : "bg-background text-muted-foreground border-border hover:bg-accent/50"
                  )}
                >
                  {useRealPositions ? (
                    <>
                      <ToggleRight className="h-3 w-3" />
                      <Wallet className="h-3 w-3" />
                      <span>Real Positions</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-3 w-3" />
                      <span>Manual ($100/market)</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{useRealPositions ? "Using your actual positions" : "Using $100 position per market for simulation"}</p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMarketSelector(true)}
              className="text-xs px-2.5 h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Market
            </Button>
          </div>
        </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoadingPositions && useRealPositions ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="sm" text="Loading positions..." />
          </div>
        ) : selectedMarkets.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No markets added"
            description="Click 'Add Market' above to build your scenario"
            className="p-4"
          />
        ) : (
          <div className="p-3 space-y-3">
            {/* Summary Card - Total P&L */}
            <div className={cn(
              "p-3 rounded-lg border-2 bg-gradient-to-br",
              pnl >= 0 
                ? "border-green-500/30 bg-green-500/5" 
                : "border-red-500/30 bg-red-500/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Total Scenario P&L</span>
                </div>
                <div className={cn(
                  "text-2xl font-mono font-bold",
                  pnl >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {useRealPositions 
                  ? `Based on ${positions.length} real position${positions.length !== 1 ? 's' : ''}`
                  : `Based on $100 position per market (${selectedMarkets.length} market${selectedMarkets.length !== 1 ? 's' : ''})`}
              </div>
            </div>

            {/* Markets List */}
            <div className="space-y-2.5">
              {selectedMarkets.map((scenario) => {
            const market = getMarket(scenario.marketId);
            const currentPrice = getPrice(scenario.marketId);
            const currentProb = currentPrice?.probability || 50;
            const probDiff = scenario.probability - currentProb;
            const isIncrease = probDiff > 0;
            
            // Get position details for this market
            const positionDetail = positionDetails.find((p) => p.marketId === scenario.marketId);
            const position = useRealPositions ? positions.find((p) => p.marketId === scenario.marketId) : null;
            
            const formatCurrency = (value: number) => {
              if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
              if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
              return `$${value.toFixed(2)}`;
            };

                return (
                  <div
                    key={scenario.marketId}
                    className="p-3 border border-border rounded-lg bg-card space-y-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Market Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate mb-1.5">
                          {market?.question || scenario.marketId}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>Current: <span className="font-mono font-medium">{currentProb.toFixed(1)}%</span></span>
                          {Math.abs(probDiff) > 0.1 && (
                            <span className={cn(
                              "flex items-center gap-0.5 font-semibold",
                              isIncrease ? "text-green-500" : "text-red-500"
                            )}>
                              {isIncrease ? (
                                <TrendingUp className="h-2.5 w-2.5" />
                              ) : (
                                <TrendingDown className="h-2.5 w-2.5" />
                              )}
                              {isIncrease ? '+' : ''}{probDiff.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMarket(scenario.marketId)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Inputs Section */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <Target className="h-3 w-3" />
                        <span>Scenario Input</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Target Probability</span>
                          <span className={cn(
                            "font-mono font-semibold",
                            probDiff > 0 ? "text-green-400" : probDiff < 0 ? "text-red-400" : "text-foreground"
                          )}>
                            {scenario.probability.toFixed(1)}%
                          </span>
                        </div>
                        <Slider
                          value={[scenario.probability]}
                          onValueChange={([value]) =>
                            updateProbability(scenario.marketId, value)
                          }
                          min={0}
                          max={100}
                          step={0.1}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>0%</span>
                          <span className="font-mono">{currentProb.toFixed(1)}% (current)</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Assumptions Section */}
                    {useRealPositions && position && positionDetail ? (
                      <div className="p-2.5 bg-accent/30 rounded border border-border/50 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          <Wallet className="h-3 w-3" />
                          <span>Position Assumptions</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <span className="ml-1 font-mono font-semibold">
                              {formatUnits(BigInt(Math.floor(positionDetail.positionSize)), 6)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Outcome:</span>
                            <span className={cn(
                              "ml-1 font-semibold",
                              position.outcome === 'YES' ? "text-green-400" : "text-red-400"
                            )}>
                              {position.outcome}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Entry Price:</span>
                            <span className="ml-1 font-mono">
                              ${positionDetail.entryPrice.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Current Price:</span>
                            <span className="ml-1 font-mono">
                              ${positionDetail.currentPrice.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-accent/30 rounded border border-border/50">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          <Calculator className="h-3 w-3" />
                          <span>Simulation Assumptions</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Position size: <span className="font-mono font-semibold">$100</span> | Entry price: <span className="font-mono font-semibold">{currentProb.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Output Section - P&L */}
                    {positionDetail && (
                      <div className={cn(
                        "p-2.5 rounded border-2",
                        positionDetail.pnl >= 0 
                          ? "border-green-500/30 bg-green-500/5" 
                          : "border-red-500/30 bg-red-500/5"
                      )}>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          <BarChart3 className="h-3 w-3" />
                          <span>Scenario Output</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">P&L:</span>
                          <span className={cn(
                            "text-sm font-mono font-bold",
                            positionDetail.pnl >= 0 ? "text-green-400" : "text-red-400"
                          )}>
                            {positionDetail.pnl >= 0 ? '+' : ''}{formatCurrency(positionDetail.pnl)}
                          </span>
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span>Entry:</span>
                              <span className="ml-1 font-mono">${positionDetail.entryPrice.toFixed(3)}</span>
                            </div>
                            <div>
                              <span>Scenario:</span>
                              <span className="ml-1 font-mono">${positionDetail.scenarioPrice.toFixed(3)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MarketSelector
        open={showMarketSelector}
        onOpenChange={setShowMarketSelector}
        onSelect={(id) => {
          if (id) {
            addMarket(id);
            setShowMarketSelector(false);
          }
        }}
      />
    </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ScenarioBuilderCard = React.memo(ScenarioBuilderCardComponent);

