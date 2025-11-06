'use client';

import React, { Suspense } from 'react';
import { CardConfig } from '@/stores/layout-store';
import { Maximize2, Minimize2, X, Loader2, Settings } from 'lucide-react';
import { useLayoutStore } from '@/stores/layout-store';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CardErrorFallback } from '@/components/ErrorFallback';

// Lazy load card components for code splitting
const WatchlistCard = React.lazy(() => import('@/components/cards/WatchlistCard').then(m => ({ default: m.WatchlistCard })));
const TapeCard = React.lazy(() => import('@/components/cards/TapeCard').then(m => ({ default: m.TapeCard })));
const QuickTicketCard = React.lazy(() => import('@/components/cards/QuickTicketCard').then(m => ({ default: m.QuickTicketCard })));
const DepthCard = React.lazy(() => import('@/components/cards/DepthCard').then(m => ({ default: m.DepthCard })));
const OrderBookCard = React.lazy(() => import('@/components/cards/OrderBookCard').then(m => ({ default: m.OrderBookCard })));
const ScenarioBuilderCard = React.lazy(() => import('@/components/cards/ScenarioBuilderCard').then(m => ({ default: m.ScenarioBuilderCard })));
const ExposureTreeCard = React.lazy(() => import('@/components/cards/ExposureTreeCard').then(m => ({ default: m.ExposureTreeCard })));
const ActivityScannerCard = React.lazy(() => import('@/components/cards/ActivityScannerCard').then(m => ({ default: m.ActivityScannerCard })));
const ResolutionCriteriaCard = React.lazy(() => import('@/components/cards/ResolutionCriteriaCard').then(m => ({ default: m.ResolutionCriteriaCard })));
const ChartCard = React.lazy(() => import('@/components/cards/ChartCard').then(m => ({ default: m.ChartCard })));
const TradingViewChartCard = React.lazy(() => import('@/components/cards/TradingViewChartCard').then(m => ({ default: m.TradingViewChartCard })));
const CorrelationMatrixCard = React.lazy(() => import('@/components/cards/CorrelationMatrixCard').then(m => ({ default: m.CorrelationMatrixCard })));
const AlertCard = React.lazy(() => import('@/components/cards/AlertCard').then(m => ({ default: m.AlertCard })));
const MarketDiscoveryCard = React.lazy(() => import('@/components/cards/MarketDiscoveryCard').then(m => ({ default: m.MarketDiscoveryCard })));
const MarketInfoCard = React.lazy(() => import('@/components/cards/MarketInfoCard').then(m => ({ default: m.MarketInfoCard })));
const NewsCard = React.lazy(() => import('@/components/cards/NewsCard').then(m => ({ default: m.NewsCard })));
const OrderCreatorCard = React.lazy(() => import('@/components/cards/OrderCreatorCard').then(m => ({ default: m.OrderCreatorCard })));
const PositionsCard = React.lazy(() => import('@/components/cards/PositionsCard').then(m => ({ default: m.PositionsCard })));
const TransactionHistoryCard = React.lazy(() => import('@/components/cards/TransactionHistoryCard').then(m => ({ default: m.default })));
const OrderHistoryCard = React.lazy(() => import('@/components/cards/OrderHistoryCard').then(m => ({ default: m.default })));
const TeamManagementCard = React.lazy(() => import('@/components/cards/TeamManagementCard').then(m => ({ default: m.default })));
const JournalCard = React.lazy(() => import('@/components/cards/JournalCard').then(m => ({ default: m.default })));
const CommentsCard = React.lazy(() => import('@/components/cards/CommentsCard').then(m => ({ default: m.default })));
const ThemeEditorCard = React.lazy(() => import('@/components/cards/ThemeEditorCard').then(m => ({ default: m.default })));
const KellyCalculatorCard = React.lazy(() => import('@/components/cards/KellyCalculatorCard').then(m => ({ default: m.KellyCalculatorCard })));
const PositionSizingCard = React.lazy(() => import('@/components/cards/PositionSizingCard').then(m => ({ default: m.PositionSizingCard })));
const PriceConverterCard = React.lazy(() => import('@/components/cards/PriceConverterCard').then(m => ({ default: m.PriceConverterCard })));
const MarketResearchCard = React.lazy(() => import('@/components/cards/MarketResearchCard').then(m => ({ default: m.MarketResearchCard })));

