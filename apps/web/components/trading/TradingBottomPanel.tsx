'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { usePositions, useTotalPnL, PositionWithPnL } from '@/lib/hooks/usePositions';
import { useOrders, Order } from '@/lib/hooks/useOrders';
import { useTransactions, Transaction } from '@/lib/hooks/useTransactions';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAllOrderStatusUpdates } from '@/lib/hooks/useOrderStatusUpdates';
import { Address } from 'viem';
import { Loader2, Wallet, ShoppingCart, History, TrendingUp, TrendingDown, ExternalLink, X, CheckCircle2, XCircle, Clock, AlertCircle, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/Toast';
import { formatUnits } from 'viem';
import { parseUnits } from 'viem';
import { useTrading } from '@/lib/hooks/useTrading';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { USDC_ADDRESS } from '@/lib/web3/polymarket-contracts';

export function TradingBottomPanel() {
  const { user } = usePrivy();
  const { dbUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'positions' | 'open-orders' | 'order-history' | 'trade-history'>('positions');
  
  // Get wallet address
  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  // Subscribe to real-time order status updates
  useAllOrderStatusUpdates(walletAddress || null);

  // Positions data
  const { data: positions, isLoading: isLoadingPositions } = usePositions(true);
  const { totalCostBasis, totalCurrentValue, totalUnrealizedPnL, totalRealizedPnL, totalPnL, positionCount } = useTotalPnL();

  // Orders data - fetch all orders to get accurate counts
  const { data: ordersData, isLoading: isLoadingOrders } = useOrders({
    status: activeTab === 'open-orders' ? 'open' : 'all',
    limit: 50,
    offset: 0,
  });

  // Fetch all orders separately for accurate counts (only when not already fetching all)
  const { data: allOrdersData } = useOrders({
    status: 'all',
    limit: 1000,
    offset: 0,
  });

  // Transactions data
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({
    walletAddress,
    limit: 50,
    offset: 0,
    type: 'all',
  });

  const { sell } = useTrading();
  const { success: showSuccess, error: showError } = useToast();
  const [closingPosition, setClosingPosition] = useState<PositionWithPnL | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [partialCloseAmount, setPartialCloseAmount] = useState<number>(0);
  const [isPartialClose, setIsPartialClose] = useState(false);

  // Sort positions by unrealized P&L
  const sortedPositions = useMemo(() => {
    if (!positions) return [];
    return [...positions].sort((a, b) => {
      const aPnL = a.unrealizedPnL || 0;
      const bPnL = b.unrealizedPnL || 0;
      return bPnL - aPnL;
    });
  }, [positions]);

  // Filter orders
  const orders = useMemo(() => {
    if (!ordersData) return [];
    if (activeTab === 'open-orders') {
      return ordersData.orders?.filter((o: Order) => o.status === 'open') || [];
    }
    return ordersData.orders || [];
  }, [ordersData, activeTab]);

  // Get transactions
  const transactions = useMemo(() => {
    return transactionsData?.transactions || [];
  }, [transactionsData]);

  // Calculate counts for tabs
  const counts = useMemo(() => {
    // Use allOrdersData for accurate counts, fallback to ordersData if available
    const ordersForCount = allOrdersData?.orders || (activeTab !== 'open-orders' ? ordersData?.orders : []) || [];
    const openOrdersCount = ordersForCount.filter((o: Order) => o.status === 'open').length;

    return {
      positions: positionCount || 0,
      openOrders: openOrdersCount,
    };
  }, [positionCount, allOrdersData, ordersData, activeTab]);

  const handleClosePosition = useCallback((position: PositionWithPnL, e: React.MouseEvent, partial: boolean = false) => {
    e.stopPropagation();
    setClosingPosition(position);
    setIsPartialClose(partial);
    if (partial) {
      setPartialCloseAmount(position.currentValue * 0.5);
    } else {
      setPartialCloseAmount(0);
    }
    setShowCloseModal(true);
  }, []);

  const executeClosePosition = useCallback(async () => {
    if (!closingPosition || isClosing) return;

    setIsClosing(true);
    try {
      let returnAmountUSDC: bigint;
      let maxOutcomeTokens: bigint;

      if (isPartialClose && partialCloseAmount > 0) {
        const percentage = partialCloseAmount / closingPosition.currentValue;
        const partialValue = closingPosition.currentValue * percentage;
        returnAmountUSDC = parseUnits(partialValue.toFixed(6), 6);
        const positionAmount = parseFloat(closingPosition.amount);
        const tokensToSell = positionAmount * percentage;
        maxOutcomeTokens = parseUnits(tokensToSell.toFixed(18), 18);
      } else {
        returnAmountUSDC = parseUnits(closingPosition.currentValue.toFixed(6), 6);
        maxOutcomeTokens = parseUnits(closingPosition.amount, 18);
      }

      const result = await sell({
        marketId: closingPosition.marketId,
        outcome: closingPosition.outcome,
        amount: returnAmountUSDC,
        maxOutcomeTokens: maxOutcomeTokens,
      });

      if (result.success) {
        const action = isPartialClose ? 'partially closed' : 'closed';
        showSuccess('Position Closed', `Successfully ${action} position for ${closingPosition.market?.question || closingPosition.marketId}`);
        setShowCloseModal(false);
        setClosingPosition(null);
        setIsPartialClose(false);
        setPartialCloseAmount(0);
      } else {
        showError('Close Failed', result.error || 'Failed to close position');
      }
    } catch (error: any) {
      showError('Close Failed', error.message || 'Failed to close position');
    } finally {
      setIsClosing(false);
    }
  }, [closingPosition, isClosing, isPartialClose, partialCloseAmount, sell, showSuccess, showError]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'open':
        return <Clock className="h-3 w-3 text-blue-400" />;
      case 'filled':
        return <CheckCircle2 className="h-3 w-3 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3 text-red-400" />;
      case 'partially_filled':
        return <AlertCircle className="h-3 w-3 text-yellow-400" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="h-3 w-3 text-green-400" />;
      case 'withdraw':
        return <ArrowUpCircle className="h-3 w-3 text-red-400" />;
      case 'trade':
        return <ArrowRightLeft className="h-3 w-3 text-blue-400" />;
      default:
        return <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const formatValue = (value: string | undefined, decimals: number = 18) => {
    if (!value) return '0.00';
    try {
      const num = parseFloat(formatUnits(BigInt(value), decimals));
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return '0.00';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'positions'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="h-3 w-3 inline mr-1" />
          Positions
          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            activeTab === 'positions'
              ? 'bg-primary/20 text-primary'
              : 'bg-background/60 text-foreground/70 border border-border/50'
          }`}>
            {counts.positions}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('open-orders')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'open-orders'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart className="h-3 w-3 inline mr-1" />
          Open Orders
          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            activeTab === 'open-orders'
              ? 'bg-primary/20 text-primary'
              : 'bg-background/60 text-foreground/70 border border-border/50'
          }`}>
            {counts.openOrders}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('order-history')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'order-history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-3 w-3 inline mr-1" />
          Order History
        </button>
        <button
          onClick={() => setActiveTab('trade-history')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'trade-history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-3 w-3 inline mr-1" />
          Trade History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'positions' && (
          isLoadingPositions ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading positions..." />
            </div>
          ) : !positions || positions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={Wallet}
                title="No positions found"
                description="Start trading to see your positions here"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2 p-2 bg-background/50 rounded text-xs border-b border-border mb-2">
                <div>
                  <div className="text-muted-foreground">Positions</div>
                  <div className="font-mono font-medium">{positionCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Value</div>
                  <div className="font-mono font-medium">${totalCurrentValue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Cost</div>
                  <div className="font-mono font-medium">${totalCostBasis.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total P&L</div>
                  <div className={`font-mono font-medium flex items-center gap-1 ${
                    totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {totalPnL >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    ${totalPnL.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Positions List */}
              {sortedPositions.map((position) => {
                const positionKey = `${position.marketId}-${position.outcome}`;
                const unrealizedPnL = position.unrealizedPnL || 0;
                const costBasis = position.costBasis || 0;
                const unrealizedPnLPercentage = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
                
                return (
                <div
                  key={positionKey}
                  className="p-2 rounded border border-border hover:bg-background/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {position.market?.question || position.marketId}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {position.outcome} • ${position.currentValue.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className={`text-xs font-mono ${
                        unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${unrealizedPnL.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {unrealizedPnLPercentage.toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => handleClosePosition(position, e, true)}
                      >
                        Partial
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => handleClosePosition(position, e, false)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'open-orders' && (
          isLoadingOrders ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading orders..." />
            </div>
          ) : !walletAddress ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={ShoppingCart}
                title="Connect wallet"
                description="Connect your wallet to view orders"
              />
            </div>
          ) : orders.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={ShoppingCart}
                title="No open orders"
                description="Your open orders will appear here"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(order.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium capitalize ${
                        order.side === 'buy' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {order.side} {order.outcome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Price: ${order.price} • Size: {order.amount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'order-history' && (
          isLoadingOrders ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading order history..." />
            </div>
          ) : !walletAddress ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={History}
                title="Connect wallet"
                description="Connect your wallet to view order history"
              />
            </div>
          ) : orders.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={History}
                title="No order history"
                description="Your order history will appear here"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(order.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium capitalize ${
                        order.side === 'buy' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {order.side} {order.outcome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Price: ${order.price} • Size: {order.amount} • Status: {order.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'trade-history' && (
          isLoadingTransactions ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner size="sm" text="Loading trade history..." />
            </div>
          ) : !walletAddress ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={History}
                title="Connect wallet"
                description="Connect your wallet to view trade history"
              />
            </div>
          ) : transactions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={History}
                title="No trade history"
                description="Your trade history will appear here"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: Transaction) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">
                      {tx.type === 'trade' ? 'Trade' : tx.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(tx.timestamp)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    {tx.value && (
                      <div className="text-xs font-mono">
                        {formatValue(tx.value, tx.token?.toLowerCase() === USDC_ADDRESS.toLowerCase() ? 6 : 18)} USDC
                      </div>
                    )}
                    {tx.status && (
                      <div className={`text-xs ${
                        tx.status === 'confirmed' ? 'text-green-400' :
                        tx.status === 'pending' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {tx.status}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Close Position Modal */}
      {closingPosition && (
        <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isPartialClose ? 'Partially Close Position' : 'Close Position'}
              </DialogTitle>
              <DialogDescription>
                {closingPosition.market?.question || closingPosition.marketId}
              </DialogDescription>
            </DialogHeader>
            {isPartialClose && (
              <div className="space-y-2">
                <Label>Close Amount (USDC)</Label>
                <Input
                  type="number"
                  value={partialCloseAmount}
                  onChange={(e) => setPartialCloseAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseModal(false)}>
                Cancel
              </Button>
              <Button onClick={executeClosePosition} disabled={isClosing}>
                {isClosing ? 'Closing...' : isPartialClose ? 'Partially Close' : 'Close Position'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

