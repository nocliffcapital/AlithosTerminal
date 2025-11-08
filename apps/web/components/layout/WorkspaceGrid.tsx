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
import { Star } from 'lucide-react';
import { cardCategories, CardCategory, getCardInfo } from '@/lib/card-categories';

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
  const [maxRows, setMaxRows] = useState<number | null>(null);
  const isResizingRef = useRef(false); // Track if we're currently resizing
  const isDraggingRef = useRef(false); // Track if we're currently dragging (CRITICAL: prevents card revert bug)
  const lastMaxRowsRef = useRef<number | null>(null); // Track last calculated value to prevent infinite loops
  
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
  const margin: [number, number] = [12, 12];
  const containerPadding: [number, number] = [12, 12];

  // Calculate maximum rows that fit in viewport
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const calculateMaxRows = () => {
      if (!gridRef.current) return;
      
      // Get the grid container's parent (the flex-1 overflow-hidden div)
      const gridContainer = gridRef.current.parentElement;
      if (!gridContainer) return;
      
      // Get the actual available height from the container
      const containerHeight = gridContainer.clientHeight;
      
      // Available height for grid (accounting for container padding)
      const availableHeight = containerHeight - (containerPadding[1] * 2);
      
      // Calculate max rows: (availableHeight) / (rowHeight + vertical margin)
      const calculatedMaxRows = Math.max(Math.floor(availableHeight / (rowHeight + margin[1])), 5); // Minimum 5 rows
      
      // Only update if the value actually changed to prevent infinite loops
      if (calculatedMaxRows !== lastMaxRowsRef.current) {
        lastMaxRowsRef.current = calculatedMaxRows;
        setMaxRows(calculatedMaxRows);
      }
    };

    // Debounced version for ResizeObserver to prevent excessive updates
    const debouncedCalculateMaxRows = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        calculateMaxRows();
      }, 100); // 100ms debounce
    };

    // Calculate initially
    calculateMaxRows();
    
    // Recalculate on window resize (debounced)
    const handleResize = () => {
      debouncedCalculateMaxRows();
    };
    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver to watch for container size changes (debounced)
    const resizeObserver = new ResizeObserver(() => {
      debouncedCalculateMaxRows();
    });
    
    if (gridRef.current?.parentElement) {
      resizeObserver.observe(gridRef.current.parentElement);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [rowHeight, margin, containerPadding]);

  // Adjust layout to ensure all cards fit within maxRows
  // Automatically resizes cards that extend beyond viewport
  const adjustLayout = useCallback((layoutArray: any[]): any[] => {
    if (!maxRows) return layoutArray; // Return unchanged if maxRows not calculated yet
    
    return layoutArray.map((item: any) => {
      // If card extends beyond maxRows, automatically adjust it
      if (item.y + item.h > maxRows) {
        // Calculate maximum height available at this Y position
        const maxHeight = maxRows - item.y;
        
        // Automatically resize the card to fit
        return {
          ...item,
          h: Math.max(2, maxHeight), // Minimum height of 2 rows, shrink to fit otherwise
        };
      }
      return item;
    });
  }, [maxRows]);

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
      sm: gridCards.map((card) => ({ ...card.layout, i: card.id, w: Math.min(card.layout.w, 4) })),
      xs: gridCards.map((card) => ({ ...card.layout, i: card.id, w: Math.min(card.layout.w, 2) })),
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
    // Constrain dragging in real-time - automatically resize if needed
    if (!isLocked && maxRows) {
      // If the item being dragged would extend beyond maxRows
      if (newItem.y + newItem.h > maxRows) {
        // Calculate maximum height available at this Y position
        const maxHeight = maxRows - newItem.y;
        
        // Automatically resize the card being dragged to fit
        if (newItem.h > maxHeight) {
          newItem.h = Math.max(2, maxHeight);
        }
        
        // Also constrain Y position to ensure it fits
        const maxY = maxRows - newItem.h;
        newItem.y = Math.max(0, Math.min(newItem.y, maxY));
      }
    }
  }, [isLocked, maxRows]);

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
      
      // Adjust layout to ensure all cards fit within viewport
      const layoutArray = layouts.lg || layouts.md || layouts.sm || layouts.xs || [];
      const adjustedLayout = adjustLayout(layoutArray);
      
      // Update layouts with adjusted positions
      const adjustedLayouts = {
        ...layouts,
        lg: adjustedLayout,
        md: adjustedLayout,
        sm: adjustedLayout,
        xs: adjustedLayout,
      };
      
      updateLayout(adjustedLayouts);
    }
  }, [isLocked, adjustLayout, updateLayout]);

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
    // Adjust resized cards to fit within viewport
    if (!isLocked && maxRows) {
      if (newItem.y + newItem.h > maxRows) {
        // Constrain the height to fit
        const maxHeight = maxRows - newItem.y;
        newItem.h = Math.max(2, Math.min(newItem.h, maxHeight));
      }
    }
    
    // Mark that resize is complete
    isResizingRef.current = false;
    
    // After resize completes, ensure the layout is updated with the final state
    // Use setTimeout to ensure this happens after React Grid Layout has fully processed the resize
    setTimeout(() => {
      if (!isLocked && layout) {
        // Adjust layout to ensure all cards fit within viewport
        const adjustedLayout = adjustLayout(layout);
        
        // Get the current layouts from React Grid Layout
        const currentLayouts = {
          lg: adjustedLayout,
          md: adjustedLayout,
          sm: adjustedLayout,
          xs: adjustedLayout,
        };
        
        // Update the store with the final layout state
        updateLayout(currentLayouts);
      }
    }, 0);
  }, [isLocked, maxRows, updateLayout, adjustLayout]);

  // CRITICAL BUG FIX: Handle drag stop to finalize layout and prevent card revert
  const handleDragStop = useCallback((layout: any, oldItem: any, newItem: any, placeholder: any, e: any, element: any) => {
    // Mark that drag is complete
    isDraggingRef.current = false;
    
    // After drag completes, ensure the layout is updated with the final state
    // Use setTimeout to ensure this happens after React Grid Layout has fully processed the drag
    setTimeout(() => {
      if (!isLocked && layout) {
        // Adjust layout to ensure all cards fit within viewport
        const adjustedLayout = adjustLayout(layout);
        
        // Get the current layouts from React Grid Layout
        const currentLayouts = {
          lg: adjustedLayout,
          md: adjustedLayout,
          sm: adjustedLayout,
          xs: adjustedLayout,
        };
        
        // Update the store with the final layout state
        updateLayout(currentLayouts);
      }
    }, 0);
  }, [isLocked, updateLayout, adjustLayout]);

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
          className="h-full w-full"
          style={{ position: 'relative' }}
        >
          <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
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
        <ContextMenuContent className="w-64">
          <ContextMenuItem disabled className="text-xs text-muted-foreground">
            Add Card
          </ContextMenuItem>
          <ContextMenuSeparator />
          
          {/* Favourites section */}
          {favouriteCardTypes.length > 0 && (
            <>
              <ContextMenuLabel>Favourites</ContextMenuLabel>
              {favouriteCardTypes.map((type) => {
                const cardInfo = getCardInfo(type);
                if (!cardInfo) return null;
                
                return (
                  <ContextMenuItem
                    key={type}
                    onClick={() => handleAddCard(type)}
                    className="cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center">
                      <Star className="h-3.5 w-3.5 mr-2 fill-yellow-500 text-yellow-500" />
                      {cardInfo.label}
                    </div>
                    <Star
                      className="h-3.5 w-3.5 ml-2 fill-yellow-500 text-yellow-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavouriteCardType(type);
                      }}
                    />
                  </ContextMenuItem>
                );
              })}
              <ContextMenuSeparator />
            </>
          )}
          
          {/* Categories */}
          {(['Trading', 'Analysis', 'Research', 'Risk Management', 'Automation', 'Team', 'Utilities'] as CardCategory[]).map((category, categoryIndex) => {
            const cards = cardCategories[category].filter(({ type }) => !isFavouriteCardType(type));
            if (cards.length === 0) return null;
            
            return (
              <div key={category}>
                {categoryIndex > 0 && <ContextMenuSeparator />}
                {cards.length === 1 ? (
                  <ContextMenuItem
                    onClick={() => handleAddCard(cards[0].type)}
                    className="cursor-pointer flex items-center justify-between group"
                  >
                    <span>{cards[0].label}</span>
                    <Star
                      className={`h-3.5 w-3.5 ml-2 cursor-pointer ${
                        isFavouriteCardType(cards[0].type)
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavouriteCardType(cards[0].type);
                      }}
                    />
                  </ContextMenuItem>
                ) : (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger className="cursor-pointer">
                      {category}
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {cards.map(({ type, label }) => (
                        <ContextMenuItem
                          key={type}
                          onClick={() => handleAddCard(type)}
                          className="cursor-pointer flex items-center justify-between group"
                        >
                          <span>{label}</span>
                          <Star
                            className={`h-3.5 w-3.5 ml-2 cursor-pointer ${
                              isFavouriteCardType(type)
                                ? 'fill-yellow-500 text-yellow-500'
                                : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavouriteCardType(type);
                            }}
                          />
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
              </div>
            );
          })}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

