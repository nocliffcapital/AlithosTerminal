'use client';

import React, { Suspense } from 'react';
import { CardConfig } from '@/stores/layout-store';
import { Maximize2, Minimize2, X, Loader2, Settings, Search, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores/layout-store';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { useMarket, useMarkets } from '@/lib/hooks/usePolymarketData';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CardErrorFallback } from '@/components/ErrorFallback';
import { MarketSelector } from '@/components/MarketSelector';
import { CardTabs } from '@/components/cards/CardTabs';
import { CardTab } from '@/stores/layout-store';
import { LinkManager } from '@/components/cards/LinkManager';

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
const MarketDiscoveryCard = React.lazy(() => import('@/components/cards/MarketDiscoveryCard').then(m => ({ default: m.MarketDiscoveryCard })));
const MarketInfoCard = React.lazy(() => import('@/components/cards/MarketInfoCard').then(m => ({ default: m.MarketInfoCard })));
const NewsCard = React.lazy(() => import('@/components/cards/NewsCard').then(m => ({ default: m.NewsCard })));
const OrderCreatorCard = React.lazy(() => import('@/components/cards/OrderCreatorCard').then(m => ({ default: m.OrderCreatorCard })));
const PositionsCard = React.lazy(() => import('@/components/cards/PositionsCard').then(m => ({ default: m.PositionsCard })));
const TransactionHistoryCard = React.lazy(() => import('@/components/cards/TransactionHistoryCard').then(m => ({ default: m.default })));
const OrderHistoryCard = React.lazy(() => import('@/components/cards/OrderHistoryCard').then(m => ({ default: m.default })));
const JournalCard = React.lazy(() => import('@/components/cards/JournalCard').then(m => ({ default: m.default })));
const CommentsCard = React.lazy(() => import('@/components/cards/CommentsCard').then(m => ({ default: m.default })));
const KellyCalculatorCard = React.lazy(() => import('@/components/cards/KellyCalculatorCard').then(m => ({ default: m.KellyCalculatorCard })));
const PositionSizingCard = React.lazy(() => import('@/components/cards/PositionSizingCard').then(m => ({ default: m.PositionSizingCard })));
const PriceConverterCard = React.lazy(() => import('@/components/cards/PriceConverterCard').then(m => ({ default: m.PriceConverterCard })));
const MarketResearchCard = React.lazy(() => import('@/components/cards/MarketResearchCard').then(m => ({ default: m.MarketResearchCard })));
const MarketTradeCard = React.lazy(() => import('@/components/cards/MarketTradeCard').then(m => ({ default: m.MarketTradeCard })));

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

// Context for card market info
export const CardMarketContext = React.createContext<{
  marketQuestion?: string | null;
  setMarketQuestion?: (question: string | null) => void;
  getOnMarketChange?: () => ((marketId: string | null) => void) | undefined;
  setOnMarketChange?: (handler: ((marketId: string | null) => void) | undefined) => void;
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

// Provider for card market info
function CardMarketProvider({ children }: { children: React.ReactNode }) {
  const [marketQuestion, setMarketQuestionState] = React.useState<string | null>(null);
  // Use refs for handlers to avoid state updates during render - handlers don't need to trigger re-renders
  const onMarketChangeRef = React.useRef<((marketId: string | null) => void) | undefined>(undefined);

  // Wrapper to defer state updates to avoid render warnings
  const setMarketQuestion = React.useCallback((question: string | null) => {
    // Use requestAnimationFrame to defer until after render
    requestAnimationFrame(() => {
      setMarketQuestionState(question);
    });
  }, []);

  // Wrapper to update ref only - no state updates to avoid render warnings
  const setOnMarketChange = React.useCallback((handler: ((marketId: string | null) => void) | undefined) => {
    onMarketChangeRef.current = handler;
  }, []);

  // Getter function to access current handler - no state involved
  const getOnMarketChange = React.useCallback(() => {
    return onMarketChangeRef.current;
  }, []);

  // Memoize context value - no handler in value, use getter instead
  const contextValue = React.useMemo(
    () => ({ 
      marketQuestion, 
      setMarketQuestion, 
      getOnMarketChange,
      setOnMarketChange 
    }),
    [marketQuestion, setOnMarketChange, setMarketQuestion, getOnMarketChange]
  );

  return (
    <CardMarketContext.Provider value={contextValue}>
      {children}
    </CardMarketContext.Provider>
  );
}

// Card Header component
function CardHeader({ 
  card, 
  isLocked, 
  restoreCard, 
  maximizeCard, 
  removeCard,
  showMarketSelector,
  setShowMarketSelector,
  switchTab,
  removeTab,
  moveTab,
  getTabLabel
}: { 
  card: CardConfig; 
  isLocked: boolean; 
  restoreCard: (id: string) => void; 
  maximizeCard: (id: string) => void; 
  removeCard: (id: string) => void;
  showMarketSelector: boolean;
  setShowMarketSelector: (show: boolean) => void;
  switchTab: (tabId: string) => void;
  removeTab: (tabId: string) => void;
  moveTab: (sourceTabId: string, targetCardId: string, targetIndex?: number) => void;
  getTabLabel: (tab: CardTab) => string;
}) {
  const { onSettingsClick } = React.useContext(CardHeaderActionsContext);
  const { marketQuestion, getOnMarketChange } = React.useContext(CardMarketContext);
  const { getCardLinkGroup } = useLayoutStore();
  const [showLinkManager, setShowLinkManager] = React.useState(false);
  
  const linkGroup = getCardLinkGroup(card.id);
  
  // Determine if this is a single-market card (not watchlist or market-discovery)
  const isSingleMarketCard = !['watchlist', 'market-discovery'].includes(card.type);
  const showMarketInfo = isSingleMarketCard && marketQuestion;
  const tabs = card.tabs || [];
  const hasTabs = tabs.length > 1;

  const handleMarketSelect = React.useCallback((marketId: string | null) => {
    // Get handler at call time to ensure we have the latest
    const onMarketChange = getOnMarketChange?.();
    if (onMarketChange) {
      onMarketChange(marketId);
    }
    setShowMarketSelector(false);
  }, [getOnMarketChange, setShowMarketSelector]);

  const handleTabDragStart = React.useCallback((tabId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('sourceCardId', card.id);
    e.dataTransfer.setData('sourceTabId', tabId);
    e.dataTransfer.setData('cardType', card.type);
    e.dataTransfer.effectAllowed = 'move';
  }, [card.id, card.type]);

  const handleTabDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleTabDrop = React.useCallback((targetTabId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const sourceCardId = e.dataTransfer.getData('sourceCardId');
    const sourceTabId = e.dataTransfer.getData('sourceTabId');
    const cardType = e.dataTransfer.getData('cardType');
    
    // Only allow moving tabs between cards of the same type
    if (sourceCardId && sourceTabId && cardType === card.type && sourceCardId !== card.id) {
      const targetTabIndex = tabs.findIndex(tab => tab.id === targetTabId);
      if (targetTabIndex >= 0) {
        (moveTab as any)(sourceCardId, sourceTabId, card.id, targetTabIndex);
      } else {
        (moveTab as any)(sourceCardId, sourceTabId, card.id);
      }
    }
  }, [card.type, card.id, tabs, moveTab]);

  return (
    <>
      <div className={cn(
        "card-handle flex items-center justify-between px-4 py-1.5 border-b border-border bg-accent/20 hover:bg-accent/30 transition-colors duration-200",
        card.isMaximized ? "cursor-default" : "cursor-move"
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-xs font-semibold tracking-tight capitalize flex-shrink-0">
            {card.type === 'tradingview-chart' ? 'TradingView Chart' : card.type.replace(/-/g, ' ')}
          </h3>
          {isSingleMarketCard && !hasTabs && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMarketSelector(true);
              }}
              className="p-1 hover:bg-accent/60 rounded-md transition-colors flex-shrink-0"
              title="Select market"
              aria-label="Select market"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Search className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {showMarketInfo && !hasTabs && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs font-medium text-foreground truncate" title={marketQuestion || undefined}>
                {marketQuestion}
              </span>
            </>
          )}
        </div>
      <div className="flex items-center gap-1">
        {/* Link button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowLinkManager(true);
          }}
          className={cn(
            "hover:bg-accent/60 transition-all duration-150 active:scale-95",
            card.isMaximized ? "p-2.5" : "p-1.5",
            linkGroup && "text-primary"
          )}
          title={linkGroup ? "Manage links" : "Link cards"}
          aria-label="Link cards"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Link2 
            className={card.isMaximized ? "h-5 w-5" : "h-3.5 w-3.5"} 
            style={linkGroup ? { color: linkGroup.color } : undefined}
          />
        </button>
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
      {hasTabs && (
        <CardTabs
          tabs={tabs}
          activeTabId={card.activeTabId}
          onTabClick={switchTab}
          onTabClose={removeTab}
          onTabDragStart={handleTabDragStart}
          onTabDragOver={handleTabDragOver}
          onTabDrop={handleTabDrop}
          getTabLabel={getTabLabel}
        />
      )}
      {isSingleMarketCard && (
        <MarketSelector
          open={showMarketSelector}
          onOpenChange={setShowMarketSelector}
          onSelect={handleMarketSelect}
        />
      )}
      <LinkManager
        cardId={card.id}
        open={showLinkManager}
        onOpenChange={setShowLinkManager}
      />
    </>
  );
}

export const Card = React.memo(function Card({ card }: CardProps) {
  // Use selectors to prevent unnecessary re-renders - split selector calls
  const maximizeCard = useLayoutStore((state) => state.maximizeCard);
  const restoreCard = useLayoutStore((state) => state.restoreCard);
  const removeCard = useLayoutStore((state) => state.removeCard);
  const updateCardProps = useLayoutStore((state) => state.updateCardProps);
  const addTab = useLayoutStore((state) => state.addTab);
  const removeTab = useLayoutStore((state) => state.removeTab);
  const switchTab = useLayoutStore((state) => state.switchTab);
  const moveTab = useLayoutStore((state) => state.moveTab);
  const getCardLinkGroup = useLayoutStore((state) => state.getCardLinkGroup);
  const linkSelectionMode = useLayoutStore((state) => state.linkSelectionMode);
  const selectedCardIdsForLinking = useLayoutStore((state) => state.selectedCardIdsForLinking);
  const toggleCardSelection = useLayoutStore((state) => state.toggleCardSelection);
  
  // Get link group for this card to show visual indicators
  const linkGroup = React.useMemo(() => getCardLinkGroup(card.id), [getCardLinkGroup, card.id]);
  const isSelectedForLinking = selectedCardIdsForLinking.has(card.id);
  const currentWorkspaceId = useLayoutStore((state) => state.currentWorkspaceId);
  const { data: workspaces = [] } = useWorkspaces();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [showMarketSelector, setShowMarketSelector] = React.useState(false);
  
  // Get active tab props or use card props
  // Create a stable reference that changes when props actually change
  const activeTab = React.useMemo(() => {
    if (card.tabs && card.tabs.length > 0) {
      const tab = card.tabs.find(t => t.id === card.activeTabId) || card.tabs[0];
      return tab.props;
    }
    return card.props || {};
  }, [
    card.tabs, 
    card.activeTabId, 
    card.props,
    // Include marketIds array length and first element to detect changes
    (card.props as any)?.marketIds?.length,
    (card.props as any)?.marketIds?.[0],
    (card.props as any)?.marketId,
  ]);
  
  // Get tab label function - we'll create a component that fetches market data
  const getTabLabel = React.useCallback((tab: CardTab) => {
    if (tab.label) return tab.label;
    // Try to get market question from props
    const marketId = tab.props?.marketId as string | undefined;
    const marketIds = tab.props?.marketIds as string[] | undefined;
    
    // For chart cards, use marketIds
    if (marketIds && Array.isArray(marketIds) && marketIds.length > 0) {
      if (marketIds.length === 1) {
        // Single market - we'll fetch it
        return `Market ${marketIds[0].slice(0, 8)}`;
      } else {
        return `${marketIds.length} markets`;
      }
    }
    
    if (marketId) {
      return `Market ${marketId.slice(0, 8)}`;
    }
    return 'Tab';
  }, []);
  
  // Memoize workspace lookup
  const currentWorkspace = React.useMemo(
    () => workspaces.find((w: any) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );
  const isLocked = currentWorkspace?.locked || false;

  // Memoize acceptsMarketDrop check
  const acceptsMarketDrop = React.useMemo(
    () => ['chart', 'tradingview-chart', 'news', 'resolution-criteria', 'market-info', 'comments', 'market-trade', 'market-research'].includes(card.type),
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
        // If card already has tabs, add a new tab
        if (card.tabs && card.tabs.length > 0) {
          const newTab: CardTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            props: card.type === 'chart' ? { marketIds: [marketId] } : { marketId },
          };
          addTab(card.id, newTab);
        } else {
          // If card has no tabs yet, create first tab from current props
          const existingTabs = card.tabs || [];
          if (existingTabs.length === 0 && card.props && Object.keys(card.props).length > 0) {
            // Convert current card to first tab and add new tab
            const firstTab: CardTab = {
              id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              props: { ...card.props },
            };
            const newTab: CardTab = {
              id: `tab-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`,
              props: card.type === 'chart' ? { marketIds: [marketId] } : { marketId },
            };
            // Add both tabs
            addTab(card.id, firstTab);
            addTab(card.id, newTab);
          } else {
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
      }
    }
  }, [acceptsMarketDrop, updateCardProps, addTab, card.id, card.type, card.tabs, card.props]);

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
          acceptsMarketDrop && 'drop-zone',
          linkGroup && !card.isMaximized && 'border-l-4',
          linkSelectionMode && !card.isMaximized && 'cursor-pointer',
          isSelectedForLinking && !card.isMaximized && 'ring-2 ring-primary ring-offset-2 bg-primary/10'
        )}
        style={linkGroup && !card.isMaximized ? { borderLeftColor: linkGroup.color } : undefined}
        onClick={(e) => {
          // Only handle click for link selection mode
          if (linkSelectionMode && !card.isMaximized) {
            e.stopPropagation();
            e.preventDefault();
            toggleCardSelection(card.id);
          }
        }}
        onMouseDown={(e) => {
          // Prevent card dragging when in link selection mode
          if (linkSelectionMode && !card.isMaximized) {
            e.stopPropagation();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          // Prevent context menu from bubbling up to workspace grid
          e.stopPropagation();
        }}
      >
        <CardHeaderActionsProvider>
          <CardMarketProvider>
            {/* Card Header */}
        <CardHeader
          card={card}
          isLocked={isLocked}
          restoreCard={restoreCard}
          maximizeCard={maximizeCard}
          removeCard={removeCard}
          showMarketSelector={showMarketSelector}
          setShowMarketSelector={setShowMarketSelector}
          switchTab={(tabId) => switchTab(card.id, tabId)}
          removeTab={(tabId) => removeTab(card.id, tabId)}
          moveTab={(sourceTabId, targetCardId, targetIndex) => {
            // This is called from CardHeader, so sourceCardId is card.id
            moveTab(card.id, sourceTabId, targetCardId, targetIndex);
          }}
          getTabLabel={getTabLabel}
        />

            {/* Card Content */}
            <div className="flex-1 p-2 sm:p-4 overflow-auto scrollbar-hide">
              <CardContent type={card.type} props={activeTab} cardId={card.id} />
            </div>
          </CardMarketProvider>
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
  const { setMarketQuestion, setOnMarketChange } = React.useContext(CardMarketContext);
  
  // Determine marketId for single-market cards
  // For chart cards, use marketId if available, otherwise use first marketId from marketIds array for single market
  const marketId = React.useMemo(() => {
    if (type === 'chart') {
      // Chart can have either marketId or marketIds
      if (props?.marketId) {
        return props.marketId as string;
      }
      if (props?.marketIds && Array.isArray(props.marketIds) && props.marketIds.length === 1) {
        // For single market in marketIds array, show market info in navbar
        return props.marketIds[0] as string;
      }
      // For multi-market chart (marketIds.length > 1), don't show market info in navbar
      return null;
    }
    // Other single-market cards
    return props?.marketId as string | undefined;
  }, [type, props?.marketId, props?.marketIds]);
  
  // Fetch market data for single-market cards (not watchlist or market-discovery)
  const isSingleMarketCard = !['watchlist', 'market-discovery'].includes(type);
  
  // Fetch all markets to get eventId/eventTitle (like MarketTradeCard)
  const { data: allMarkets = [] } = useMarkets({ active: true });
  
  const { data: marketFromHook } = useMarket(
    isSingleMarketCard && marketId ? marketId : null
  );
  
  // Use market from allMarkets if available (has eventId/eventTitle), otherwise fall back to marketFromHook
  // This ensures we have the full market data with eventId populated
  const market = React.useMemo(() => {
    if (!marketId) return null;
    // First, try to find market in allMarkets (has eventId/eventTitle populated)
    const marketFromAllMarkets = allMarkets.find(m => m.id === marketId);
    if (marketFromAllMarkets) return marketFromAllMarkets;
    // Fall back to market from useMarket hook
    return marketFromHook || null;
  }, [marketId, allMarkets, marketFromHook]);
  
  // Helper function to extract market title/name from question
  // When market is part of an event, removes event context to show just the distinguishing part
  const extractOptionName = React.useCallback((question: string, eventTitle?: string): string => {
    if (!question) return '';
    
    // If we have an event title, try to extract what's unique about this market
    if (eventTitle) {
      // Remove the event title from the question to get the distinguishing part
      // For example: "Will Bitcoin reach $250,000 by December 31, 2025?" with event "What price will Bitcoin hit in 2025?"
      // Should extract "$250,000" or "250,000"
      
      // Normalize both strings for comparison (lowercase, remove punctuation)
      const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const normalizedQuestion = normalize(question);
      const normalizedEventTitle = normalize(eventTitle);
      
      // Extract key words from event title (remove common words)
      const eventWords = normalizedEventTitle.split(' ').filter(w => 
        w.length > 2 && !['will', 'what', 'who', 'when', 'where', 'how', 'the', 'and', 'or', 'in', 'by', 'for', 'to'].includes(w)
      );
      
      // Remove event-related words from question
      let remaining = normalizedQuestion;
      eventWords.forEach(word => {
        remaining = remaining.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
      });
      remaining = remaining.replace(/\s+/g, ' ').trim();
      
      // If we successfully removed event context, extract the unique part
      if (remaining.length > 0 && remaining !== normalizedQuestion) {
        // Try to extract the key distinguishing part (price, name, etc.)
        // Look for price patterns: $X, X, Xk, Xm, etc.
        const priceMatch = question.match(/(\$?[\d,]+(?:\.\d+)?[kmb]?)/i);
        if (priceMatch) {
          return priceMatch[1].trim();
        }
        
        // Look for dates
        const dateMatch = question.match(/(\w+\s+\d{1,2},?\s+\d{4})/i);
        if (dateMatch) {
          return dateMatch[1].trim();
        }
        
        // Extract what's left after removing event words
        const uniquePart = question.split(/\s+/).filter(word => {
          const normalizedWord = normalize(word);
          return !eventWords.some(ew => normalizedWord.includes(ew) || ew.includes(normalizedWord));
        }).join(' ').replace(/\?/g, '').trim();
        
        if (uniquePart.length > 0 && uniquePart.length < question.length) {
          return uniquePart;
        }
      }
    }
    
    // Fallback: Extract key information from question patterns
    // Pattern: Extract price if present
    const pricePattern = /(\$?[\d,]+(?:\.\d+)?[kmb]?)/i;
    const priceMatch = question.match(pricePattern);
    if (priceMatch) {
      return priceMatch[1].trim();
    }
    
    // Pattern: "Will [NAME] win [EVENT]?" - extract NAME
    const winPattern = /^Will\s+([^?]+?)\s+win\s+(.+?)\?$/i;
    const winMatch = question.match(winPattern);
    if (winMatch && winMatch.length >= 2) {
      return winMatch[1].trim();
    }
    
    // Pattern: "Will [NAME] be [EVENT]?" - extract NAME
    const bePattern = /^Will\s+([^?]+?)\s+be\s+(.+?)\?$/i;
    const beMatch = question.match(bePattern);
    if (beMatch && beMatch.length >= 2) {
      return beMatch[1].trim();
    }
    
    // Last resort: return everything before the question mark, cleaned up
    const beforeQuestionMark = question.split('?')[0]?.trim();
    if (beforeQuestionMark && beforeQuestionMark.length < question.length) {
      return beforeQuestionMark;
    }
    
    return question;
  }, []);

  // Track previous values to avoid unnecessary updates
  const prevMarketQuestionRef = React.useRef<string | null | undefined>(undefined);

  // Update market question in context when market data changes
  // For multimarkets, format as "Event Title • Option Name"
  React.useEffect(() => {
    if (!setMarketQuestion || !isSingleMarketCard) return;
    
    // Format title for multimarkets
    let displayTitle: string | null = null;
    if (market) {
      const eventId = market.eventId;
      const eventTitle = (market as any).eventTitle;
      const hasEventInfo = eventId && eventTitle;
      
      if (hasEventInfo && market.question) {
        // Format as "Event Title • Option Name"
        const optionName = extractOptionName(market.question, eventTitle);
        displayTitle = `${eventTitle} • ${optionName}`;
      } else {
        // Regular single market - just show question
        displayTitle = market.question || null;
      }
    }
    
    // Only update if the value actually changed
    if (prevMarketQuestionRef.current === displayTitle) return;
    
    prevMarketQuestionRef.current = displayTitle;
    // Provider handles deferral, so we can call directly
    setMarketQuestion(displayTitle);
  }, [market, setMarketQuestion, isSingleMarketCard, extractOptionName]);

  // Memoize the handler so it only changes when dependencies change
  const marketChangeHandler = React.useCallback((marketId: string | null) => {
    if (type === 'chart') {
      // Chart cards use marketIds array (even for single market)
      if (marketId) {
        updateCardProps(cardId, { marketIds: [marketId] });
      } else {
        updateCardProps(cardId, { marketIds: [] });
      }
    } else {
      // Other single-market cards use marketId
      updateCardProps(cardId, { marketId });
    }
  }, [type, updateCardProps, cardId]);

  // Set up market change handler based on card type
  React.useEffect(() => {
    if (!setOnMarketChange || !isSingleMarketCard) return;
    
    // Defer handler setup to avoid any updates during effect phase
    const timeoutId = setTimeout(() => {
      setOnMarketChange(marketChangeHandler);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      // Defer cleanup as well
      setTimeout(() => {
        setOnMarketChange(undefined);
      }, 0);
    };
  }, [setOnMarketChange, isSingleMarketCard, marketChangeHandler]);
  
  // Handler for chart cards - use marketIds array
  const handleChartMarketChange = React.useCallback((marketId: string | null) => {
    // Chart cards use marketIds array (even for single market)
    if (marketId) {
      updateCardProps(cardId, { marketIds: [marketId] });
    } else {
      updateCardProps(cardId, { marketIds: [] });
    }
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

  const handleOrderBookMarketChange = React.useCallback((marketId: string | null) => {
    updateCardProps(cardId, { marketId });
  }, [updateCardProps, cardId]);

  const handleMarketTradeMarketChange = React.useCallback((marketId: string | null) => {
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
        return (
          <OrderBookCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleOrderBookMarketChange}
          />
        );
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
      case 'journal':
        return <JournalCard />;
      case 'comments':
        return (
          <CommentsCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleCommentsMarketChange}
          />
        );
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
      case 'market-trade':
        return (
          <MarketTradeCard 
            marketId={props?.marketId as string | undefined}
            onMarketChange={handleMarketTradeMarketChange}
          />
        );
      case 'alerts':
      case 'theme-editor':
        return (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center">
            <div className="text-sm font-medium mb-2">Card Moved to Settings</div>
            <div className="text-xs text-muted-foreground mb-4">
              This card has been moved to the Settings page. You can access it from the user menu.
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = '/settings';
              }}
              className="text-xs"
            >
              Go to Settings
            </Button>
          </div>
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

