'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMarket, useMarketPrice, useHistoricalPrices } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { Search } from 'lucide-react';
import { MarketSelector } from '@/components/MarketSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { detectCompany, getTradingSymbol } from '@/lib/utils/company-detector';

interface TradingViewChartCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

function TradingViewChartCardComponent({ 
  marketId: propMarketId, 
  onMarketChange 
}: TradingViewChartCardProps = {}) {
  const { selectedMarketId, getMarket } = useMarketStore();
  const effectiveMarketId = propMarketId || selectedMarketId;
  
  const { data: currentPrice } = useMarketPrice(effectiveMarketId);
  const { data: market } = useMarket(effectiveMarketId);
  const [timeRange, setTimeRange] = useState<TimeRange>('1W');
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  // Calculate hours based on time range
  const getHoursForRange = (range: TimeRange): number | null => {
    switch (range) {
      case '1H': return 1;
      case '6H': return 6;
      case '1D': return 24;
      case '1W': return 24 * 7;
      case '1M': return 24 * 30;
      case 'ALL': return null;
      default: return 24;
    }
  };

  const hours = getHoursForRange(timeRange);
  
  // Fetch historical prices (for future use when Charting Library is added)
  const { data: historicalPrices = [], isLoading } = useHistoricalPrices(effectiveMarketId, hours);

  // Initialize TradingView widget (using free iframe widget - no library needed)
  useEffect(() => {
    if (!widgetContainerRef.current || !effectiveMarketId) {
      return;
    }

    // Clean up previous widget
    if (widgetRef.current) {
      try {
        const container = widgetContainerRef.current;
        if (container && container.firstChild) {
          container.removeChild(container.firstChild);
        }
      } catch (error) {
        console.error('Error removing TradingView widget:', error);
      }
      widgetRef.current = null;
    }

    // Create a unique container ID
    const containerId = `tradingview_${effectiveMarketId}_${Date.now()}`;
    if (widgetContainerRef.current) {
      widgetContainerRef.current.id = containerId;
      widgetContainerRef.current.innerHTML = ''; // Clear previous content
    }

    // Use TradingView's free embedded widget (iframe-based)
    // This doesn't require any downloads and works out of the box
    // Note: This won't show custom Polymarket data, but provides a TradingView-style chart
    const iframe = document.createElement('iframe');
    
    // Detect company name and ticker from market question
    let symbol = 'INDEX:SPX'; // Default to S&P 500 if no company detected
    let detectedCompany = null;
    
    if (market?.question) {
      detectedCompany = detectCompany(market.question);
      
      if (detectedCompany.ticker) {
        // Use the detected ticker symbol
        symbol = getTradingSymbol(detectedCompany.ticker);
        console.log(`[TradingViewChart] Detected company: ${detectedCompany.companyName} (${detectedCompany.ticker}) from market: "${market.question}"`);
      } else if (detectedCompany.companyName) {
        // Company detected but no ticker - use company name as fallback
        symbol = detectedCompany.companyName.toUpperCase().replace(/\s+/g, '_');
        console.log(`[TradingViewChart] Detected company name: ${detectedCompany.companyName} but no ticker found`);
      } else {
        // No company detected - use market question as fallback
        symbol = market.question.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      }
    } else {
      // Fallback if no market question
      symbol = `MARKET_${effectiveMarketId.substring(0, 8)}`;
    }
    
    // Build the iframe URL with TradingView widget parameters
    const widgetUrl = new URL('https://s.tradingview.com/widgetembed/');
    widgetUrl.searchParams.set('frameElementId', containerId);
    widgetUrl.searchParams.set('symbol', symbol);
    widgetUrl.searchParams.set('interval', '15');
    widgetUrl.searchParams.set('theme', 'dark');
    widgetUrl.searchParams.set('style', '1');
    widgetUrl.searchParams.set('locale', 'en');
    widgetUrl.searchParams.set('hide_top_toolbar', '1');
    widgetUrl.searchParams.set('hide_legend', '1');
    widgetUrl.searchParams.set('save_image', '0');
    widgetUrl.searchParams.set('toolbar_bg', '#1a1a1a');
    widgetUrl.searchParams.set('enable_publishing', '0');
    widgetUrl.searchParams.set('allow_symbol_change', '0');
    
    iframe.src = widgetUrl.toString();
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'transparency');
    iframe.setAttribute('title', `TradingView Chart - ${market?.question || effectiveMarketId}`);
    
    if (widgetContainerRef.current) {
      widgetContainerRef.current.appendChild(iframe);
      widgetRef.current = iframe;
    }

    return () => {
      if (widgetRef.current) {
        try {
          if (widgetRef.current instanceof HTMLIFrameElement) {
            widgetRef.current.remove();
          } else if (widgetRef.current.remove) {
            widgetRef.current.remove();
          }
        } catch (error) {
          console.error('Error removing TradingView widget:', error);
        }
        widgetRef.current = null;
      }
    };
  }, [effectiveMarketId, market]);

  const handleMarketSelectorOpen = useCallback(() => {
    setShowMarketSelector(true);
  }, []);

  const handleMarketSelectorClose = useCallback((open: boolean) => {
    setShowMarketSelector(open);
  }, []);

  const handleMarketSelect = useCallback((marketId: string | null) => {
    if (onMarketChange) {
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
  }, [onMarketChange]);

  if (!effectiveMarketId) {
    return (
      <>
        <EmptyState
          icon={Search}
          title="Select a market to view chart"
          description="Choose a market from the selector below to display its TradingView chart"
          action={{
            label: 'Select Market',
            onClick: handleMarketSelectorOpen,
          }}
          className="p-4"
        />
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={handleMarketSelectorClose}
          onSelect={handleMarketSelect}
        />
      </>
    );
  }

  const timeRangeButtons: TimeRange[] = ['1H', '6H', '1D', '1W', '1M', 'ALL'];
  const isLoadingData = isLoading;

  // Detect company from market question
  const detectedCompany = market?.question ? detectCompany(market.question) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header with controls */}
      <div className="flex flex-col px-4 py-2 border-b border-border bg-accent/10 flex-shrink-0 gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={handleMarketSelectorOpen}
              className="p-1.5 hover:bg-accent/60 rounded-md transition-colors flex-shrink-0"
              title="Select market"
              aria-label="Select market"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <span className="text-xs font-medium truncate text-foreground" title={market?.question}>
              {market?.question || 'Select market'}
            </span>
            {detectedCompany?.ticker && (
              <span 
                className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-mono flex-shrink-0"
                title={`Detected company: ${detectedCompany.companyName} (${detectedCompany.ticker})`}
              >
                {detectedCompany.ticker}
              </span>
            )}
          </div>
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {timeRangeButtons.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-all duration-150 ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
                title={`${range} time range`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <MarketSelector
        open={showMarketSelector}
        onOpenChange={handleMarketSelectorClose}
        onSelect={handleMarketSelect}
      />

      {/* Chart container */}
      <div className="flex-1 min-h-0 relative">
        {isLoadingData ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="md" text="Loading TradingView chart..." />
          </div>
        ) : (
          <div
            ref={widgetContainerRef}
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const TradingViewChartCard = React.memo(TradingViewChartCardComponent, (prevProps, nextProps) => {
  return prevProps?.marketId === nextProps?.marketId;
});

