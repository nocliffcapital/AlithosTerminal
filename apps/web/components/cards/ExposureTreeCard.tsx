'use client';

import React, { useMemo, useState } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { usePositions } from '@/lib/hooks/usePositions';
import { ChevronRight, ChevronDown, Filter, TrendingUp, TrendingDown, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  
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
    const marketPositions: Array<{
      marketId: string;
      position: any;
      exposure: number;
      minPnL: number;
      maxPnL: number;
    }> = [];

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
        
        let marketMinPnL = 0;
        let marketMaxPnL = 0;
        
        // Calculate min/max P&L based on position outcome
        if (position.outcome === 'YES') {
          // If YES position, min P&L if resolves NO (0%), max if resolves YES (100%)
          const minProb = 0;
          const maxProb = 100;
          marketMinPnL = ((minProb / 100) - currentPrice) * positionValue / currentPrice;
          marketMaxPnL = ((maxProb / 100) - currentPrice) * positionValue / currentPrice;
        } else {
          // If NO position, min P&L if resolves YES (100%), max if resolves NO (0%)
          const minProb = 100;
          const maxProb = 0;
          marketMinPnL = ((1 - minProb / 100) - (1 - currentPrice)) * positionValue / (1 - currentPrice);
          marketMaxPnL = ((1 - maxProb / 100) - (1 - currentPrice)) * positionValue / (1 - currentPrice);
        }
        
        minPnL += marketMinPnL;
        maxPnL += marketMaxPnL;
        
        marketPositions.push({
          marketId,
          position,
          exposure: positionValue,
          minPnL: marketMinPnL,
          maxPnL: marketMaxPnL,
        });
      } else {
        // Fallback: use mock data if no position
        const mockPosition = 100;
        totalExposure += mockPosition;
        
        const minProb = 0;
        const maxProb = 100;
        const marketMinPnL = ((minProb - currentProb) / 100) * mockPosition;
        const marketMaxPnL = ((maxProb - currentProb) / 100) * mockPosition;
        minPnL += marketMinPnL;
        maxPnL += marketMaxPnL;
      }
    });

    return { totalExposure, minPnL, maxPnL, marketPositions };
  };

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    eventTree.forEach((node) => {
      cats.add(node.id);
    });
    return Array.from(cats).sort();
  }, [eventTree]);

  // Filter event tree by category
  const filteredEventTree = useMemo(() => {
    if (!filterCategory) return eventTree;
    return eventTree.filter((node) => node.id === filterCategory);
  }, [eventTree, filterCategory]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalExposure = eventTree.reduce(
      (sum, node) => sum + calculateExposure(node.markets).totalExposure,
      0
    );
    const totalMinPnL = eventTree.reduce(
      (sum, node) => sum + calculateExposure(node.markets).minPnL,
      0
    );
    const totalMaxPnL = eventTree.reduce(
      (sum, node) => sum + calculateExposure(node.markets).maxPnL,
      0
    );
    const totalMarkets = eventTree.reduce(
      (sum, node) => sum + node.markets.length,
      0
    );
    const avgExposurePerMarket = totalMarkets > 0 ? totalExposure / totalMarkets : 0;

    return {
      totalExposure,
      totalMinPnL,
      totalMaxPnL,
      totalMarkets,
      avgExposurePerMarket,
    };
  }, [eventTree]);

  const formatCurrency = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const toggleMarket = (marketId: string) => {
    const newExpanded = new Set(expandedMarkets);
    if (newExpanded.has(marketId)) {
      newExpanded.delete(marketId);
    } else {
      newExpanded.add(marketId);
    }
    setExpandedMarkets(newExpanded);
  };

  const handleExport = () => {
    const exportData = {
      summary: summaryStats,
      nodes: eventTree.map((node) => {
        const exposure = calculateExposure(node.markets);
        return {
          category: node.id,
          name: node.name,
          markets: node.markets.length,
          exposure: exposure.totalExposure,
          minPnL: exposure.minPnL,
          maxPnL: exposure.maxPnL,
        };
      }),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exposure-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  if (positionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" text="Loading positions..." />
      </div>
    );
  }

  if (positionsArray.length === 0 && eventTree.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No positions found"
        description="No positions available. Positions will appear here as you make trades."
        className="p-4"
      />
    );
  }

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header with Filters */}
      <div className="flex-shrink-0 mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold">Event Exposure Tree</div>
            <div className="text-[10px] text-muted-foreground">Roll-up exposure across related markets</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="text-xs h-6 px-2"
              title="Export exposure report"
            >
              <Download className="h-3 w-3" />
            </Button>
            {categories.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-6 px-2">
                    <Filter className="h-3 w-3 mr-1" />
                    {filterCategory || 'All'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => setFilterCategory(null)}
                    className={!filterCategory ? 'bg-accent' : ''}
                  >
                    <span className="text-xs">All</span>
                  </DropdownMenuItem>
                  {categories.map((cat) => (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={filterCategory === cat ? 'bg-accent' : ''}
                    >
                      <span className="text-xs capitalize">{cat}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {showSummary && filteredEventTree.length > 0 && (
        <div className="flex-shrink-0 mb-3 p-2 border border-border rounded-lg bg-card space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Summary Statistics</span>
            <button
              onClick={() => setShowSummary(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">Total Exposure:</span>
              <span className="ml-1 font-mono font-semibold">
                {formatCurrency(summaryStats.totalExposure)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Markets:</span>
              <span className="ml-1 font-semibold">{summaryStats.totalMarkets}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Min P&L:</span>
              <span className={cn(
                "ml-1 font-mono font-semibold",
                summaryStats.totalMinPnL < 0 ? "text-red-400" : "text-green-400"
              )}>
                {formatCurrency(summaryStats.totalMinPnL)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Max P&L:</span>
              <span className={cn(
                "ml-1 font-mono font-semibold",
                summaryStats.totalMaxPnL >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(summaryStats.totalMaxPnL)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Avg Exposure/Market:</span>
              <span className="ml-1 font-mono font-semibold">
                {formatCurrency(summaryStats.avgExposurePerMarket)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!showSummary && filteredEventTree.length > 0 && (
        <div className="flex-shrink-0 mb-2">
          <button
            onClick={() => setShowSummary(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Show Summary
          </button>
        </div>
      )}

      {/* Event Tree */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredEventTree.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No categories found"
            description="No markets match the selected filter"
            className="p-4"
          />
        ) : (
          filteredEventTree.map((node) => {
            const { totalExposure, minPnL, maxPnL, marketPositions } = calculateExposure(
              node.markets
            );
            const isExpanded = expandedNodes.has(node.id);
            
            // Calculate exposure percentage for progress bar
            const maxExposure = Math.max(...filteredEventTree.map((n) => calculateExposure(n.markets).totalExposure), totalExposure);
            const exposurePercent = maxExposure > 0 ? (totalExposure / maxExposure) * 100 : 0;

            return (
              <div key={node.id} className="border border-border rounded-lg p-2 bg-card hover:bg-accent/20 transition-colors">
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-1"
                  onClick={() => toggleNode(node.id)}
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate">{node.name}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      ({node.markets.length} markets)
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold flex-shrink-0 ml-2">
                    {formatCurrency(totalExposure)}
                  </div>
                </div>

                {/* Exposure Progress Bar */}
                <div className="mt-1.5 mb-1.5">
                  <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-1.5 transition-all duration-300",
                        totalExposure > 0 ? "bg-primary" : "bg-muted-foreground"
                      )}
                      style={{ width: `${Math.min(100, exposurePercent)}%` }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 pl-4 space-y-2 border-l-2 border-primary/30">
                    {/* P&L Range */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        P&L at Resolution:
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-400" />
                          Min:
                        </span>
                        <span className={cn(
                          "font-mono font-semibold",
                          minPnL < 0 ? "text-red-400" : "text-green-400"
                        )}>
                          {formatCurrency(minPnL)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-green-400" />
                          Max:
                        </span>
                        <span className={cn(
                          "font-mono font-semibold",
                          maxPnL >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {formatCurrency(maxPnL)}
                        </span>
                      </div>
                    </div>

                    {/* Individual Market Positions */}
                    {marketPositions.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-border/50">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                          Market Positions ({marketPositions.length}):
                        </div>
                        {marketPositions.map(({ marketId, position, exposure, minPnL: marketMinPnL, maxPnL: marketMaxPnL }) => {
                          const market = markets[marketId];
                          const isMarketExpanded = expandedMarkets.has(marketId);
                          
                          return (
                            <div key={marketId} className="border border-border/50 rounded p-1.5 bg-background/50">
                              <div
                                className="flex items-center justify-between cursor-pointer hover:bg-accent/30 rounded p-0.5"
                                onClick={() => toggleMarket(marketId)}
                              >
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  {isMarketExpanded ? (
                                    <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" />
                                  )}
                                  <span className="text-[10px] font-medium truncate">
                                    {market?.question || marketId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={cn(
                                    "text-[10px] font-semibold",
                                    position.outcome === 'YES' ? "text-green-400" : "text-red-400"
                                  )}>
                                    {position.outcome}
                                  </span>
                                  <span className="text-[10px] font-mono">
                                    {formatCurrency(exposure)}
                                  </span>
                                </div>
                              </div>
                              
                              {isMarketExpanded && (
                                <div className="mt-1.5 pl-3 space-y-1 border-l border-border/30">
                                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                                    <div>
                                      <span className="text-muted-foreground">Size:</span>
                                      <span className="ml-1 font-mono">
                                        {formatUnits(BigInt(Math.floor(parseFloat(position.amount || '0'))), 6)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Entry:</span>
                                      <span className="ml-1 font-mono">
                                        ${(position.entryPrice || 0.5).toFixed(3)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Current:</span>
                                      <span className="ml-1 font-mono">
                                        ${(position.currentPrice || position.entryPrice || 0.5).toFixed(3)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Value:</span>
                                      <span className="ml-1 font-mono">
                                        {formatCurrency(position.currentValue || position.costBasis || 0)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="pt-1 border-t border-border/30">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">P&L Range:</span>
                                      <span className="font-mono">
                                        {formatCurrency(marketMinPnL)} / {formatCurrency(marketMaxPnL)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Total Summary Footer */}
      {filteredEventTree.length > 0 && (
        <div className="flex-shrink-0 mt-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Total Exposure</span>
            <span className="font-mono font-semibold">
              {formatCurrency(summaryStats.totalExposure)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ExposureTreeCard = React.memo(ExposureTreeCardComponent);