// Loading fallback component
const CardLoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  </div>
);

// Context for card header actions
export const CardHeaderActionsContext = React.createContext<{
  onSettingsClick?: () => void;
  setOnSettingsClick?: (handler: (() => void) | undefined) => void;
}>({});

interface CardProps {
  card: CardConfig;
}

// Provider for card header actions
function CardHeaderActionsProvider({ children }: { children: React.ReactNode }) {
  const [onSettingsClick, setOnSettingsClick] = React.useState<(() => void) | undefined>(undefined);

  return (
    <CardHeaderActionsContext.Provider value={{ onSettingsClick, setOnSettingsClick }}>
      {children}
    </CardHeaderActionsContext.Provider>
  );
}

// Card Header component
function CardHeader({ 
  card, 
  isLocked, 
  restoreCard, 
  maximizeCard, 
  removeCard 
}: { 
  card: CardConfig; 
  isLocked: boolean; 
  restoreCard: (id: string) => void; 
  maximizeCard: (id: string) => void; 
  removeCard: (id: string) => void; 
}) {
  const { onSettingsClick } = React.useContext(CardHeaderActionsContext);

  return (
    <div className={cn(
      "card-handle flex items-center justify-between px-4 py-1.5 border-b border-border bg-accent/20 hover:bg-accent/30 transition-colors duration-200",
      card.isMaximized ? "cursor-default" : "cursor-move"
    )}>
      <h3 className="text-xs font-semibold tracking-tight capitalize">{card.type.replace(/-/g, ' ')}</h3>
      <div className="flex items-center gap-1">
        {/* Card-specific actions (e.g., settings) */}
        {onSettingsClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettingsClick();
            }}
            className={cn(
              "hover:bg-accent/60 transition-all duration-150 active:scale-95",
              card.isMaximized ? "p-2.5" : "p-1.5"
            )}
            title="Settings"
            aria-label="Settings"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Settings className={card.isMaximized ? "h-5 w-5 text-muted-foreground" : "h-3.5 w-3.5 text-muted-foreground"} />
          </button>
        )}
        {card.isMaximized ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              restoreCard(card.id);
            }}
            className="p-2.5 hover:bg-accent/60 transition-all duration-150 active:scale-95"
            title="Restore"
            aria-label="Restore card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Minimize2 className="h-5 w-5 text-muted-foreground" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              maximizeCard(card.id);
            }}
            className="p-1.5 hover:bg-accent/60 transition-all duration-150 active:scale-95"
            title="Maximize"
            aria-label="Maximize card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {!isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              removeCard(card.id);
            }}
            className={cn(
              "hover:bg-destructive/30 hover:text-destructive transition-all duration-150 active:scale-95",
              card.isMaximized ? "p-2.5" : "p-1.5"
            )}
            title="Remove"
            aria-label="Remove card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className={card.isMaximized ? "h-5 w-5" : "h-3.5 w-3.5"} />
          </button>
        )}
      </div>
    </div>
  );
}

