'use client';

import React, { useState } from 'react';
import { useOrders, useCancelOrder, Order } from '@/lib/hooks/useOrders';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAllOrderStatusUpdates } from '@/lib/hooks/useOrderStatusUpdates';
import { Address } from 'viem';
import { Loader2, ExternalLink, X, CheckCircle2, XCircle, Clock, AlertCircle, ShoppingCart } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/Toast';

function OrderHistoryCardComponent() {
  const { user } = usePrivy();
  const { dbUser } = useAuth();
  const { success, error: showError } = useToast();
  const [filter, setFilter] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Get wallet address
  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  // Subscribe to real-time order status updates
  useAllOrderStatusUpdates(walletAddress || null);

  const { data, isLoading, error } = useOrders({
    status: filter === 'all' ? 'all' : filter,
    limit,
    offset: page * limit,
  });

  const cancelOrderMutation = useCancelOrder();

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
        return <Clock className="h-4 w-4 text-blue-400" />;
      case 'filled':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'partially_filled':
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'open':
        return 'text-blue-400';
      case 'filled':
        return 'text-green-400';
      case 'cancelled':
        return 'text-red-400';
      case 'partially_filled':
        return 'text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrderMutation.mutateAsync(orderId);
      success('Order cancelled', 'Order has been cancelled successfully.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel order';
      showError('Failed to cancel order', errorMessage);
    }
  };

  if (!walletAddress) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          <p>Connect your wallet to view order history</p>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <LoadingSpinner size="md" text="Loading orders..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-destructive">
          <p>Failed to load orders</p>
          <p className="text-xs text-muted-foreground mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Order History</h3>
        <div className="flex gap-1">
          {(['all', 'open', 'filled', 'cancelled'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className="text-xs px-2 capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-auto space-y-2">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <p>No orders found</p>
              <p className="text-xs mt-1">Orders will appear here once placed</p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-2 p-3 rounded border border-border hover:bg-muted/50 transition-colors duration-200"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(order.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium capitalize ${order.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {order.side} {order.outcome}
                      </span>
                      <span className={`text-xs ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono">
                      {parseFloat(order.amount).toFixed(2)} @ {(order.price * 100).toFixed(1)}%
                    </div>
                    {order.filledAmount && (
                      <div className="text-[10px] text-muted-foreground">
                        Filled: {parseFloat(order.filledAmount).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {order.status === 'open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={cancelOrderMutation.isPending}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Cancel order"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {order.transactionHash && (
                  <a
                    href={`https://polygonscan.com/tx/${order.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="View on PolygonScan"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-7 px-2 text-xs"
          >
            Previous
          </Button>
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-7 px-2 text-xs"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default OrderHistoryCardComponent;

