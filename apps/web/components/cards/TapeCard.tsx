'use client';

import React from 'react';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { useRealtimeTrades } from '@/lib/hooks/useRealtimeTrades';
import { onChainService } from '@/lib/api/onchain';
import { useMarketStore } from '@/stores/market-store';
import { Loader2, Search, Wallet, Zap, DollarSign } from 'lucide-react';
import { useEffect, useState, useMemo, useRef, useCallback, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardHeaderActionsContext } from '@/components/layout/Card';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

interface Trade {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  price: number;
  timestamp: number;
  user: string;
  transactionHash: string;
}

function TapeCardComponent() {
  const { selectedMarketId } = useMarketStore();
  const { data: trades = [], isLoading, error } = useTrades(selectedMarketId);
  
  // Subscribe to real-time trade updates for instant updates
  useRealtimeTrades(selectedMarketId);
  
  const [walletTags, setWalletTags] = useState<Map<string, string>>(new Map());
  const prevTradesRef = useRef<string>('');
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');
  
  // Register settings handler with card header
  const { setOnSettingsClick } = useContext(CardHeaderActionsContext);
  
  const handleShowSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  // Register/unregister settings handler
  useEffect(() => {
    if (setOnSettingsClick) {
      setOnSettingsClick(() => handleShowSettings);
      return () => {
        setOnSettingsClick(undefined);
      };
    }
  }, [setOnSettingsClick, handleShowSettings]);
  
  // Memoize handlers to prevent unnecessary re-renders
  const handleShowMarketSelector = useCallback(() => {
    setShowMarketSelector(true);
  }, []);
  
  const handleCloseMarketSelector = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);

  const handleCloseSettings = useCallback((open: boolean) => {
    setShowSettings(open);
  }, []);

  // Memoize trades string to compare
  const tradesKey = useMemo(() => {
    if (!trades || trades.length === 0) return '';
    return trades.map((t: Trade) => t.id).join(',');
  }, [trades]);

  useEffect(() => {
    // Only process if trades actually changed
    if (tradesKey === prevTradesRef.current) {
      return;
    }
    prevTradesRef.current = tradesKey;

    if (!trades || trades.length === 0) {
      setWalletTags(new Map());
      return;
    }

    const tags = new Map<string, string>();
    trades.forEach((trade: Trade) => {
      if (trade && trade.user) {
        try {
          const tag = onChainService.tagWallet(trade.user);
          tags.set(trade.user, tag.type);
        } catch (error) {
          // Silently handle tagging errors
          tags.set(trade.user, 'unknown');
        }
      }
    });
    
    setWalletTags(tags);
  }, [tradesKey, trades]);

  // Memoize format functions to prevent recreation on every render - MUST be before early returns
  const formatTime = useCallback((timestamp: number) => {
    // Handle timestamp - might already be in milliseconds or seconds
    const timestampMs = timestamp < 946684800000 ? timestamp * 1000 : timestamp;
    const date = new Date(timestampMs);
    const now = Date.now();
    const diffMs = now - timestampMs;
    
    // Show relative time for recent trades (< 1 hour)
    if (diffMs < 60 * 1000) {
      return `${Math.floor(diffMs / 1000)}s ago`;
    } else if (diffMs < 60 * 60 * 1000) {
      return `${Math.floor(diffMs / (60 * 1000))}m ago`;
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
    }
    
    // For older trades, show time of day
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  const getWalletTagColor = useCallback((type: string) => {
    switch (type) {
      case 'whale':
        return 'text-purple-400';
      case 'market-maker':
        return 'text-blue-400';
      case 'new-money':
        return 'text-green-400';
      default:
        return 'text-muted-foreground';
    }
  }, []);

  const getWalletTagIcon = useCallback((type: string) => {
    switch (type) {
      case 'whale':
        return <Wallet className="h-3 w-3" />;
      case 'market-maker':
        return <Zap className="h-3 w-3" />;
      case 'new-money':
        return <DollarSign className="h-3 w-3" />;
      default:
        return null;
    }
  }, []);

  // Helper function to normalize amount from wei to USDC
  const normalizeAmount = useCallback((amountStr: string): number => {
    if (!amountStr || amountStr === '0') return 0;
    
    // Convert to string if it's not already
    const str = String(amountStr);
    
    // Handle string format - if it contains a decimal point and is reasonable, it's likely already in USDC
    const hasDecimal = str.includes('.');
    const amount = parseFloat(str);
    if (isNaN(amount)) return 0;
    
    // If amount has decimal and is reasonable (< 1 million), it's likely already in USDC format
    if (hasDecimal && amount < 1000000 && amount > 0) {
      return amount;
    }
    
    // If amount is extremely large (likely in wei format), normalize to USDC
    // Wei format: 1 USDC = 1e6 (USDC has 6 decimals), or 1e18 for ETH-based tokens
    // Check if it's wei (1e18) or USDC wei (1e6)
    if (amount >= 1e18) {
      // Likely ETH-based wei (1e18)
      return amount / 1e18;
    } else if (amount >= 1e6 && !hasDecimal) {
      // Likely USDC wei (1e6) - only if no decimal (whole number wei)
      return amount / 1e6;
    } else if (amount >= 1000000 && !hasDecimal) {
      // Large whole number without decimal - might be in wei format
      // Try to detect if it's likely wei by checking if dividing by 1e6 gives a reasonable result
      const normalized = amount / 1e6;
      if (normalized < 1000000 && normalized > 0) {
        return normalized;
      }
    }
    
    // Already in USDC format or too small to normalize
    return amount;
  }, []);

  // Filter trades by size
  const filteredTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    let filtered = [...trades];
    
    // Filter by minimum size
    if (minSize && minSize.trim() !== '') {
      const min = parseFloat(minSize);
      if (!isNaN(min) && min >= 0) {
        filtered = filtered.filter((trade) => {
          const normalizedAmount = normalizeAmount(trade.amount || '0');
          return normalizedAmount >= min;
        });
      }
    }
    
    // Filter by maximum size
    if (maxSize && maxSize.trim() !== '') {
      const max = parseFloat(maxSize);
      if (!isNaN(max) && max > 0) {
        filtered = filtered.filter((trade) => {
          const normalizedAmount = normalizeAmount(trade.amount || '0');
          return normalizedAmount <= max;
        });
      }
    }
    
    return filtered;
  }, [trades, minSize, maxSize, normalizeAmount]);

  if (!selectedMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view tape"
          description="Choose a market to see its trading activity"
          action={{
            label: 'Select Market',
            onClick: handleShowMarketSelector,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleCloseMarketSelector}
        />
      </>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        {(minSize || maxSize) && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-accent/20">
            <div className="flex items-center justify-end">
              <div className="text-[10px] text-muted-foreground">
                {filteredTrades.length} of {trades.length} trades
              </div>
            </div>
          </div>
        )}

        {/* Trade List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading trades...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm px-4">
              Failed to load trades
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm px-4 text-center">
              {trades.length === 0 ? 'No trades yet' : `No trades match filter (${trades.length} total)`}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {/* Column Headers */}
              <div className="sticky top-0 bg-background z-10 border-b border-border px-3 py-2 grid grid-cols-[auto_60px_1fr_50px_80px_60px_70px] gap-2">
                <div className="text-xs font-semibold text-muted-foreground">Wallet</div>
                <div className="text-xs font-semibold text-muted-foreground text-center">Action</div>
                <div className="text-xs font-semibold text-muted-foreground">Market</div>
                <div className="text-xs font-semibold text-muted-foreground text-center">Outcome</div>
                <div className="text-xs font-semibold text-muted-foreground text-right">Amount</div>
                <div className="text-xs font-semibold text-muted-foreground text-right">Price</div>
                <div className="text-xs font-semibold text-muted-foreground text-right">Time</div>
              </div>
              {filteredTrades.map((trade: Trade) => {
                const walletType = walletTags.get(trade.user) || 'unknown';
                const isBuy = trade.outcome === 'YES';
                
                // Ensure unique key - combine ID, timestamp, and transactionHash to prevent duplicates
                const uniqueKey = `${trade.id}-${trade.timestamp}-${trade.transactionHash || trade.user}`;
                
                return (
                  <div
                    key={uniqueKey}
                    className={cn(
                      "px-3 py-2 hover:bg-accent/30 transition-colors duration-200 grid grid-cols-[auto_60px_1fr_50px_80px_60px_70px] gap-2 items-center text-xs",
                      isBuy ? 'bg-green-500/5' : 'bg-red-500/5'
                    )}
                  >
                    {/* User & Wallet Tag */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("flex-shrink-0", getWalletTagColor(walletType))}>
                        {getWalletTagIcon(walletType)}
                      </span>
                      <span className="font-mono text-xs truncate" title={trade.user}>
                        {trade.user.slice(0, 8)}...{trade.user.slice(-6)}
                      </span>
                    </div>

                    {/* Action (BUY/SELL) */}
                    <div className={cn(
                      "font-semibold text-xs px-1.5 py-0.5 rounded text-center",
                      isBuy 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    )}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </div>

                    {/* Market */}
                    <div className="text-xs text-muted-foreground truncate min-w-0">
                      {trade.marketId.slice(0, 12)}...
                    </div>

                    {/* Outcome */}
                    <div className={cn(
                      "font-mono font-medium text-xs text-center",
                      isBuy ? 'text-green-400' : 'text-red-400'
                    )}>
                      {trade.outcome}
                    </div>

                    {/* Amount */}
                    <div className="font-mono text-xs text-muted-foreground text-right">
                      ${normalizeAmount(trade.amount).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </div>

                    {/* Price */}
                    <div className="font-mono text-xs font-semibold text-right">
                      {trade.price.toFixed(2)}c
                    </div>

                    {/* Time */}
                    <div className="text-xs text-muted-foreground text-right">
                      {formatTime(trade.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={handleCloseSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Trades by Size</DialogTitle>
            <DialogDescription>
              Set minimum and maximum trade sizes (in USDC) to filter the tape. Filters apply automatically as you type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Minimum Size */}
            <div className="space-y-2">
              <Label htmlFor="min-size">
                Minimum Size (USDC)
              </Label>
              <Input
                id="min-size"
                type="number"
                placeholder="0"
                value={minSize}
                onChange={(e) => {
                  setMinSize(e.target.value);
                }}
                step="0.01"
                min="0"
                className="text-sm"
              />
            </div>

            {/* Maximum Size */}
            <div className="space-y-2">
              <Label htmlFor="max-size">
                Maximum Size (USDC)
              </Label>
              <Input
                id="max-size"
                type="number"
                placeholder="No limit"
                value={maxSize}
                onChange={(e) => {
                  setMaxSize(e.target.value);
                }}
                step="0.01"
                min="0"
                className="text-sm"
              />
            </div>

            {/* Active Filters Info */}
            {(minSize || maxSize) && (
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Showing {filteredTrades.length} of {trades.length} trades
                {minSize && minSize.trim() !== '' && ` (min: $${parseFloat(minSize || '0').toLocaleString()})`}
                {maxSize && maxSize.trim() !== '' && ` (max: $${parseFloat(maxSize || '0').toLocaleString()})`}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-border">
              {(minSize || maxSize) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMinSize('');
                    setMaxSize('');
                  }}
                  className="flex-1"
                >
                  Clear Filters
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export component (not memoized since it uses hooks and doesn't take props)
export const TapeCard = TapeCardComponent;

