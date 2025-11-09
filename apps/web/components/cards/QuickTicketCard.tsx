'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useMarketPrice } from '@/lib/hooks/usePolymarketData';
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';
import { useTrading } from '@/lib/hooks/useTrading';
import { usePresets } from '@/lib/hooks/usePresets';
import { parseUnits } from 'viem';
import { Loader2, Search, Settings, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketSelector } from '@/components/MarketSelector';
import { PresetsDialog } from '@/components/PresetsDialog';
import { TransactionConfirmModal, TransactionDetails } from '@/components/trading/TransactionConfirmModal';
import { GasSettingsDialog } from '@/components/trading/GasSettingsDialog';
import { SlippageSettingsDialog } from '@/components/trading/SlippageSettingsDialog';
import { AllowanceManager } from '@/components/trading/AllowanceManager';
import { useTradingSettingsStore } from '@/stores/trading-settings-store';
import { calculateMinOutcomeTokens } from '@/lib/web3/slippage-utils';
import { getGasSettings } from '@/lib/web3/gas-utils';
import { simulateTrade } from '@/lib/web3/trade-simulation';
import { Zap, Settings2, Play, Shield } from 'lucide-react';
import { RiskWarning } from '@/components/ui/RiskWarning';
import { useToast } from '@/components/Toast';

