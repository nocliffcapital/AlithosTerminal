'use client';

import React, { useState } from 'react';
import { useTransactions, Transaction } from '@/lib/hooks/useTransactions';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Address } from 'viem';
import { Loader2, ExternalLink, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatUnits } from 'viem';
import { USDC_ADDRESS } from '@/lib/web3/polymarket-contracts';

function TransactionHistoryCardComponent() {
  const { user } = usePrivy();
  const { dbUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'trade' | 'deposit' | 'withdraw'>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Get wallet address
  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  const { data, isLoading, error } = useTransactions({
    walletAddress,
    limit,
    offset: page * limit,
    type: filter === 'all' ? 'all' : filter,
  });

  const formatValue = (value: string | undefined, decimals: number = 18) => {
    if (!value) return '0.00';
    try {
      const num = parseFloat(formatUnits(BigInt(value), decimals));
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return '0.00';
    }
  };

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

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="h-4 w-4 text-green-400" />;
      case 'withdraw':
        return <ArrowUpCircle className="h-4 w-4 text-red-400" />;
      case 'trade':
        return <ArrowRightLeft className="h-4 w-4 text-blue-400" />;
      default:
        return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionTypeLabel = (tx: Transaction) => {
    if (tx.type === 'trade') return 'Trade';
    if (tx.type === 'deposit') return 'Deposit';
    if (tx.type === 'withdraw') return 'Withdraw';
    // Infer type from transaction data
    if (tx.token?.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
      if (tx.to?.toLowerCase() === walletAddress?.toLowerCase()) return 'Deposit';
      if (tx.from?.toLowerCase() === walletAddress?.toLowerCase()) return 'Withdraw';
    }
    return 'Transaction';
  };

  if (!walletAddress) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          <p>Connect your wallet to view transaction history</p>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <LoadingSpinner size="md" text="Loading transactions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-destructive">
          <p>Failed to load transactions</p>
          <p className="text-xs text-muted-foreground mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Transaction History</h3>
        <div className="flex gap-1">
          {(['all', 'trade', 'deposit', 'withdraw'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className="text-xs px-2"
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-auto space-y-2">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <p>No transactions found</p>
            </div>
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-2 p-3 rounded border border-border hover:bg-muted/50 transition-colors duration-200"
            >
              <div className="flex-shrink-0">
                {getTransactionIcon(tx.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {getTransactionTypeLabel(tx)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(tx.timestamp)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
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
              </div>
              <div className="flex-shrink-0">
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="View on PolygonScan"
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
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
            <ChevronLeft className="h-3 w-3 mr-1" />
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
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default TransactionHistoryCardComponent;