export const Card = React.memo(function Card({ card }: CardProps) {
  // Use selectors to prevent unnecessary re-renders - split selector calls
  const maximizeCard = useLayoutStore((state) => state.maximizeCard);
  const restoreCard = useLayoutStore((state) => state.restoreCard);
  const removeCard = useLayoutStore((state) => state.removeCard);
  const updateCardProps = useLayoutStore((state) => state.updateCardProps);
  const currentWorkspaceId = useLayoutStore((state) => state.currentWorkspaceId);
  const { data: workspaces = [] } = useWorkspaces();
  const [isDragOver, setIsDragOver] = React.useState(false);
  
  // Memoize workspace lookup
  const currentWorkspace = React.useMemo(
    () => workspaces.find((w: any) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );
  const isLocked = currentWorkspace?.locked || false;

  // Memoize acceptsMarketDrop check
  const acceptsMarketDrop = React.useMemo(
    () => ['chart', 'tradingview-chart', 'news', 'resolution-criteria', 'market-info', 'comments'].includes(card.type),
    [card.type]
  );
  
  // Memoize drag handlers with useCallback
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    if (!acceptsMarketDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, [acceptsMarketDrop]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    if (!acceptsMarketDrop) return;
    // Only remove drag over if we're leaving the card itself, not child elements
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, [acceptsMarketDrop]);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    if (!acceptsMarketDrop) return;
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragOver(false);

    // Check for multimarket first (marketIds or eventId)
    const marketIdsData = e.dataTransfer.getData('marketIds');
    const eventId = e.dataTransfer.getData('eventId');
    
    if (marketIdsData) {
      // Multimarket drop - parse marketIds array
      try {
        const marketIds = JSON.parse(marketIdsData);
        if (Array.isArray(marketIds) && marketIds.length > 0) {
          // For chart cards, always use marketIds (replaces existing multimarket)
          if (card.type === 'chart') {
            // Replace all existing markets with the new multimarket
            // Clear marketId to ensure ChartCard uses marketIds
            updateCardProps(card.id, { marketIds });
          } else {
            // Other card types use single marketId (use first market)
            updateCardProps(card.id, { marketId: marketIds[0] });
          }
        }
      } catch (error) {
        console.error('Error parsing marketIds:', error);
      }
    } else if (eventId) {
      // Event ID provided but no marketIds - this shouldn't happen, but handle gracefully
      // In this case, we'd need to fetch markets by eventId, which is more complex
      // For now, skip this case as it should come with marketIds
      console.warn('Event ID provided without marketIds, skipping drop');
    } else {
      // Single market drop
      const marketId = e.dataTransfer.getData('marketId');
        if (marketId) {
          // For chart cards, always use marketIds array (replaces existing multimarket)
          // This ensures dragging a single market onto a chart with a multimarket replaces it
          if (card.type === 'chart') {
            // Use marketIds array with single market - this replaces any existing multimarket
            updateCardProps(card.id, { marketIds: [marketId] });
          } else {
            // Other card types use single marketId
            // TradingView chart uses single marketId
            updateCardProps(card.id, { marketId });
          }
        }
    }
  }, [acceptsMarketDrop, updateCardProps, card.id, card.type]);

  if (card.isMinimized) {
    return (
      <div className="card bg-card border border-border p-2.5 h-full flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-200">
        <span className="text-xs font-medium text-muted-foreground truncate capitalize">{card.type.replace(/-/g, ' ')}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            maximizeCard(card.id);
          }}
                className="p-1 hover:bg-accent/60 transition-all duration-150 active:scale-95"
          title="Maximize"
          aria-label="Maximize card"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop when maximized - hides background */}
      {card.isMaximized && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md transition-all duration-300"
          onClick={(e) => {
            e.stopPropagation();
            restoreCard(card.id);
          }}
          aria-hidden="true"
        />
      )}
      
      <div
        className={cn(
          'card bg-card h-full flex flex-col shadow-card transition-all duration-300',
          card.isMaximized 
            ? 'fixed inset-0 z-[101] shadow-none border-0' 
            : 'border hover:shadow-card-hover',
          card.isMaximized ? 'border-0' : isDragOver ? 'border-primary border-2 bg-accent/30' : 'border-border',
          acceptsMarketDrop && 'drop-zone'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          // Prevent context menu from bubbling up to workspace grid
          e.stopPropagation();
        }}
      >
        <CardHeaderActionsProvider>
          {/* Card Header */}
          <CardHeader card={card} isLocked={isLocked} restoreCard={restoreCard} maximizeCard={maximizeCard} removeCard={removeCard} />

          {/* Card Content */}
          <div className="flex-1 p-2 sm:p-4 overflow-auto scrollbar-hide">
            <CardContent type={card.type} props={card.props} cardId={card.id} />
          </div>
        </CardHeaderActionsProvider>
      </div>
    </>
  );
});

