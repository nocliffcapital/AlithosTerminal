'use client';

import React, { useEffect, useRef } from 'react';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';
import { detectCompany, getTradingSymbol } from '@/lib/utils/company-detector';

interface TradingViewChartCardProps {
  marketId?: string;
  onMarketChange?: (marketId: string | null) => void;
}

function TradingViewChartCardComponent({ 
  marketId: propMarketId, 
  onMarketChange 
}: TradingViewChartCardProps = {}) {
  const { getMarket } = useMarketStore();
  // Use prop marketId only - don't fall back to global state to avoid shared state issues
  const effectiveMarketId = propMarketId;
  
  const { data: market } = useMarket(effectiveMarketId ?? null);
  
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const currentSymbolRef = useRef<string>('BTCUSD');

  // Initialize TradingView widget (using free iframe widget - no library needed)
  useEffect(() => {
    if (!widgetContainerRef.current) {
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

    // Determine symbol to use: detected ticker > default
    let symbol = 'BTCUSD'; // Default to BTCUSD
    let detectedCompany = null;
    
    if (market?.question) {
      // Detect ticker from market question
      detectedCompany = detectCompany(market.question);
      
      if (detectedCompany.ticker) {
        // Only use the detected ticker symbol
        symbol = getTradingSymbol(detectedCompany.ticker);
        console.log(`[TradingViewChart] Detected company: ${detectedCompany.companyName} (${detectedCompany.ticker}) from market: "${market.question}"`);
      } else {
        // No ticker detected - use default BTCUSD
        console.log(`[TradingViewChart] No ticker detected for market: "${market.question}". Using default BTCUSD`);
      }
    } else {
      // Use current symbol from ref or default
      symbol = currentSymbolRef.current || 'BTCUSD';
      console.log(`[TradingViewChart] Using current/default symbol: ${symbol}`);
    }
    
    // Update current symbol ref
    if (symbol !== currentSymbolRef.current) {
      currentSymbolRef.current = symbol;
    }

    // Create a unique container ID (after symbol is determined)
    const containerId = `tradingview_${symbol}_${Date.now()}`;
    if (widgetContainerRef.current) {
      widgetContainerRef.current.id = containerId;
      widgetContainerRef.current.innerHTML = ''; // Clear previous content
    }

    // Use TradingView's free embedded widget (iframe-based)
    // This doesn't require any downloads and works out of the box
    // Note: This won't show custom Polymarket data, but provides a TradingView-style chart
    const iframe = document.createElement('iframe');
    
    // Build the iframe URL with TradingView widget parameters
    const widgetUrl = new URL('https://s.tradingview.com/widgetembed/');
    widgetUrl.searchParams.set('frameElementId', containerId);
    widgetUrl.searchParams.set('symbol', symbol);
    widgetUrl.searchParams.set('interval', '15');
    widgetUrl.searchParams.set('theme', 'dark');
    widgetUrl.searchParams.set('style', '1');
    widgetUrl.searchParams.set('locale', 'en');
    widgetUrl.searchParams.set('hide_top_toolbar', '0'); // Show toolbar
    widgetUrl.searchParams.set('hide_legend', '0'); // Show legend
    widgetUrl.searchParams.set('save_image', '0');
    widgetUrl.searchParams.set('toolbar_bg', '#1a1a1a');
    widgetUrl.searchParams.set('enable_publishing', '0');
    widgetUrl.searchParams.set('allow_symbol_change', '1'); // Allow symbol change
    
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

  return (
    <div className="h-full flex flex-col">
      {/* Chart container */}
      <div className="flex-1 min-h-0 relative">
        <div
          ref={widgetContainerRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const TradingViewChartCard = React.memo(TradingViewChartCardComponent, (prevProps, nextProps) => {
  return prevProps?.marketId === nextProps?.marketId;
});