function QuickTicketCardComponent() {
  const { selectedMarketId, getMarket } = useMarketStore();
  const { data: price, isLoading } = useMarketPrice(selectedMarketId);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  // Subscribe to real-time price updates for instant updates
  useRealtimePrice(selectedMarketId || null, 'YES');
  const [showPresetsDialog, setShowPresetsDialog] = useState(false);
  const [showGasSettings, setShowGasSettings] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [showAllowanceManager, setShowAllowanceManager] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<TransactionDetails | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Hooks must be called unconditionally - before any early returns
  const { buy, sell } = useTrading();
  const { presets, savePresets } = usePresets();
  const { settings, setSlippageTolerance, setGasPriority } = useTradingSettingsStore();
  const { error: showErrorToast, warning: showWarningToast } = useToast();

  // Memoize handlers to prevent unnecessary re-renders - must be defined before early returns
  const handleShowMarketSelector = useCallback(() => {
    setShowMarketSelector(true);
  }, []);
  
  const handleCloseMarketSelector = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);

  // Memoize current probability calculation - must be before early returns
  const currentProbability = useMemo(() => {
    return price && typeof price === 'object' && 'probability' in price 
      ? (price as { probability: number }).probability 
      : 0;
  }, [price]);

  // Memoize presets dialog handlers - MUST be before early returns
  const handleShowPresetsDialog = useCallback(() => {
    setShowPresetsDialog(true);
  }, []);
  
  const handleClosePresetsDialog = useCallback((open: boolean) => {
    setShowPresetsDialog(open);
  }, []);

  // Simulate trade - MUST be before early returns
  const handleSimulate = useCallback(async (amount: number, type: 'buy' | 'sell') => {
    if (!selectedMarketId || isSimulating) return;
    
    setIsSimulating(true);
    setSimulationResult(null);
    
    try {
      const usdcAmount = parseUnits(amount.toFixed(6), 6);
      const result = await simulateTrade({
        marketId: selectedMarketId,
        outcome: 'YES',
        amount: usdcAmount,
      }, currentProbability / 100);
      
      setSimulationResult(result);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  }, [selectedMarketId, currentProbability, isSimulating]);

  // Quick buy handler - MUST be before early returns
  const handleQuickBuy = useCallback(async (amount: number) => {
    if (!selectedMarketId || isSubmitting) return;
    
    console.log('[QuickTicketCard] handleQuickBuy called with amount:', amount, 'from preset:', presets.buyPreset);
    const usdcAmount = parseUnits(amount.toFixed(6), 6);
    const transaction: TransactionDetails = {
      type: 'buy',
      marketId: selectedMarketId,
      outcome: 'YES',
      amount: usdcAmount,
      amountDisplay: amount,
      currentPrice: currentProbability / 100,
    };
    
    console.log('[QuickTicketCard] Created transaction:', { amount, amountDisplay: transaction.amountDisplay, usdcAmount: usdcAmount.toString() });
    setPendingTransaction(transaction);
    setShowConfirmModal(true);
  }, [selectedMarketId, currentProbability, isSubmitting, presets.buyPreset]);

  // Execute buy after confirmation - MUST be before early returns
  const executeBuy = useCallback(async () => {
    if (!pendingTransaction || isSubmitting) return;
    
    setIsSubmitting(true);
    setLastResult(null);
    
    try {
      const result = await buy({
        marketId: pendingTransaction.marketId,
        outcome: pendingTransaction.outcome,
        amount: pendingTransaction.amount,
      });
      
      if (result.success) {
        setLastResult(`✅ Bought $${pendingTransaction.amountDisplay} at ${(currentProbability as number).toFixed(1)}%`);
        setTimeout(() => setLastResult(null), 5000);
        // Store transaction hash for modal display
        if (result.transactionHash) {
          setTransactionHash(result.transactionHash);
        }
        // Don't close modal immediately - let it show success
        setTimeout(() => {
          setShowConfirmModal(false);
          setPendingTransaction(null);
          setTransactionHash(null);
        }, 3000);
      } else {
        const errorMessage = result.error || 'Transaction failed';
        // Show toast notification for balance errors
        if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
          showErrorToast('Insufficient Balance', errorMessage);
        } else {
          showErrorToast('Transaction Failed', errorMessage);
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setLastResult(`❌ Error: ${errorMessage}`);
      setTimeout(() => setLastResult(null), 5000);
      // Show toast notification for balance errors
      if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
        showErrorToast('Insufficient Balance', errorMessage);
      }
      throw error; // Re-throw to let modal handle it
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingTransaction, buy, currentProbability, isSubmitting, showErrorToast]);

  // Quick sell handler - MUST be before early returns
  const handleQuickSell = useCallback(async (percentage: number) => {
    if (!selectedMarketId || isSubmitting) return;
    
    // Calculate amount from percentage
    // For now, use a simplified calculation based on current position value
    // TODO: Get actual position size from user's portfolio
    const bankroll = 1000; // TODO: Get actual bankroll/position value
    const amount = (percentage / 100) * bankroll;
    const usdcAmount = parseUnits(amount.toFixed(6), 6);
    
    const transaction: TransactionDetails = {
      type: 'sell',
      marketId: selectedMarketId,
      outcome: 'YES',
      amount: usdcAmount,
      amountDisplay: amount,
      currentPrice: currentProbability / 100,
    };
    
    setPendingTransaction(transaction);
    setShowConfirmModal(true);
  }, [selectedMarketId, currentProbability, isSubmitting]);

  // Execute sell after confirmation - MUST be before early returns
  const executeSell = useCallback(async () => {
    if (!pendingTransaction || isSubmitting) return;
    
    setIsSubmitting(true);
    setLastResult(null);
    
    try {
      const result = await sell({
        marketId: pendingTransaction.marketId,
        outcome: pendingTransaction.outcome,
        amount: pendingTransaction.amount,
      });
      
      if (result.success) {
        setLastResult(`✅ Sold $${pendingTransaction.amountDisplay} at ${(currentProbability as number).toFixed(1)}%`);
        setTimeout(() => setLastResult(null), 5000);
        // Store transaction hash for modal display
        if (result.transactionHash) {
          setTransactionHash(result.transactionHash);
        }
        // Don't close modal immediately - let it show success
        setTimeout(() => {
          setShowConfirmModal(false);
          setPendingTransaction(null);
          setTransactionHash(null);
        }, 3000);
      } else {
        const errorMessage = result.error || 'Transaction failed';
        // Show toast notification for balance errors
        if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
          showErrorToast('Insufficient Balance', errorMessage);
        } else {
          showErrorToast('Transaction Failed', errorMessage);
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setLastResult(`❌ Error: ${errorMessage}`);
      setTimeout(() => setLastResult(null), 5000);
      // Show toast notification for balance errors
      if (errorMessage.includes('Insufficient') || errorMessage.includes('balance')) {
        showErrorToast('Insufficient Balance', errorMessage);
      }
      throw error; // Re-throw to let modal handle it
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingTransaction, sell, currentProbability, isSubmitting, showErrorToast]);

  if (!selectedMarketId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
          <div className="text-muted-foreground text-sm mb-2">
            Select a market for quick trading
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

  const market = getMarket(selectedMarketId);

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
        <div className="flex flex-col space-y-4 flex-1 min-h-0">
          {/* Risk Warning */}
          <RiskWarning variant="inline" dismissible={true} className="flex-shrink-0" />
          
          {/* Trading Settings */}
          <div className="flex items-center justify-between text-xs flex-shrink-0 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSlippageSettings(true)}
                className="px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
                title="Slippage settings"
              >
                <Settings2 className="h-3 w-3 text-muted-foreground" />
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
            <button
              onClick={handleShowPresetsDialog}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Edit presets"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Quick Buy Section */}
          <div className="space-y-2 flex-shrink-0">
            <div className="text-xs font-semibold text-green-400">Quick Buy</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-green-600/10 hover:bg-green-600/20 border-green-600/50 text-green-400 disabled:opacity-50 flex-1"
                onClick={() => {
                  console.log('[QuickTicketCard] Buy preset clicked:', { preset: presets.buyPreset });
                  handleQuickBuy(presets.buyPreset);
                }}
                disabled={isSubmitting}
              >
                ${presets.buyPreset}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs p-0"
                onClick={() => handleSimulate(presets.buyPreset, 'buy')}
                disabled={isSimulating}
                title="Simulate trade"
              >
                <Play className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Quick Sell Section */}
          <div className="space-y-2 flex-shrink-0">
            <div className="text-xs font-semibold text-red-400">Quick Sell</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400 disabled:opacity-50 flex-1"
                onClick={() => handleQuickSell(presets.sellPreset)}
                disabled={isSubmitting}
              >
                {presets.sellPreset}%
              </Button>
            </div>
          </div>

          {/* Simulation Result */}
          {simulationResult && (
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs flex-shrink-0">
              <div className="font-medium text-blue-400 mb-1">Simulation Results</div>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Est. Outcome Tokens:</span>
                  <span className="font-mono">{simulationResult.estimatedOutcomeTokens?.toString() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Slippage:</span>
                  <span className="font-mono">{simulationResult.estimatedSlippage?.toFixed(2) || '0'}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Gas:</span>
                  <span className="font-mono">{simulationResult.estimatedGas?.toString() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Price:</span>
                  <span className="font-mono">{((simulationResult.estimatedPrice ?? 0) * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Result Message */}
          {lastResult && (
            <div
              className={`flex items-center gap-2 text-xs p-2 rounded flex-shrink-0 ${
                lastResult.includes('✅')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {lastResult.includes('✅') ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{lastResult.replace('✅', '').replace('❌', '').trim()}</span>
            </div>
          )}

          {/* Loading State */}
          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground p-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing transaction...
            </div>
          )}
        </div>
      )}

      {/* Presets Dialog */}
      <PresetsDialog
        open={showPresetsDialog}
        onOpenChange={handleClosePresetsDialog}
        buyPreset={presets.buyPreset}
        sellPreset={presets.sellPreset}
        slippagePreset={presets.slippagePreset}
        onSave={savePresets}
      />

      {/* Gas Settings Dialog */}
      <GasSettingsDialog
        open={showGasSettings}
        onOpenChange={setShowGasSettings}
        currentPriority={settings.gasPriority}
        onSave={setGasPriority}
      />

      {/* Slippage Settings Dialog */}
      <SlippageSettingsDialog
        open={showSlippageSettings}
        onOpenChange={setShowSlippageSettings}
        currentTolerance={settings.slippageTolerance}
        onSave={setSlippageTolerance}
      />

      {/* Allowance Manager Dialog */}
      <AllowanceManager
        open={showAllowanceManager}
        onOpenChange={setShowAllowanceManager}
      />

      {/* Transaction Confirmation Modal */}
      {pendingTransaction && (
        <TransactionConfirmModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          transaction={pendingTransaction}
          onConfirm={pendingTransaction.type === 'buy' ? executeBuy : executeSell}
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

// Memoize component to prevent unnecessary re-renders
export const QuickTicketCard = React.memo(QuickTicketCardComponent);
