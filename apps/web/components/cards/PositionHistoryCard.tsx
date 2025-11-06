'use client';

import React, { useState } from 'react';
import { usePositionHistory, PositionHistoryEntry } from '@/lib/hooks/usePositionHistory';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Address } from 'viem';
import { Loader2, ExternalLink, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';

function PositionHistoryCardComponent() {
  const { user } = usePrivy();
  const { dbUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  const walletAddress = (user?.wallet?.address as Address | undefined) ||
    (dbUser?.walletAddress as Address | undefined);

  const { data, isLoading, error } = usePositionHistory({
    limit,
    offset: page * limit,
  });

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  if (!walletAddress) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          <p>Connect your wallet to view position history</p>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-destructive">
          <p>Failed to load position history</p>
          <p className="text-xs text-muted-foreground mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const history = data?.history || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter((entry) => entry.status === filter);

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold">Position History</h3>
        <div className="flex gap-1">
          {(['all', 'open', 'closed'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className="text-xs h-6 px-2 capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-sm text-muted-foreground">
              <p>No position history</p>
              <p className="text-xs mt-1">Position history will appear here</p>
            </div>
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium capitalize ${entry.outcome === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.outcome}
                    </span>
                    <span className={`text-xs ${entry.status === 'open' ? 'text-blue-400' : 'text-muted-foreground'}`}>
                      {entry.status === 'open' ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Open
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Closed
                        </span>
                      )}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Entry: {formatDate(entry.entryTimestamp)} @ {(entry.entryPrice * 100).toFixed(1)}%</div>
                    {entry.exitTimestamp && (
                      <div>Exit: {formatDate(entry.exitTimestamp)} @ {(entry.exitPrice! * 100).toFixed(1)}%</div>
                    )}
                    {entry.duration && (
                      <div>Duration: {formatDuration(entry.duration)}</div>
                    )}
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  {entry.pnl !== undefined && (
                    <div className={`text-xs font-mono flex items-center gap-1 ${
                      entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {entry.pnl >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      ${entry.pnl.toFixed(2)}
                      {entry.pnlPercentage !== undefined && (
                        <span className="text-muted-foreground">
                          ({entry.pnlPercentage >= 0 ? '+' : ''}{entry.pnlPercentage.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {formatUnits(entry.entryAmount, 6)} @ entry
                  </div>
                  {entry.exitAmount && (
                    <div className="text-[10px] text-muted-foreground">
                      {formatUnits(entry.exitAmount, 6)} @ exit
                    </div>
                  )}
                </div>
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

export default PositionHistoryCardComponent;

