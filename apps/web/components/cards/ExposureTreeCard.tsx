'use client';

import React, { useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { usePositions } from '@/lib/hooks/usePositions';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface EventNode {
  id: string;
  name: string;
  markets: string[];
  children?: EventNode[];
  expanded?: boolean;
}

function ExposureTreeCardComponent() {
  // Connect to real position data
  const { data: positions = [], isLoading: positionsLoading } = usePositions(true);
  const { markets, getPrice } = useMarketStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Type guard for positions
  const positionsArray = positions && Array.isArray(positions) ? positions : [];

  // Group markets by event/category, using positions if available
  const eventTree = useMemo(() => {
    // If we have positions, group by markets with positions
    // Otherwise, group all markets by category
    const grouped: Record<string, string[]> = {};
    
    if (positionsArray.length > 0) {
      // Group by market category, but only include markets with positions
      positionsArray.forEach((position) => {
        const market = markets[position.marketId];
        if (market) {
          const category = market.category || market.slug.split('-')[0] || 'uncategorized';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          if (!grouped[category].includes(position.marketId)) {
            grouped[category].push(position.marketId);
          }
        }
      });
    } else {
      // Fallback: group all markets by category
      Object.values(markets).forEach((market) => {
        const category = market.category || market.slug.split('-')[0] || 'uncategorized';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(market.id);
      });
    }

    const nodes: EventNode[] = Object.entries(grouped).map(([name, marketIds]) => ({
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      markets: marketIds,
      expanded: expandedNodes.has(name),
    }));

    return nodes;
  }, [markets, expandedNodes, positionsArray]);

  const calculateExposure = (marketIds: string[]) => {
    let totalExposure = 0;
    let minPnL = 0;
    let maxPnL = 0;

    marketIds.forEach((marketId) => {
      const price = getPrice(marketId);
      const currentProb = price && typeof price === 'object' && 'probability' in price
        ? (price as { probability: number }).probability
        : 50;

      // Use real position data if available
      const position = positionsArray.find((p) => p.marketId === marketId);
      
      if (position) {
        // Use actual position data
        const positionValue = position.currentValue || position.costBasis || 0;
        const positionAmount = parseFloat(position.amount);
        const entryPrice = position.entryPrice || 0.5;
        const currentPrice = position.currentPrice || entryPrice;
        
        totalExposure += positionValue;
        
        // Calculate min/max P&L based on position outcome
        if (position.outcome === 'YES') {
          // If YES position, min P&L if resolves NO (0%), max if resolves YES (100%)
          const minProb = 0;
          const maxProb = 100;
          minPnL += ((minProb / 100) - currentPrice) * positionValue / currentPrice;
          maxPnL += ((maxProb / 100) - currentPrice) * positionValue / currentPrice;
        } else {
          // If NO position, min P&L if resolves YES (100%), max if resolves NO (0%)
          const minProb = 100;
          const maxProb = 0;
          minPnL += ((1 - minProb / 100) - (1 - currentPrice)) * positionValue / (1 - currentPrice);
          maxPnL += ((1 - maxProb / 100) - (1 - currentPrice)) * positionValue / (1 - currentPrice);
        }
      } else {
        // Fallback: use mock data if no position
        const mockPosition = 100;
        totalExposure += mockPosition;
        
        const minProb = 0;
        const maxProb = 100;
        minPnL += ((minProb - currentProb) / 100) * mockPosition;
        maxPnL += ((maxProb - currentProb) / 100) * mockPosition;
      }
    });

    return { totalExposure, minPnL, maxPnL };
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      <div className="text-xs mb-3">
        <div className="font-medium">Event Exposure Tree</div>
        <div className="text-muted-foreground">Roll-up exposure across related markets</div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {eventTree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No markets available
          </div>
        ) : (
          eventTree.map((node) => {
            const { totalExposure, minPnL, maxPnL } = calculateExposure(
              node.markets
            );
            const isExpanded = expandedNodes.has(node.id);

            return (
              <div key={node.id} className="border border-border rounded p-2">
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-1"
                  onClick={() => toggleNode(node.id)}
                >
                  <div className="flex items-center gap-1">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className="text-xs font-medium">{node.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({node.markets.length} markets)
                    </span>
                  </div>
                  <div className="text-xs font-mono">
                    {totalExposure.toLocaleString()} USDC
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 pl-4 space-y-1 border-l border-border">
                    <div className="text-[10px] text-muted-foreground">
                      P&L at Resolution:
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Min:</span>
                      <span className={`font-mono ${minPnL < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {minPnL.toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Max:</span>
                      <span className={`font-mono ${maxPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {maxPnL.toFixed(2)} USDC
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Total Summary */}
      {eventTree.length > 0 && (
        <div className="mt-2 p-2 bg-muted rounded text-xs">
          <div className="flex items-center justify-between font-medium mb-1">
            <span>Total Exposure</span>
            <span className="font-mono">
              {eventTree.reduce(
                (sum, node) =>
                  sum + calculateExposure(node.markets).totalExposure,
                0
              ).toLocaleString()}{' '}
              USDC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ExposureTreeCard = React.memo(ExposureTreeCardComponent);

