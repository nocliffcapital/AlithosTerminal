'use client';

import React, { useState, useMemo } from 'react';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { AlertCircle, CheckCircle2, ExternalLink, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketSelector } from '@/components/MarketSelector';

interface ResolutionCriteriaCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function ResolutionCriteriaCardComponent({ marketId: propMarketId, onMarketChange }: ResolutionCriteriaCardProps = {}) {
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const { data: market, isLoading } = useMarket(effectiveMarketId ?? null);

  // Parse resolution source and criteria (move before early returns)
  const endDate = market?.endDate ? new Date(market.endDate) : null;
  const timeUntilEnd = endDate
    ? endDate.getTime() - Date.now()
    : null;
  const isExpired = timeUntilEnd !== null && timeUntilEnd < 0;

  // Calculate resolution risk score (simplified) - must be called before early returns
  const resolutionRiskScore = useMemo(() => {
    if (!market) return 50; // Default score when no market
    
    let score = 50; // Base score

    // Check for ambiguity indicators
    if ((!market.resolutionCriteria || market.resolutionCriteria === '') && 
        (!market.resolutionSource || market.resolutionSource === '')) {
      score += 20; // No criteria or source = higher risk
    }

    if (market.endDate && timeUntilEnd !== null) {
      const daysUntil = timeUntilEnd / (1000 * 60 * 60 * 24);
      if (daysUntil < 1) {
        score += 15; // Very close deadline = higher risk
      } else if (daysUntil > 30) {
        score -= 10; // Far deadline = lower risk
      }
    }

    return Math.max(0, Math.min(100, score));
  }, [market, timeUntilEnd]);

  const handleSelect = (marketId: string) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
  };

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view resolution criteria"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
            icon: Search,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={(id) => {
            if (onMarketChange) onMarketChange(id);
            setShowMarketSelector(false);
          }}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-xs">Loading...</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Market not found
      </div>
    );
  }

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Medium Risk';
    return 'Low Risk';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-accent/20">
        <div className="text-xs font-semibold text-foreground">Resolution Intelligence</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Resolution Risk Score - Prominent */}
        <div className="border border-border bg-card p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Risk Score</span>
            <span className={`text-xs font-bold ${getRiskColor(resolutionRiskScore)}`}>
              {resolutionRiskScore}/100
            </span>
          </div>
          <div className="w-full bg-background h-1.5 mb-1.5">
            <div
              className={`h-1.5 ${
                resolutionRiskScore >= 70
                  ? 'bg-red-400'
                  : resolutionRiskScore >= 40
                  ? 'bg-yellow-400'
                  : 'bg-green-400'
              }`}
              style={{ width: `${resolutionRiskScore}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={getRiskColor(resolutionRiskScore)}>{getRiskLabel(resolutionRiskScore)}</span>
            {market.resolutionSource && market.resolutionSource.startsWith('http') && !market.resolutionCriteria && (
              <a
                href={market.resolutionSource}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Source
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Ambiguity Flags - Compact */}
        <div className="space-y-1">
          {!market.resolutionCriteria && !market.resolutionSource && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
              <span>No resolution source</span>
            </div>
          )}
          {timeUntilEnd !== null && timeUntilEnd < 24 * 60 * 60 * 1000 && !isExpired && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
              <span>Deadline approaching</span>
            </div>
          )}
          {isExpired && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
              <span>Expired</span>
            </div>
          )}
          {resolutionRiskScore < 40 && (market.resolutionCriteria || market.resolutionSource) && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0" />
              <span>Low ambiguity risk</span>
            </div>
          )}
        </div>

        {/* Deadline - Compact */}
        {endDate && (
          <div className="border border-border bg-card p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Deadline</span>
              </div>
              {timeUntilEnd !== null && (
                <span
                  className={`text-[10px] font-mono ${
                    timeUntilEnd < 0
                      ? 'text-red-400'
                      : timeUntilEnd < 24 * 60 * 60 * 1000
                      ? 'text-yellow-400'
                      : 'text-foreground'
                  }`}
                >
                  {isExpired
                    ? 'Expired'
                    : timeUntilEnd < 60 * 1000
                    ? `${Math.floor(timeUntilEnd / 1000)}s`
                    : timeUntilEnd < 60 * 60 * 1000
                    ? `${Math.floor(timeUntilEnd / (60 * 1000))}m`
                    : timeUntilEnd < 24 * 60 * 60 * 1000
                    ? `${Math.floor(timeUntilEnd / (60 * 60 * 1000))}h`
                    : `${Math.floor(timeUntilEnd / (24 * 60 * 60 * 1000))}d`}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Resolution Criteria - Display rules/criteria if available */}
        {(market.resolutionCriteria || market.resolutionSource) && (
          <div className="border border-border bg-card p-2">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Rules</div>
            <div className="text-[10px] leading-relaxed">
              {market.resolutionCriteria ? (
                <div className="space-y-1.5">
                  {market.resolutionCriteria.split('\n').map((line, idx) => (
                    <p key={idx} className={line.trim() === '' ? 'h-1' : ''}>{line.trim() || '\u00A0'}</p>
                  ))}
                </div>
              ) : market.resolutionSource ? (
                <div>{market.resolutionSource}</div>
              ) : null}
            </div>
            {market.resolutionCriteria && market.resolutionSource && market.resolutionSource.startsWith('http') && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="text-[10px] font-medium text-muted-foreground mb-1">Primary Resolution Source</div>
                <a
                  href={market.resolutionSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  {market.resolutionSource}
                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ResolutionCriteriaCard = React.memo(ResolutionCriteriaCardComponent, (prevProps, nextProps) => {
  // Compare marketId for equality
  if (!prevProps || !nextProps) return false;
  return prevProps.marketId === nextProps.marketId;
});

