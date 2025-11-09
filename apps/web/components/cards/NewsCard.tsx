'use client';

import React from 'react';
import { useMarketStore } from '@/stores/market-store';
import { useAdjacentNews } from '@/lib/hooks/useAdjacentNews';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { Loader2, ExternalLink, Calendar, User, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketSelector } from '@/components/MarketSelector';
import { CardMarketContext } from '@/components/layout/Card';

interface NewsCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function NewsCardComponent({ marketId: propMarketId, onMarketChange }: NewsCardProps = {}) {
  const { getMarket } = useMarketStore();
  const [days, setDays] = useState<number>(7);
  const [limit, setLimit] = useState<number>(10);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const { setMarketQuestion } = React.useContext(CardMarketContext);

  // Use prop marketId if provided, otherwise fall back to selectedMarketId for backward compatibility
  const effectiveMarketId = propMarketId || null;
  
  const { data: market, isLoading: isLoadingMarket } = useMarket(effectiveMarketId);
  const storedMarket = effectiveMarketId ? getMarket(effectiveMarketId) : null;
  const displayMarket = market || storedMarket;

  // Set market question in context for card header display
  // Always show the full question (like Market Search), not extracted option name
  React.useEffect(() => {
    if (!setMarketQuestion) return;
    
    // Defer state update to avoid render warnings
    requestAnimationFrame(() => {
      if (displayMarket) {
        // Always show the full question, matching Market Search behavior
        setMarketQuestion(displayMarket.question || null);
      } else {
        setMarketQuestion(null);
      }
    });
  }, [displayMarket, setMarketQuestion]);

  const { data: newsData, isLoading: isLoadingNews, error } = useAdjacentNews({
    market: displayMarket || null,
    days,
    limit,
    enabled: !!displayMarket,
  });

  const isLoading = isLoadingMarket || isLoadingNews;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins < 1 ? 'Just now' : `${diffMins}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      }
    } catch {
      return dateString;
    }
  };

  if (!effectiveMarketId || !displayMarket) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view related news"
          description="Use the search icon in the navbar to select a market"
          action={{
            label: 'Select Market',
            onClick: () => setShowMarketSelector(true),
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-accent/20">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              Days:
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-[10px] sm:text-xs px-2 py-1 border border-border bg-background flex-1 sm:flex-none min-w-0 touch-manipulation"
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              Limit:
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-[10px] sm:text-xs px-2 py-1 border border-border bg-background flex-1 sm:flex-none min-w-0 touch-manipulation"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {/* News List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 sm:h-48">
            <LoadingSpinner size="sm" text="Loading news..." />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 sm:h-48 text-muted-foreground text-xs sm:text-sm text-center px-4">
            <div className="mb-2 font-semibold">Failed to load news</div>
              <div className="text-xs text-muted-foreground/70 mb-2 break-words max-w-full px-2">
              {error instanceof Error ? error.message : String(error)}
            </div>
            {(error instanceof Error && 
              (error.message.includes('API key') || 
               error.message.includes('401') || 
               error.message.includes('403') ||
               error.message.includes('unauthorized'))) && (
              <div className="text-xs text-muted-foreground/70 mt-2 max-w-xs p-2 rounded border border-border/50">
                Please configure NEWSAPI_AI_API_KEY in your .env.local file
              </div>
            )}
            {error instanceof Error && error.message.includes('Market not found') && (
              <div className="text-xs text-muted-foreground/70 mt-2 max-w-xs">
                Try selecting a different market or using a broader search term
              </div>
            )}
          </div>
        ) : !newsData?.data || newsData.data.length === 0 ? (
          <div className="flex items-center justify-center h-32 sm:h-48 text-muted-foreground text-xs sm:text-sm text-center px-4">
            No news articles found for this market
            {newsData?.meta && (
              <div className="text-xs text-muted-foreground/70 mt-2">
                Try increasing the days parameter or broadening your search
              </div>
            )}
          </div>
        ) : (
          newsData.data.map((article) => (
            <div
              key={article.url}
              className="py-2 border-b border-border/30 last:border-b-0 hover:bg-accent/10 transition-colors duration-200"
            >
              {/* Title */}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group mb-1"
              >
                <h3 className="text-xs sm:text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
              </a>

              {/* Snippet */}
              {article.snippet && (
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mb-1.5">
                  {article.snippet}
                </p>
              )}

              {/* Metadata and Link */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
                {/* Domain */}
                <div className="flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {article.domain}
                  </span>
                </div>

                {/* Published Date */}
                <div className="flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  <span>{formatDate(article.publishedDate)}</span>
                </div>

                {/* Author */}
                {article.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[100px]">{article.author}</span>
                  </div>
                )}

                {/* Link */}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                >
                  Read
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          ))
        )}

        {/* Meta Information */}
        {newsData?.meta && newsData.meta.totalResults !== undefined && (
          <div className="text-[10px] sm:text-xs text-muted-foreground/70 text-center pt-2 border-t border-border/50">
            {newsData.meta.totalResults} {newsData.meta.totalResults === 1 ? 'article' : 'articles'} found
            {newsData.meta.searchMethod && (
              <span className="ml-2">
                (via {newsData.meta.searchMethod === 'neural' ? 'neural search' : 'fallback search'})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const NewsCard = React.memo(NewsCardComponent, (prevProps, nextProps) => {
  // Compare marketId for equality
  if (!prevProps || !nextProps) return false;
  return prevProps.marketId === nextProps.marketId;
});

