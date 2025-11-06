'use client';

import React from 'react';
import { useTrades } from '@/lib/hooks/usePolymarketData';
import { onChainService } from '@/lib/api/onchain';
import { useMarketStore } from '@/stores/market-store';
import { Loader2, Search } from 'lucide-react';
import { useEffect, useState, useMemo, useRef, useCallback, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardHeaderActionsContext } from '@/components/layout/Card';

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
    
    // Debug: Log sample trade amounts to understand format
    if (trades.length > 0 && (minSize || maxSize)) {
      console.log('[TapeCard] Sample trade amounts (first 5):', 
        trades.slice(0, 5).map(t => ({
          id: t.id,
          rawAmount: t.amount,
          normalized: normalizeAmount(t.amount || '0'),
          type: typeof t.amount,
        }))
      );
    }
    
    // Filter by minimum size
    if (minSize && minSize.trim() !== '') {
      const min = parseFloat(minSize);
      if (!isNaN(min) && min >= 0) {
        const beforeCount = filtered.length;
        filtered = filtered.filter((trade) => {
          const normalizedAmount = normalizeAmount(trade.amount || '0');
          const passes = normalizedAmount >= min;
          
          if (!passes) {
            console.log(`[TapeCard] Trade filtered out:`, {
              tradeId: trade.id,
              rawAmount: trade.amount,
              normalizedAmount,
              min,
              passes,
            });
          }
          
          return passes;
        });
        console.log(`[TapeCard] Min filter: ${beforeCount} -> ${filtered.length} trades (min=${min})`);
      }
    }
    
    // Filter by maximum size
    if (maxSize && maxSize.trim() !== '') {
      const max = parseFloat(maxSize);
      if (!isNaN(max) && max > 0) {
        const beforeCount = filtered.length;
        filtered = filtered.filter((trade) => {
          const normalizedAmount = normalizeAmount(trade.amount || '0');
          const passes = normalizedAmount <= max;
          
          if (!passes) {
            console.log(`[TapeCard] Trade filtered out:`, {
              tradeId: trade.id,
              rawAmount: trade.amount,
              normalizedAmount,
              max,
              passes,
            });
          }
          
          return passes;
        });
        console.log(`[TapeCard] Max filter: ${beforeCount} -> ${filtered.length} trades (max=${max})`);
      }
    }
    
    // Debug: Log final filtered trades
    if ((minSize || maxSize) && filtered.length > 0) {
      console.log('[TapeCard] Filtered trades (first 5):', 
        filtered.slice(0, 5).map(t => ({
          id: t.id,
          rawAmount: t.amount,
          normalized: normalizeAmount(t.amount || '0'),
        }))
      );
    }
    
    // Verify all filtered trades actually pass the filters
    if ((minSize || maxSize) && filtered.length > 0) {
      const min = minSize ? parseFloat(minSize) : -Infinity;
      const max = maxSize ? parseFloat(maxSize) : Infinity;
      
      const invalidTrades = filtered.filter(trade => {
        const normalizedAmount = normalizeAmount(trade.amount || '0');
        const passesMin = isNaN(min) || min < 0 || normalizedAmount >= min;
        const passesMax = isNaN(max) || max <= 0 || normalizedAmount <= max;
        return !passesMin || !passesMax;
      });
      
      if (invalidTrades.length > 0) {
        console.error('[TapeCard] ERROR: Found trades in filtered array that should be filtered out!', {
          invalidCount: invalidTrades.length,
          invalidTrades: invalidTrades.map(t => ({
            id: t.id,
            rawAmount: t.amount,
            normalized: normalizeAmount(t.amount || '0'),
            min,
            max,
          })),
        });
      }
    }
    
    return filtered;
  }, [trades, minSize, maxSize, normalizeAmount]);

  // Debug: Log when filteredTrades changes
  useEffect(() => {
    if (minSize || maxSize) {
      console.log('[TapeCard] filteredTrades updated:', {
        totalTrades: trades.length,
        filteredCount: filteredTrades.length,
        minSize,
        maxSize,
        renderingTrades: filteredTrades.length,
      });
    }
  }, [filteredTrades, trades.length, minSize, maxSize]);

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <div className="text-muted-foreground text-sm mb-2">
            Select a market to view tape
          </div>
          <Button
            onClick={handleShowMarketSelector}
            variant="outline"
            size="sm"
          >
            <Search className="h-4 w-4 mr-2" />
            Select Market
          </Button>
        </div>
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
        <div className="flex-1 overflow-y-auto space-y-0.5 p-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading trades...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">
              Failed to load trades
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {trades.length === 0 ? 'No trades yet' : `No trades match filter (${trades.length} total)`}
            </div>
          ) : (
            filteredTrades.map((trade: Trade) => {
              // Debug: Log what we're about to render and verify filter (only on first trade)
              if (minSize || maxSize) {
                const isFirstTrade = filteredTrades.indexOf(trade) === 0;
                if (isFirstTrade) {
                  const min = minSize ? parseFloat(minSize) : -Infinity;
                  const max = maxSize ? parseFloat(maxSize) : Infinity;
                  
                  // Check if any trades in filteredTrades don't pass the filter
                  const invalidInFiltered = filteredTrades.filter(t => {
                    const norm = normalizeAmount(t.amount || '0');
                    return (min >= 0 && norm < min) || (max > 0 && norm > max);
                  });
                  
                  console.log('[TapeCard] Rendering trades:', {
                    filteredCount: filteredTrades.length,
                    totalCount: trades.length,
                    minSize,
                    maxSize,
                    invalidInFiltered: invalidInFiltered.length,
                    firstFewAmounts: filteredTrades.slice(0, 5).map(t => ({
                      raw: t.amount,
                      normalized: normalizeAmount(t.amount || '0'),
                      passesMin: min < 0 || normalizeAmount(t.amount || '0') >= min,
                      passesMax: max <= 0 || normalizeAmount(t.amount || '0') <= max,
                    })),
                  });
                  
                  if (invalidInFiltered.length > 0) {
                    console.error('[TapeCard] CRITICAL: Found invalid trades in filteredTrades:', invalidInFiltered);
                  }
                }
              }
              
              const walletType = walletTags.get(trade.user) || 'unknown';
              const isBuy = trade.outcome === 'YES';
              
              // Ensure unique key - combine ID, timestamp, and transactionHash to prevent duplicates
              const uniqueKey = `${trade.id}-${trade.timestamp}-${trade.transactionHash || trade.user}`;
              
              return (
              <div
                key={uniqueKey}
                className={`flex items-center justify-between px-2 py-1.5 text-xs border-b border-border/50 gap-2 ${
                  isBuy ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                {/* User & Wallet Tag */}
                <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                  <span className={getWalletTagColor(walletType)}>
                    {walletType === 'whale' ? '🐋' : walletType === 'market-maker' ? '⚡' : '💰'}
                  </span>
                  <span className="font-mono text-[10px] truncate">
                    {trade.user.slice(0, 6)}...{trade.user.slice(-4)}
                  </span>
                </div>

                {/* Action (BUY/SELL) */}
                <div className={`font-semibold text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isBuy 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {isBuy ? 'BUY' : 'SELL'}
                </div>

                {/* Market (simplified - could show market name if available) */}
                <div className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
                  {trade.marketId.slice(0, 12)}...
                </div>

                {/* Outcome */}
                <div className={`font-mono font-medium text-[10px] flex-shrink-0 ${
                  isBuy ? 'text-green-400' : 'text-red-400'
                }`}>
                  {trade.outcome}
                </div>

                {/* Amount */}
                <div className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                  ${normalizeAmount(trade.amount).toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>

                {/* Price */}
                <div className="font-mono text-[10px] font-semibold flex-shrink-0">
                  {trade.price.toFixed(2)}c
                </div>

                {/* Time */}
                <div className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatTime(trade.timestamp)}
                </div>
              </div>
            );
            })
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
              <Label htmlFor="min-size" className="text-sm">
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
              <Label htmlFor="max-size" className="text-sm">
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

