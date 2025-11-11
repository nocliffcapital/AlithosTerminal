'use client';

import React, { useMemo, useState } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { usePositions } from '@/lib/hooks/usePositions';
import { ChevronRight, ChevronDown, Filter, TrendingUp, TrendingDown, Download, BarChart3, Info, Layers, Wallet, ChevronsDown, ChevronsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [expandAll, setExpandAll] = useState(false);
  
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

  const expandAllNodes = () => {
    const allNodeIds = new Set(filteredEventTree.map((node) => node.id));
    setExpandedNodes(allNodeIds);
    setExpandAll(true);
  };

  const collapseAllNodes = () => {
    setExpandedNodes(new Set());
    setExpandedMarkets(new Set());
    setExpandAll(false);
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
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-border bg-accent/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Exposure Tree</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>View your portfolio exposure grouped by category/event. Expand nodes to see individual market positions.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="text-xs h-6 px-2"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export exposure report</p>
                </TooltipContent>
              </Tooltip>
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
          {filteredEventTree.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll ? collapseAllNodes : expandAllNodes}
                className="text-[10px] h-5 px-2"
              >
                {expandAll ? (
                  <>
                    <ChevronsUp className="h-3 w-3 mr-1" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronsDown className="h-3 w-3 mr-1" />
                    Expand All
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-accent/10">
          {showSummary && filteredEventTree.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3 text-muted-foreground" />
                  <span>Portfolio Summary</span>
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-1.5 bg-background/50 rounded border border-border/50">
                  <div className="text-muted-foreground mb-0.5">Total Exposure</div>
                  <div className="font-mono font-bold text-xs">
                    {formatCurrency(summaryStats.totalExposure)}
                  </div>
                </div>
                <div className="p-1.5 bg-background/50 rounded border border-border/50">
                  <div className="text-muted-foreground mb-0.5">Markets</div>
                  <div className="font-semibold text-xs">{summaryStats.totalMarkets}</div>
                </div>
                <div className="p-1.5 bg-background/50 rounded border border-border/50">
                  <div className="text-muted-foreground mb-0.5">Min P&L</div>
                  <div className={cn(
                    "font-mono font-bold text-xs",
                    summaryStats.totalMinPnL < 0 ? "text-red-400" : "text-green-400"
                  )}>
                    {formatCurrency(summaryStats.totalMinPnL)}
                  </div>
                </div>
                <div className="p-1.5 bg-background/50 rounded border border-border/50">
                  <div className="text-muted-foreground mb-0.5">Max P&L</div>
                  <div className={cn(
                    "font-mono font-bold text-xs",
                    summaryStats.totalMaxPnL >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {formatCurrency(summaryStats.totalMaxPnL)}
                  </div>
                </div>
                <div className="col-span-2 p-1.5 bg-background/50 rounded border border-border/50">
                  <div className="text-muted-foreground mb-0.5">Avg Exposure/Market</div>
                  <div className="font-mono font-semibold text-xs">
                    {formatCurrency(summaryStats.avgExposurePerMarket)}
                  </div>
                </div>
              </div>
            </div>
          ) : filteredEventTree.length > 0 ? (
            <button
              onClick={() => setShowSummary(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Show Summary
            </button>
          ) : null}
        </div>

        {/* Event Tree */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
                <div key={node.id} className="border border-border rounded-lg bg-card hover:border-primary/30 transition-colors">
                  {/* Category Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer p-2.5 hover:bg-accent/30 rounded-t-lg transition-colors"
                    onClick={() => toggleNode(node.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={cn(
                        "transition-transform duration-200",
                        isExpanded ? "rotate-90" : ""
                      )}>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs font-bold truncate">{node.name}</span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 px-1.5 py-0.5 bg-accent/50 rounded">
                          {node.markets.length} {node.markets.length === 1 ? 'market' : 'markets'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <div className="text-xs font-mono font-bold">
                        {formatCurrency(totalExposure)}
                      </div>
                    </div>
                  </div>

                  {/* Exposure Progress Bar */}
                  <div className="px-2.5 pb-2">
                    <div className="w-full bg-background h-2 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-2 transition-all duration-300 rounded-full",
                          totalExposure > 0 ? "bg-primary" : "bg-muted-foreground"
                        )}
                        style={{ width: `${Math.min(100, exposurePercent)}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 space-y-3 border-t border-border/50">
                      {/* P&L Range Summary */}
                      <div className="p-2 bg-accent/20 rounded border border-border/50">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          P&L Range at Resolution
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-1.5 bg-background/50 rounded border border-border/30">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                              <TrendingDown className="h-2.5 w-2.5 text-red-400" />
                              <span>Minimum</span>
                            </div>
                            <div className={cn(
                              "font-mono font-bold text-xs",
                              minPnL < 0 ? "text-red-400" : "text-green-400"
                            )}>
                              {formatCurrency(minPnL)}
                            </div>
                          </div>
                          <div className="p-1.5 bg-background/50 rounded border border-border/30">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                              <TrendingUp className="h-2.5 w-2.5 text-green-400" />
                              <span>Maximum</span>
                            </div>
                            <div className={cn(
                              "font-mono font-bold text-xs",
                              maxPnL >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {formatCurrency(maxPnL)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Market Positions */}
                      {marketPositions.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                            <Wallet className="h-3 w-3" />
                            <span>Market Positions ({marketPositions.length})</span>
                          </div>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {marketPositions.map(({ marketId, position, exposure, minPnL: marketMinPnL, maxPnL: marketMaxPnL }) => {
                              const market = markets[marketId];
                              const isMarketExpanded = expandedMarkets.has(marketId);
                              
                              return (
                                <div key={marketId} className="border border-border/50 rounded-lg bg-background/50 hover:border-primary/30 transition-colors">
                                  <div
                                    className="flex items-center justify-between cursor-pointer p-2 hover:bg-accent/20 rounded-lg transition-colors"
                                    onClick={() => toggleMarket(marketId)}
                                  >
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <div className={cn(
                                        "transition-transform duration-200",
                                        isMarketExpanded ? "rotate-90" : ""
                                      )}>
                                        <ChevronRight className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                                      </div>
                                      <span className="text-[10px] font-medium truncate">
                                        {market?.question || marketId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                        position.outcome === 'YES' 
                                          ? "text-green-400 bg-green-400/10" 
                                          : "text-red-400 bg-red-400/10"
                                      )}>
                                        {position.outcome}
                                      </span>
                                      <span className="text-[10px] font-mono font-semibold">
                                        {formatCurrency(exposure)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {isMarketExpanded && (
                                    <div className="px-2 pb-2 space-y-2 border-t border-border/30">
                                      <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                                        <div>
                                          <span className="text-muted-foreground">Size:</span>
                                          <span className="ml-1 font-mono font-semibold">
                                            {formatUnits(BigInt(Math.floor(parseFloat(position.amount || '0'))), 6)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Entry Price:</span>
                                          <span className="ml-1 font-mono font-semibold">
                                            ${(position.entryPrice || 0.5).toFixed(3)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Current Price:</span>
                                          <span className="ml-1 font-mono font-semibold">
                                            ${(position.currentPrice || position.entryPrice || 0.5).toFixed(3)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Value:</span>
                                          <span className="ml-1 font-mono font-semibold">
                                            {formatCurrency(position.currentValue || position.costBasis || 0)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="pt-1.5 border-t border-border/30">
                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className="text-muted-foreground">P&L Range:</span>
                                          <span className="font-mono font-semibold">
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ExposureTreeCard = React.memo(ExposureTreeCardComponent);

