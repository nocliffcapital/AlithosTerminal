'use client';

import React from 'react';
import { CardTab } from '@/stores/layout-store';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarket } from '@/lib/hooks/usePolymarketData';
import { useMarketStore } from '@/stores/market-store';

interface CardTabsProps {
  tabs: CardTab[];
  activeTabId?: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onTabDragStart: (tabId: string, e: React.DragEvent) => void;
  onTabDragOver: (e: React.DragEvent) => void;
  onTabDrop: (targetTabId: string, e: React.DragEvent) => void;
  getTabLabel: (tab: CardTab) => string;
}

export function CardTabs({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragOver,
  onTabDrop,
  getTabLabel,
}: CardTabsProps) {
  const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = React.useState<string | null>(null);

  const handleDragStart = (tabId: string, e: React.DragEvent) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('tabId', tabId);
    onTabDragStart(tabId, e);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleDragOver = (targetTabId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(targetTabId);
    onTabDragOver(e);
  };

  const handleDrop = (targetTabId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTabId(null);
    onTabDrop(targetTabId, e);
  };

  const handleDragLeave = () => {
    setDragOverTabId(null);
  };

  if (tabs.length <= 1) {
    return null; // Don't show tabs if there's only one or none
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-border bg-accent/5 px-0.5 overflow-hidden">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isDragged = tab.id === draggedTabId;
        const isDragOver = tab.id === dragOverTabId;

        return (
          <TabLabel
            key={tab.id}
            tab={tab}
            isActive={isActive}
            isDragged={isDragged}
            isDragOver={isDragOver}
            onDragStart={(e) => handleDragStart(tab.id, e)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(tab.id, e)}
            onDrop={(e) => handleDrop(tab.id, e)}
            onDragLeave={handleDragLeave}
            onClick={() => onTabClick(tab.id)}
            onClose={(e) => onTabClose(tab.id, e)}
            getTabLabel={getTabLabel}
          />
        );
      })}
    </div>
  );
}

// Component to fetch and display market question for each tab
function TabLabel({
  tab,
  isActive,
  isDragged,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  onClick,
  onClose,
  getTabLabel,
}: {
  tab: CardTab;
  isActive: boolean;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  getTabLabel: (tab: CardTab) => string;
}) {
  const { getMarket } = useMarketStore();
  const [imageError, setImageError] = React.useState(false);
  
  // Get marketId from tab props
  const marketId = React.useMemo(() => {
    const singleMarketId = tab.props?.marketId as string | undefined;
    const marketIds = tab.props?.marketIds as string[] | undefined;
    
    // For chart cards, use first marketId from marketIds array
    if (marketIds && Array.isArray(marketIds) && marketIds.length > 0) {
      return marketIds[0];
    }
    
    return singleMarketId;
  }, [tab.props]);
  
  // Get all marketIds for multimarket case
  const allMarketIds = React.useMemo(() => {
    const singleMarketId = tab.props?.marketId as string | undefined;
    const marketIdsArray = tab.props?.marketIds as string[] | undefined;
    
    if (marketIdsArray && Array.isArray(marketIdsArray) && marketIdsArray.length > 0) {
      return marketIdsArray;
    }
    
    if (singleMarketId) {
      return [singleMarketId];
    }
    
    return [];
  }, [tab.props]);
  
  // Fetch market data for single market
  const { data: market } = useMarket(marketId || null);
  const storedMarket = marketId ? getMarket(marketId) : null;
  const displayMarket = market || storedMarket;
  
  // Fetch markets for multimarket case
  const markets = React.useMemo(() => {
    if (allMarketIds.length > 1) {
      return allMarketIds.map(id => getMarket(id)).filter(Boolean);
    }
    return [];
  }, [allMarketIds, getMarket]);
  
  // Get image URL - prefer event image for multimarkets, otherwise use market image
  const imageUrl = React.useMemo(() => {
    // For multimarkets, prefer event image
    if (markets.length > 1) {
      const eventImage = (markets[0] as any)?.eventImageUrl;
      if (eventImage) return eventImage;
    }
    
    // Use market image
    if (displayMarket?.imageUrl) return displayMarket.imageUrl;
    
    // For multimarkets, try first market's image
    if (markets.length > 0 && (markets[0] as any)?.imageUrl) {
      return (markets[0] as any).imageUrl;
    }
    
    return undefined;
  }, [displayMarket?.imageUrl, markets]);
  
  // Get label - prefer market question, fallback to getTabLabel
  const label = React.useMemo(() => {
    if (tab.label) return tab.label;
    if (displayMarket?.question) return displayMarket.question;
    return getTabLabel(tab);
  }, [tab.label, displayMarket?.question, getTabLabel, tab]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-0.5 py-1 text-xs font-medium cursor-pointer transition-colors relative group',
        'min-w-0 flex-shrink flex-1',
        'max-w-[200px] min-w-[60px]',
        isActive
          ? 'bg-background border-b-2 border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
        isDragged && 'opacity-50',
        isDragOver && 'bg-primary/20'
      )}
      title={label}
    >
      {imageUrl && !imageError && (
        <div className="flex-shrink-0 w-4 h-4 overflow-hidden border border-border bg-accent/20 rounded">
          <img
            src={imageUrl}
            alt=""
            draggable="false"
            className="w-full h-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        </div>
      )}
      <TruncatedText text={label} maxLength={20} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(e);
        }}
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 hover:text-destructive',
          'flex-shrink-0'
        )}
        title="Close tab"
        aria-label="Close tab"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Component to truncate text with two dots
function TruncatedText({ text, maxLength = 20 }: { text: string; maxLength?: number }) {
  // If text is short enough, don't truncate
  if (text.length <= maxLength) {
    return <span className="truncate min-w-0 flex-1">{text}</span>;
  }

  // Manually truncate with two dots
  const truncated = text.slice(0, maxLength) + '..';
  
  return (
    <span className="truncate min-w-0 flex-1" title={text}>
      {truncated}
    </span>
  );
}

