'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useLayoutStore, CardType } from '@/stores/layout-store';
import { useWorkspaces } from '@/lib/hooks/useWorkspace';
import { Card } from './Card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { 
  Star, 
  Plus, 
  TrendingUp, 
  BarChart3, 
  Search, 
  Shield, 
  Zap, 
  Settings 
} from 'lucide-react';
import { cardCategories, CardCategory, getCardInfo, getCardDescription } from '@/lib/card-categories';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ResponsiveGridLayout = WidthProvider(Responsive);

export function WorkspaceGrid() {
  const currentLayout = useLayoutStore((state) => state.currentLayout);
  const updateLayout = useLayoutStore((state) => state.updateLayout);
  const currentWorkspaceId = useLayoutStore((state) => state.currentWorkspaceId);
  const addCard = useLayoutStore((state) => state.addCard);
  const favouriteCardTypes = useLayoutStore((state) => state.favouriteCardTypes);
  const toggleFavouriteCardType = useLayoutStore((state) => state.toggleFavouriteCardType);
  const isFavouriteCardType = useLayoutStore((state) => state.isFavouriteCardType);
  const { data: workspaces = [] } = useWorkspaces();
  const gridRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false); // Track if we're currently resizing
  const isDraggingRef = useRef(false); // Track if we're currently dragging (CRITICAL: prevents card revert bug)
  
  const currentWorkspace = useMemo(
    () => workspaces.find((w: any) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );
  const isLocked = currentWorkspace?.locked || false;

  const handleAddCard = useCallback((type: CardType) => {
    if (isLocked) return;
    addCard({
      id: `card-${Date.now()}`,
      type,
    });
  }, [isLocked, addCard]);

  const rowHeight = 30;
  const margin: [number, number] = [4, 4];
  const containerPadding: [number, number] = [4, 4];

  // Only include non-minimized and non-maximized cards in the grid layout
  const gridCards = useMemo(
    () => currentLayout?.cards.filter((card) => !card.isMinimized && !card.isMaximized) || [],
    [currentLayout?.cards]
  );

  // Memoize layouts to prevent recalculation on every render
  const layouts = useMemo(
    () => ({
      lg: gridCards.map((card) => ({ ...card.layout, i: card.id })),
      md: gridCards.map((card) => ({ ...card.layout, i: card.id })),
      sm: gridCards.map((card) => ({ ...card.layout, i: card.id, w: Math.min(card.layout.w, 8) })),
      xs: gridCards.map((card) => ({ ...card.layout, i: card.id, w: Math.min(card.layout.w, 4) })),
    }),
    [gridCards]
  );

  // Memoize cards to render to prevent unnecessary re-renders
  const cardsToRender = useMemo(
    () => currentLayout?.cards.filter((card) => !card.isMaximized) || [],
    [currentLayout?.cards]
  );

  // Optimize drag handler with useCallback
  const handleDrag = useCallback((layout: any, oldItem: any, newItem: any, placeholder: any, e: any, element: any) => {
    // Allow dragging without constraints - vertical scrolling enabled
  }, [isLocked]);

  // Optimize layout change handler with debouncing
  const handleLayoutChange = useCallback((layout: any, layouts: any) => {
    if (!isLocked && layouts && layouts.lg) {
      // Don't update during resize - wait for resize to complete
      // This prevents intermediate values from being saved, which causes the revert bug
      if (isResizingRef.current) {
        return;
      }
      // CRITICAL BUG FIX: Don't update during drag - wait for drag to complete
      // This prevents cards from reverting to original position during drag
      if (isDraggingRef.current) {
        return;
      }
      
      // Update layout without constraints - vertical scrolling enabled
      updateLayout(layouts);
    }
  }, [isLocked, updateLayout]);

  // Track when resize starts
  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true;
  }, []);

  // Track when drag starts (CRITICAL: prevents card revert bug)
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // Optimize resize stop handler
  // This ensures the final layout state is properly saved after resize completes
  const handleResizeStop = useCallback((layout: any, oldItem: any, newItem: any, placeholder: any, e: any, element: any) => {
    // Mark that resize is complete
    isResizingRef.current = false;
    
    // After resize completes, ensure the layout is updated with the final state
    // Use setTimeout to ensure this happens after React Grid Layout has fully processed the resize
    setTimeout(() => {
      if (!isLocked && layout) {
        // Get the current layouts from React Grid Layout
        const currentLayouts = {
          lg: layout,
          md: layout,
          sm: layout,
          xs: layout,
        };
        
        // Update the store with the final layout state
        updateLayout(currentLayouts);
      }
    }, 0);
  }, [isLocked, updateLayout]);

  // CRITICAL BUG FIX: Handle drag stop to finalize layout and prevent card revert
  const handleDragStop = useCallback((layout: any, oldItem: any, newItem: any, placeholder: any, e: any, element: any) => {
    // Mark that drag is complete
    isDraggingRef.current = false;
    
    // After drag completes, ensure the layout is updated with the final state
    // Use setTimeout to ensure this happens after React Grid Layout has fully processed the drag
    setTimeout(() => {
      if (!isLocked && layout) {
        // Get the current layouts from React Grid Layout
        const currentLayouts = {
          lg: layout,
          md: layout,
          sm: layout,
          xs: layout,
        };
        
        // Update the store with the final layout state
        updateLayout(currentLayouts);
      }
    }, 0);
  }, [isLocked, updateLayout]);

  // Category icons mapping
  const categoryIcons: Record<CardCategory, typeof TrendingUp> = {
    'Trading': TrendingUp,
    'Analysis': BarChart3,
    'Research': Search,
    'Risk Management': Shield,
    'Automation': Zap,
    'Utilities': Settings,
  };

  // Early return after all hooks are called
  if (!currentLayout) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">No workspace selected</p>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          ref={gridRef}
          className="w-full min-h-full"
          style={{ position: 'relative' }}
        >
          <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 }}
        rowHeight={rowHeight}
        onDrag={handleDrag}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onLayoutChange={handleLayoutChange}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        isDraggable={!isLocked}
        isResizable={!isLocked}
        resizeHandles={['ne', 'nw', 'se', 'sw']}
        draggableHandle=".card-handle"
        margin={margin}
        containerPadding={containerPadding}
        verticalCompact={true}
        compactType="vertical"
      >
      {cardsToRender.map((card) => (
        <div key={card.id}>
          <Card card={card} />
        </div>
      ))}
      </ResponsiveGridLayout>
        </div>
      </ContextMenuTrigger>
      {!isLocked && (
        <TooltipProvider>
          <ContextMenuContent className="w-72">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Add Card</span>
              </div>
            </div>
            
            {/* Favourites section */}
            {favouriteCardTypes.length > 0 && (
              <>
                <div className="px-3 py-2">
                  <ContextMenuLabel className="px-0 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    Favourites
                  </ContextMenuLabel>
                </div>
                <div className="px-1">
                  {favouriteCardTypes.map((type) => {
                    const cardInfo = getCardInfo(type);
                    if (!cardInfo) return null;
                    
                    return (
                    <Tooltip key={type} delayDuration={300}>
                      <TooltipTrigger asChild>
                        <ContextMenuItem
                          onClick={() => handleAddCard(type)}
                          className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md mx-1"
                          onPointerEnter={(e) => e.stopPropagation()}
                          onPointerLeave={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                            <span className="text-sm truncate">{cardInfo.label}</span>
                          </div>
                          <Star
                            className="h-3.5 w-3.5 ml-2 fill-yellow-500 text-yellow-500 opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavouriteCardType(type);
                            }}
                          />
                        </ContextMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" sideOffset={8}>
                        <p className="max-w-xs">{getCardDescription(type)}</p>
                      </TooltipContent>
                    </Tooltip>
                    );
                  })}
                </div>
                <ContextMenuSeparator className="my-1" />
              </>
            )}
          
          {/* Categories */}
          <div className="py-1">
            {(['Trading', 'Analysis', 'Research', 'Risk Management', 'Automation', 'Utilities'] as CardCategory[]).map((category, categoryIndex) => {
              const categoryCards = cardCategories[category];
              if (!categoryCards) return null;
              const cards = categoryCards.filter(({ type }) => !isFavouriteCardType(type));
              if (cards.length === 0) return null;
              
              const CategoryIcon = categoryIcons[category];
              
              return (
                <div key={category}>
                  {categoryIndex > 0 && <ContextMenuSeparator className="my-1" />}
                  {cards.length === 1 ? (
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <ContextMenuItem
                          onClick={() => handleAddCard(cards[0].type)}
                          className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md mx-1"
                          onPointerEnter={(e) => e.stopPropagation()}
                          onPointerLeave={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{cards[0].label}</span>
                          </div>
                          <Star
                            className={`h-3.5 w-3.5 ml-2 cursor-pointer flex-shrink-0 transition-opacity ${
                              isFavouriteCardType(cards[0].type)
                                ? 'fill-yellow-500 text-yellow-500 opacity-100'
                                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavouriteCardType(cards[0].type);
                            }}
                          />
                        </ContextMenuItem>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" sideOffset={8}>
                        <p className="max-w-xs">{getCardDescription(cards[0].type)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="cursor-pointer px-2 py-2.5 rounded-md mx-1">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{category}</span>
                        </div>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-56">
                        {cards.map(({ type, label }) => (
                          <Tooltip key={type} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <ContextMenuItem
                                onClick={() => handleAddCard(type)}
                                className="cursor-pointer flex items-center justify-between group px-2 py-2.5 rounded-md"
                                onPointerEnter={(e) => e.stopPropagation()}
                                onPointerLeave={(e) => e.stopPropagation()}
                              >
                                <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
                                <Star
                                  className={`h-3.5 w-3.5 ml-2 cursor-pointer flex-shrink-0 transition-opacity ${
                                    isFavouriteCardType(type)
                                      ? 'fill-yellow-500 text-yellow-500 opacity-100'
                                      : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFavouriteCardType(type);
                                  }}
                                />
                              </ContextMenuItem>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="start" sideOffset={8}>
                              <p className="max-w-xs">{getCardDescription(type)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                </div>
              );
            })}
          </div>
          </ContextMenuContent>
        </TooltipProvider>
      )}
    </ContextMenu>
  );
}

