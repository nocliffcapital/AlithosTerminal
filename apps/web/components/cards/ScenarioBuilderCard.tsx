'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarkets } from '@/lib/hooks/usePolymarketData';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Scenario {
  marketId: string;
  probability: number;
}

function ScenarioBuilderCardComponent() {
  const { selectedMarketId, getPrice, getMarket } = useMarketStore();
  const { data: markets } = useMarkets({ active: true, limit: 20 });
  const [selectedMarkets, setSelectedMarkets] = useState<Scenario[]>([]);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);

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

  // Calculate P&L for scenario
  const calculatePnL = () => {
    // Simplified P&L calculation
    // In production, this would account for positions, probabilities, and payouts
    let totalPnL = 0;
    selectedMarkets.forEach((scenario) => {
      const currentPrice = getPrice(scenario.marketId);
      const currentProb = currentPrice?.probability || 50;
      const scenarioProb = scenario.probability;
      
      // Assume $100 position per market (simplified)
      const position = 100;
      const pnl = ((scenarioProb - currentProb) / 100) * position;
      totalPnL += pnl;
    });

    return totalPnL;
  };

  const pnl = calculatePnL();

  return (
    <div className="h-full flex flex-col p-3 space-y-3 overflow-hidden">
      <div className="text-xs">
        <div className="font-medium">Scenario Builder</div>
        <div className="text-muted-foreground">Adjust probabilities to see portfolio P&L</div>
      </div>

      {/* Market Selector */}
      <div className="space-y-1">
        <Label className="text-xs">Add Market</Label>
        <select
          onChange={(e) => {
            if (e.target.value) {
              addMarket(e.target.value);
              e.target.value = '';
            }
          }}
          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
        >
          <option value="">Select a market...</option>
          {markets?.map((market) => (
            <option key={market.id} value={market.id}>
              {market.question}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Markets with Sliders */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {selectedMarkets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            Add markets to build scenario
          </div>
        ) : (
          selectedMarkets.map((scenario) => {
            const market = getMarket(scenario.marketId);
            const currentPrice = getPrice(scenario.marketId);
            const currentProb = currentPrice?.probability || 50;

            return (
              <div
                key={scenario.marketId}
                className="p-2 border border-border rounded space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {market?.question || scenario.marketId}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Current: {currentProb.toFixed(1)}%
                    </div>
                  </div>
                  <button
                    onClick={() => removeMarket(scenario.marketId)}
                    className="text-muted-foreground hover:text-destructive ml-2"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>Scenario Probability</span>
                    <span className="font-mono">
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
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* P&L Summary */}
      {selectedMarkets.length > 0 && (
        <div className="p-2 bg-muted rounded space-y-1">
          <div className="text-xs font-medium">Scenario P&L</div>
          <div
            className={`text-lg font-mono ${
              pnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDC
          </div>
          <div className="text-[10px] text-muted-foreground">
            Based on $100 position per market
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ScenarioBuilderCard = React.memo(ScenarioBuilderCardComponent);

