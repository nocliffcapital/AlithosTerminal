'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useTrading } from '@/lib/hooks/useTrading';
import { usePresets } from '@/lib/hooks/usePresets';
import { useTradingSettingsStore } from '@/stores/trading-settings-store';
import { useTotalPnL, usePositions, PositionWithPnL } from '@/lib/hooks/usePositions';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Address, formatUnits, parseUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { USDC_ADDRESS, erc20ABI } from '@/lib/web3/polymarket-contracts';
import { getEffectiveAddress } from '@/lib/web3/proxy-wallet';
import { Loader2, TrendingUp, TrendingDown, Settings, Zap, Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TransactionConfirmModal, TransactionDetails } from '@/components/trading/TransactionConfirmModal';
import { GasSettingsDialog } from '@/components/trading/GasSettingsDialog';
import { SlippageSettingsDialog } from '@/components/trading/SlippageSettingsDialog';
import { AllowanceManager } from '@/components/trading/AllowanceManager';
import { RiskWarning } from '@/components/ui/RiskWarning';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShoppingCart } from 'lucide-react';

interface TradingOrderFormsProps {
  marketId?: string | null;
}

export function TradingOrderForms({ marketId }: TradingOrderFormsProps) {
  const { getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(marketId || null);
  const [activeTab, setActiveTab] = useState<'market' | 'limit' | 'advanced'>('market');
  
  const { buy, sell } = useTrading();
  const { presets } = usePresets();
  const { settings, setSlippageTolerance, setGasPriority } = useTradingSettingsStore();
  const { error: showErrorToast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<TransactionDetails | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  
  // Limit order state
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [limitAmount, setLimitAmount] = useState<string>('');
  const [limitSide, setLimitSide] = useState<'buy' | 'sell'>('buy');
  const [limitOutcome, setLimitOutcome] = useState<'YES' | 'NO'>('YES');
  
  // Market order state
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderOutcome, setOrderOutcome] = useState<'YES' | 'NO'>('YES');
  
  // Subscribe to real-time price updates for the selected outcome
  useRealtimePrice(marketId || null, orderOutcome);
  const [enableTP, setEnableTP] = useState(false);
  const [enableSL, setEnableSL] = useState(false);
  const [tpPrice, setTpPrice] = useState<string>('');
  const [tpGain, setTpGain] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');
  const [slLoss, setSlLoss] = useState<string>('');
  
  // Image error handling
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  // Settings dialogs
  const [showGasSettings, setShowGasSettings] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [showAllowanceManager, setShowAllowanceManager] = useState(false);
  
  // Account data
  const { user } = usePrivy();
  const { dbUser } = useAuth();
  const { totalCurrentValue, totalUnrealizedPnL } = useTotalPnL();
  const { data: positions = [] } = usePositions(false);
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Check if user has shares available to sell for the selected market and outcome (for market orders)
  const hasSharesToSell = useMemo(() => {
    if (orderSide !== 'sell' || !marketId) return true; // Always allow if buying or no market selected
    
    // Find position for this market and outcome
    const position = positions.find(
      (pos: PositionWithPnL) => 
        pos.marketId === marketId && 
        pos.outcome === orderOutcome &&
        parseFloat(pos.amount || '0') > 0
    );
    
    return !!position && parseFloat(position.amount || '0') > 0;
  }, [positions, marketId, orderOutcome, orderSide]);

  // Check if user has shares available to sell for limit orders
  const hasSharesToSellLimit = useMemo(() => {
    if (limitSide !== 'sell' || !marketId) return true; // Always allow if buying or no market selected
    
    // Find position for this market and outcome
    const position = positions.find(
      (pos: PositionWithPnL) => 
        pos.marketId === marketId && 
        pos.outcome === limitOutcome &&
        parseFloat(pos.amount || '0') > 0
    );
    
    return !!position && parseFloat(position.amount || '0') > 0;
  }, [positions, marketId, limitOutcome, limitSide]);
  
  // Calculate trading equity (USDC balance + total current value of positions)
  const tradingEquity = useMemo(() => {
    const usdc = parseFloat(usdcBalance) || 0;
    return usdc + totalCurrentValue;
  }, [usdcBalance, totalCurrentValue]);
  
  // Fetch USDC balance
  React.useEffect(() => {
    const fetchBalance = async () => {
      const walletAddress = (user?.wallet?.address as Address | undefined) ||
        (dbUser?.walletAddress as Address | undefined);
      
      if (!walletAddress) {
        setUsdcBalance('0.00');
        return;
      }
      
      setIsLoadingBalance(true);
      try {
        const publicClient = createPublicClient({
          chain: polygon,
          transport: http('https://polygon-rpc.com'),
        });
        
        const effectiveAddress = await getEffectiveAddress(walletAddress);
        
        const usdcBalanceProxy = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [effectiveAddress],
        }).catch(() => 0n);
        
        const usdcBalanceEOA = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        }).catch(() => 0n);
        
        const usdcBalance = usdcBalanceProxy > usdcBalanceEOA ? usdcBalanceProxy : usdcBalanceEOA;
        setUsdcBalance(formatUnits(usdcBalance, 6));
      } catch (error) {
        console.error('Error fetching USDC balance:', error);
        setUsdcBalance('0.00');
      } finally {
        setIsLoadingBalance(false);
      }
    };
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user?.wallet?.address, dbUser?.walletAddress]);
  
  const currentProbability = useMemo(() => {
    return price && typeof price === 'object' && 'probability' in price 
      ? (price as { probability: number }).probability 
      : 0;
  }, [price]);
  
  // Track which field was last edited to prevent circular updates
  const [lastEditedTP, setLastEditedTP] = useState<'price' | 'gain' | null>(null);
  const [lastEditedSL, setLastEditedSL] = useState<'price' | 'loss' | null>(null);
  
  // Auto-calculate TP gain from price
  React.useEffect(() => {
    if (!enableTP || currentProbability <= 0 || orderSide !== 'buy') return;
    
    if (lastEditedTP === 'price' && tpPrice) {
      const price = parseFloat(tpPrice);
      if (!isNaN(price) && price > 0) {
        const gain = ((price - currentProbability) / currentProbability) * 100;
        setTpGain(gain.toFixed(2));
      }
    } else if (lastEditedTP === 'gain' && tpGain) {
      const gain = parseFloat(tpGain);
      if (!isNaN(gain)) {
        const price = currentProbability * (1 + gain / 100);
        setTpPrice(price.toFixed(4));
      }
    }
  }, [enableTP, tpPrice, tpGain, currentProbability, orderSide, lastEditedTP]);
  
  // Auto-calculate SL loss from price
  React.useEffect(() => {
    if (!enableSL || currentProbability <= 0 || orderSide !== 'buy') return;
    
    if (lastEditedSL === 'price' && slPrice) {
      const price = parseFloat(slPrice);
      if (!isNaN(price) && price > 0) {
        const loss = ((currentProbability - price) / currentProbability) * 100;
        setSlLoss(loss.toFixed(2));
      }
    } else if (lastEditedSL === 'loss' && slLoss) {
      const loss = parseFloat(slLoss);
      if (!isNaN(loss)) {
        const price = currentProbability * (1 - loss / 100);
        setSlPrice(price.toFixed(4));
      }
    }
  }, [enableSL, slPrice, slLoss, currentProbability, orderSide, lastEditedSL]);

  const market = useMemo(() => {
    if (!marketId) return null;
    return getMarket(marketId);
  }, [marketId, getMarket]);

  const handleMarketOrder = useCallback(async (amount: number, type: 'buy' | 'sell') => {
    if (!marketId || isSubmitting) return;
    
    const usdcAmount = parseUnits(amount.toFixed(6), 6);
    const transaction: TransactionDetails = {
      type,
      marketId,
      outcome: orderOutcome,
      amount: usdcAmount,
      amountDisplay: amount,
      currentPrice: currentProbability / 100,
    };
    
    setPendingTransaction(transaction);
    setShowConfirmModal(true);
  }, [marketId, currentProbability, isSubmitting, orderOutcome]);

  const executeTransaction = useCallback(async () => {
    if (!pendingTransaction || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const result = pendingTransaction.type === 'buy' 
        ? await buy({
            marketId: pendingTransaction.marketId,
            outcome: pendingTransaction.outcome,
            amount: pendingTransaction.amount,
          })
        : await sell({
            marketId: pendingTransaction.marketId,
            outcome: pendingTransaction.outcome,
            amount: pendingTransaction.amount,
          });
      
      if (result.success) {
        if (result.transactionHash) {
          setTransactionHash(result.transactionHash);
        }
        setTimeout(() => {
          setShowConfirmModal(false);
          setPendingTransaction(null);
          setTransactionHash(null);
        }, 3000);
      } else {
        showErrorToast('Transaction Failed', result.error || 'Transaction failed');
      }
    } catch (error: any) {
      showErrorToast('Transaction Failed', error.message || 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingTransaction, buy, sell, isSubmitting, showErrorToast]);

  const handleLimitOrder = useCallback(() => {
    // TODO: Implement limit order submission
    showErrorToast('Not Implemented', 'Limit orders will be available soon');
  }, [showErrorToast]);

  if (!marketId) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={ShoppingCart}
          title="No market selected"
          description="Select a market to place orders"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('market')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'market'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setActiveTab('limit')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'limit'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'advanced'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Settings Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSlippageSettings(true)}
            className="px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
            title="Slippage settings"
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Slippage: {settings.slippageTolerance}%</span>
          </button>
          <button
            onClick={() => setShowGasSettings(true)}
            className="px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
            title="Gas settings"
          >
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground capitalize">{settings.gasPriority}</span>
          </button>
          <button
            onClick={() => setShowAllowanceManager(true)}
            className="px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
            title="Manage USDC allowance"
          >
            <Shield className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Allowance</span>
          </button>
        </div>
      </div>

      {/* Account Overview */}
      <div className="flex-shrink-0 border-b border-border p-2 bg-background/50">
        <div className="text-xs font-semibold mb-1">Account Overview</div>
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trading Equity:</span>
            <span className="font-mono font-medium">
              {isLoadingBalance ? (
                <Loader2 className="h-3 w-3 animate-spin inline" />
              ) : (
                `$${tradingEquity.toFixed(2)}`
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Unrealized PnL:</span>
            <span className={`font-mono font-medium ${
              totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        <RiskWarning variant="inline" dismissible={true} />

        {activeTab === 'market' && (
          <div className="space-y-2">
            {/* Market Display */}
            {market && (
              <div className="flex items-center gap-2 px-1.5 py-1.5 bg-background/30 rounded border border-border/50">
                {market.imageUrl && !imageErrors.has(market.id) && (
                  <div className="flex-shrink-0 w-5 h-5 overflow-hidden border border-border bg-accent/20 rounded">
                    <img
                      src={market.imageUrl}
                      alt={market.question || 'Market'}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set([...prev, market.id]));
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-foreground truncate leading-tight">
                    {market.question || 'Market'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Outcome Selection */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Outcome</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={orderOutcome === 'YES' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    orderOutcome === 'YES'
                      ? 'bg-blue-500 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setOrderOutcome('YES')}
                >
                  YES
                </Button>
                <Button
                  size="sm"
                  variant={orderOutcome === 'NO' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    orderOutcome === 'NO'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setOrderOutcome('NO')}
                >
                  NO
                </Button>
              </div>
            </div>

            {/* Market Price */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Market Price ({orderOutcome})</div>
              <div className="text-base font-mono">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : market?.outcomePrices ? (
                  `$${(Math.floor((orderOutcome === 'YES' ? market.outcomePrices.YES : market.outcomePrices.NO) * 10000) / 10000).toFixed(4)}`
                ) : (
                  `$${currentProbability.toFixed(2)}`
                )}
              </div>
            </div>

            {/* Buy/Sell Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={orderSide === 'buy' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  orderSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-600/90 text-white'
                    : 'bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400'
                }`}
                onClick={() => setOrderSide('buy')}
              >
                Buy {orderOutcome}
              </Button>
              <Button
                size="sm"
                variant={orderSide === 'sell' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  orderSide === 'sell'
                    ? 'bg-red-600 hover:bg-red-600/90 text-white'
                    : 'bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400'
                }`}
                onClick={() => setOrderSide('sell')}
              >
                Sell {orderOutcome}
              </Button>
            </div>

            {/* Content below Buy/Sell buttons - greyed out when no shares to sell */}
            <div className="relative">
              {/* Grey out overlay when no shares available to sell */}
              {!hasSharesToSell && orderSide === 'sell' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded">
                  <div className="text-center p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      No shares detected
                    </div>
                    <div className="text-xs text-muted-foreground">
                      You don't have any {orderOutcome} shares for this market to sell
                    </div>
                  </div>
                </div>
              )}

              <div className={`space-y-2 ${!hasSharesToSell && orderSide === 'sell' ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Account Balances */}
                <div className="space-y-1 p-1.5 bg-background/50 rounded border border-border">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Available to Trade:</span>
                    <span className="font-mono">
                      {isLoadingBalance ? (
                        <Loader2 className="h-3 w-3 animate-spin inline" />
                      ) : (
                        `$${parseFloat(usdcBalance).toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Position:</span>
                    <span className={`font-mono ${totalCurrentValue > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {totalCurrentValue.toFixed(5)}
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <Label className="text-xs">Amount</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.0"
                      value={orderAmount}
                      onChange={(e) => setOrderAmount(e.target.value)}
                      className="flex-1"
                    />
                    <div className="text-xs text-muted-foreground flex items-center px-2">
                      USD
                    </div>
                  </div>
                  {/* Slider placeholder - can be implemented later */}
                </div>

                {/* Order Options */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="tp-sl"
                      checked={enableTP || enableSL}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          // When checked, enable both by default
                          setEnableTP(true);
                          setEnableSL(true);
                        } else {
                          setEnableTP(false);
                          setEnableSL(false);
                        }
                      }}
                    />
                    <Label htmlFor="tp-sl" className="text-xs cursor-pointer">
                      Take Profit / Stop Loss
                    </Label>
                  </div>
                </div>

                {/* TP/SL Settings */}
                {(enableTP || enableSL) && (
                  <div className="space-y-1.5 p-1.5 bg-background/50 rounded border border-border">
                    {enableTP && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="enable-tp"
                            checked={enableTP}
                            onCheckedChange={(checked) => setEnableTP(checked === true)}
                          />
                          <Label htmlFor="enable-tp" className="text-xs font-semibold text-green-400">
                            Take Profit
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">TP Price</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              placeholder="0.0"
                              value={tpPrice}
                              onChange={(e) => {
                                setTpPrice(e.target.value);
                                setLastEditedTP('price');
                              }}
                              className="mt-1 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Gain</Label>
                            <div className="flex gap-1 mt-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={tpGain}
                                onChange={(e) => {
                                  setTpGain(e.target.value);
                                  setLastEditedTP('gain');
                                }}
                                className="flex-1 text-xs"
                              />
                              <div className="text-xs text-muted-foreground flex items-center px-1">
                                %
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {enableSL && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="enable-sl"
                            checked={enableSL}
                            onCheckedChange={(checked) => setEnableSL(checked === true)}
                          />
                          <Label htmlFor="enable-sl" className="text-xs font-semibold text-red-400">
                            Stop Loss
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">SL Price</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              placeholder="0.0"
                              value={slPrice}
                              onChange={(e) => {
                                setSlPrice(e.target.value);
                                setLastEditedSL('price');
                              }}
                              className="mt-1 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Loss</Label>
                            <div className="flex gap-1 mt-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={slLoss}
                                onChange={(e) => {
                                  setSlLoss(e.target.value);
                                  setLastEditedSL('loss');
                                }}
                                className="flex-1 text-xs"
                              />
                              <div className="text-xs text-muted-foreground flex items-center px-1">
                                %
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Button */}
                <Button
                  size="sm"
                  className={`w-full rounded-none ${
                    orderSide === 'buy'
                      ? 'bg-green-600 hover:bg-green-600/90 text-white'
                      : 'bg-red-600 hover:bg-red-600/90 text-white'
                  }`}
                  onClick={() => {
                    const amount = parseFloat(orderAmount);
                    if (amount > 0) {
                      handleMarketOrder(amount, orderSide);
                    }
                  }}
                  disabled={!orderAmount || parseFloat(orderAmount) <= 0 || isSubmitting}
                >
                  {orderSide === 'buy' ? 'Enter Amount' : 'Enter Amount'}
                </Button>

                {/* Order Info */}
                <div className="space-y-0.5 p-1.5 bg-background/50 rounded border border-border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Size:</span>
                    <span className="font-mono">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Price:</span>
                    <span className="font-mono">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slippage:</span>
                    <span className="font-mono">Est: 0.00% | Max: {settings.slippageTolerance}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'limit' && (
          <div className="space-y-2">
            {/* Market Display */}
            {market && (
              <div className="flex items-center gap-2 px-1.5 py-1.5 bg-background/30 rounded border border-border/50">
                {market.imageUrl && !imageErrors.has(market.id) && (
                  <div className="flex-shrink-0 w-5 h-5 overflow-hidden border border-border bg-accent/20 rounded">
                    <img
                      src={market.imageUrl}
                      alt={market.question || 'Market'}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set([...prev, market.id]));
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-foreground truncate leading-tight">
                    {market.question || 'Market'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Outcome Selection */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Outcome</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={limitOutcome === 'YES' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    limitOutcome === 'YES'
                      ? 'bg-blue-500 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setLimitOutcome('YES')}
                >
                  YES
                </Button>
                <Button
                  size="sm"
                  variant={limitOutcome === 'NO' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    limitOutcome === 'NO'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setLimitOutcome('NO')}
                >
                  NO
                </Button>
              </div>
            </div>

            {/* Market Price */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Market Price ({limitOutcome})</div>
              <div className="text-base font-mono">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : market?.outcomePrices ? (
                  `$${(Math.floor((limitOutcome === 'YES' ? market.outcomePrices.YES : market.outcomePrices.NO) * 10000) / 10000).toFixed(4)}`
                ) : (
                  `$${currentProbability.toFixed(2)}`
                )}
              </div>
            </div>

            {/* Buy/Sell Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={limitSide === 'buy' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  limitSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-600/90 text-white'
                    : 'bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400'
                }`}
                onClick={() => setLimitSide('buy')}
              >
                Buy {limitOutcome}
              </Button>
              <Button
                size="sm"
                variant={limitSide === 'sell' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  limitSide === 'sell'
                    ? 'bg-red-600 hover:bg-red-600/90 text-white'
                    : 'bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400'
                }`}
                onClick={() => setLimitSide('sell')}
              >
                Sell {limitOutcome}
              </Button>
            </div>

            {/* Content below Buy/Sell buttons - greyed out when no shares to sell */}
            <div className="relative">
              {/* Grey out overlay when no shares available to sell */}
              {!hasSharesToSellLimit && limitSide === 'sell' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded">
                  <div className="text-center p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      No shares detected
                    </div>
                    <div className="text-xs text-muted-foreground">
                      You don't have any {limitOutcome} shares for this market to sell
                    </div>
                  </div>
                </div>
              )}

              <div className={`space-y-2 ${!hasSharesToSellLimit && limitSide === 'sell' ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Account Balances */}
                <div className="space-y-1 p-1.5 bg-background/50 rounded border border-border">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Available to Trade:</span>
                    <span className="font-mono">
                      {isLoadingBalance ? (
                        <Loader2 className="h-3 w-3 animate-spin inline" />
                      ) : (
                        `$${parseFloat(usdcBalance).toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Position:</span>
                    <span className={`font-mono ${totalCurrentValue > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {totalCurrentValue.toFixed(5)}
                    </span>
                  </div>
                </div>

                {/* Price Input */}
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="0.0"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Amount Input */}
                <div>
                  <Label className="text-xs">Amount</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.0"
                      value={limitAmount}
                      onChange={(e) => setLimitAmount(e.target.value)}
                      className="flex-1"
                    />
                    <div className="text-xs text-muted-foreground flex items-center px-2">
                      USD
                    </div>
                  </div>
                </div>

                {/* Order Options */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="limit-tp-sl"
                      checked={enableTP || enableSL}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEnableTP(true);
                          setEnableSL(true);
                        } else {
                          setEnableTP(false);
                          setEnableSL(false);
                        }
                      }}
                    />
                    <Label htmlFor="limit-tp-sl" className="text-xs cursor-pointer">
                      Take Profit / Stop Loss
                    </Label>
                  </div>
                </div>

                {/* TP/SL Settings */}
                {(enableTP || enableSL) && (
                  <div className="space-y-1.5 p-1.5 bg-background/50 rounded border border-border">
                    {enableTP && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="limit-enable-tp"
                            checked={enableTP}
                            onCheckedChange={(checked) => setEnableTP(checked === true)}
                          />
                          <Label htmlFor="limit-enable-tp" className="text-xs font-semibold text-green-400">
                            Take Profit
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">TP Price</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              placeholder="0.0"
                              value={tpPrice}
                              onChange={(e) => {
                                setTpPrice(e.target.value);
                                setLastEditedTP('price');
                              }}
                              className="mt-1 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Gain</Label>
                            <div className="flex gap-1 mt-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={tpGain}
                                onChange={(e) => {
                                  setTpGain(e.target.value);
                                  setLastEditedTP('gain');
                                }}
                                className="flex-1 text-xs"
                              />
                              <div className="text-xs text-muted-foreground flex items-center px-1">
                                %
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {enableSL && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="limit-enable-sl"
                            checked={enableSL}
                            onCheckedChange={(checked) => setEnableSL(checked === true)}
                          />
                          <Label htmlFor="limit-enable-sl" className="text-xs font-semibold text-red-400">
                            Stop Loss
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">SL Price</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              placeholder="0.0"
                              value={slPrice}
                              onChange={(e) => {
                                setSlPrice(e.target.value);
                                setLastEditedSL('price');
                              }}
                              className="mt-1 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Loss</Label>
                            <div className="flex gap-1 mt-1">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={slLoss}
                                onChange={(e) => {
                                  setSlLoss(e.target.value);
                                  setLastEditedSL('loss');
                                }}
                                className="flex-1 text-xs"
                              />
                              <div className="text-xs text-muted-foreground flex items-center px-1">
                                %
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Button */}
                <Button
                  size="sm"
                  className={`w-full rounded-none ${
                    limitSide === 'buy'
                      ? 'bg-green-600 hover:bg-green-600/90 text-white'
                      : 'bg-red-600 hover:bg-red-600/90 text-white'
                  }`}
                  onClick={handleLimitOrder}
                  disabled={!limitPrice || !limitAmount || isSubmitting}
                >
                  Place Limit Order
                </Button>

                {/* Order Info */}
                <div className="space-y-0.5 p-1.5 bg-background/50 rounded border border-border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Size:</span>
                    <span className="font-mono">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Limit Price:</span>
                    <span className="font-mono">{limitPrice || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slippage:</span>
                    <span className="font-mono">N/A (Limit Order)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-2">
            {/* Market Display */}
            {market && (
              <div className="flex items-center gap-2 px-1.5 py-1.5 bg-background/30 rounded border border-border/50">
                {market.imageUrl && !imageErrors.has(market.id) && (
                  <div className="flex-shrink-0 w-5 h-5 overflow-hidden border border-border bg-accent/20 rounded">
                    <img
                      src={market.imageUrl}
                      alt={market.question || 'Market'}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set([...prev, market.id]));
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-foreground truncate leading-tight">
                    {market.question || 'Market'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Outcome Selection */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Outcome</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={orderOutcome === 'YES' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    orderOutcome === 'YES'
                      ? 'bg-blue-500 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setOrderOutcome('YES')}
                >
                  YES
                </Button>
                <Button
                  size="sm"
                  variant={orderOutcome === 'NO' ? 'default' : 'outline'}
                  className={`text-xs flex-1 rounded-none ${
                    orderOutcome === 'NO'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-background/50 text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                  onClick={() => setOrderOutcome('NO')}
                >
                  NO
                </Button>
              </div>
            </div>

            {/* Market Price */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Market Price ({orderOutcome})</div>
              <div className="text-base font-mono">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : market?.outcomePrices ? (
                  `$${(Math.floor((orderOutcome === 'YES' ? market.outcomePrices.YES : market.outcomePrices.NO) * 10000) / 10000).toFixed(4)}`
                ) : (
                  `$${currentProbability.toFixed(2)}`
                )}
              </div>
            </div>

            {/* Buy/Sell Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={orderSide === 'buy' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  orderSide === 'buy'
                    ? 'bg-green-600 hover:bg-green-600/90 text-white'
                    : 'bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400'
                }`}
                onClick={() => setOrderSide('buy')}
              >
                Buy {orderOutcome}
              </Button>
              <Button
                size="sm"
                variant={orderSide === 'sell' ? 'default' : 'outline'}
                className={`text-xs flex-1 rounded-none ${
                  orderSide === 'sell'
                    ? 'bg-red-600 hover:bg-red-600/90 text-white'
                    : 'bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400'
                }`}
                onClick={() => setOrderSide('sell')}
              >
                Sell {orderOutcome}
              </Button>
            </div>

            {/* Content below Buy/Sell buttons - greyed out when no shares to sell */}
            <div className="relative">
              {/* Grey out overlay when no shares available to sell */}
              {!hasSharesToSell && orderSide === 'sell' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded">
                  <div className="text-center p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      No shares detected
                    </div>
                    <div className="text-xs text-muted-foreground">
                      You don't have any {orderOutcome} shares for this market to sell
                    </div>
                  </div>
                </div>
              )}

              <div className={`space-y-2 ${!hasSharesToSell && orderSide === 'sell' ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Account Balances */}
                <div className="space-y-1 p-1.5 bg-background/50 rounded border border-border">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Available to Trade:</span>
                    <span className="font-mono">
                      {isLoadingBalance ? (
                        <Loader2 className="h-3 w-3 animate-spin inline" />
                      ) : (
                        `$${parseFloat(usdcBalance).toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Position:</span>
                    <span className={`font-mono ${totalCurrentValue > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {totalCurrentValue.toFixed(5)}
                    </span>
                  </div>
                </div>

                {/* Coming Soon Message */}
                <div className="space-y-1 p-1.5 bg-background/50 rounded border border-border text-xs text-center py-4">
                  <div className="font-medium mb-1 text-foreground">Advanced Orders</div>
                  <div className="text-muted-foreground">TWAP and other advanced order types coming soon</div>
                </div>

                {/* Order Info */}
                <div className="space-y-0.5 p-1.5 bg-background/50 rounded border border-border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Type:</span>
                    <span className="font-mono">Advanced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-mono text-muted-foreground">Not Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <GasSettingsDialog
        open={showGasSettings}
        onOpenChange={setShowGasSettings}
        currentPriority={settings.gasPriority}
        onSave={setGasPriority}
      />

      <SlippageSettingsDialog
        open={showSlippageSettings}
        onOpenChange={setShowSlippageSettings}
        currentTolerance={settings.slippageTolerance}
        onSave={setSlippageTolerance}
      />

      <AllowanceManager
        open={showAllowanceManager}
        onOpenChange={setShowAllowanceManager}
      />

      {pendingTransaction && (
        <TransactionConfirmModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          transaction={pendingTransaction}
          onConfirm={executeTransaction}
          onCancel={() => {
            setPendingTransaction(null);
            setShowConfirmModal(false);
            setTransactionHash(null);
          }}
          transactionHash={transactionHash}
        />
      )}
    </div>
  );
}