function CardContent({ 
  type, 
  props, 
  cardId 
}: { 
  type: string; 
  props?: Record<string, unknown>; 
  cardId: string;
}) {
  // Use selector to get only the function we need
  const updateCardProps = useLayoutStore((state) => state.updateCardProps);
  
  // Memoize handlers with useCallback to prevent unnecessary re-renders
  const handleChartMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleNewsMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleResolutionCriteriaMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleMarketInfoMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleMarketResearchMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleTradingViewChartMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleCommentsMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleChartMarketIdsChange = React.useCallback((marketIds: string[]) => {
    updateCardProps(cardId, { marketIds });
  }, [updateCardProps, cardId]);

  // Render lazy-loaded card components with Suspense boundary
  const renderCard = () => {
    switch (type) {
      case 'watchlist':
        return <WatchlistCard marketIds={props?.marketIds as string[] | undefined} />;
      case 'tape':
        return <TapeCard />;
      case 'quick-ticket':
        return <QuickTicketCard />;
      case 'order-creator':
        return <OrderCreatorCard />;
      case 'depth':
        return <DepthCard />;
      case 'orderbook':
        return <OrderBookCard />;
      case 'scenario-builder':
        return <ScenarioBuilderCard />;
      case 'exposure-tree':
        return <ExposureTreeCard />;
      case 'activity-scanner':
        return <ActivityScannerCard />;
      case 'resolution-criteria':
        return (
          <ResolutionCriteriaCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleResolutionCriteriaMarketChange}
          />
        );
      case 'chart':
        return (
          <ChartCard 
            marketId={props?.marketId as string | undefined}
            marketIds={props?.marketIds as string[] | undefined}
            onMarketChange={handleChartMarketChange}
            onMarketIdsChange={handleChartMarketIdsChange}
          />
        );
      case 'tradingview-chart':
        return (
          <TradingViewChartCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleTradingViewChartMarketChange}
          />
        );
      case 'correlation-matrix':
        return <CorrelationMatrixCard />;
      case 'alerts':
        return <AlertCard />;
      case 'market-discovery':
        return <MarketDiscoveryCard />;
      case 'market-info':
        return (
          <MarketInfoCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleMarketInfoMarketChange}
          />
        );
      case 'news':
        return (
          <NewsCard 
            marketId={props?.marketId as string | undefined} 
            onMarketChange={handleNewsMarketChange}
          />
        );
      case 'positions':
        return <PositionsCard />;
      case 'transaction-history':
        return <TransactionHistoryCard />;
      case 'order-history':
        return <OrderHistoryCard />;
      case 'team-management':
        return <TeamManagementCard />;
      case 'journal':
        return <JournalCard />;
      case 'comments':
        return (
          <CommentsCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleCommentsMarketChange}
          />
        );
      case 'theme-editor':
        return <ThemeEditorCard />;
      case 'kelly-calculator':
        return <KellyCalculatorCard />;
      case 'position-sizing':
        return <PositionSizingCard />;
      case 'price-converter':
        return <PriceConverterCard />;
      case 'market-research':
        return (
          <MarketResearchCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleMarketResearchMarketChange}
          />
        );
      default:
        return (
          <div className="text-xs text-muted-foreground">
            Unknown card type: {type}
          </div>
        );
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <CardErrorFallback
          error={new Error('Card failed to load')}
          resetError={() => window.location.reload()}
        />
      }
    >
      <Suspense fallback={<CardLoadingFallback />}>
        {renderCard()}
      </Suspense>
    </ErrorBoundary>
  );
}

