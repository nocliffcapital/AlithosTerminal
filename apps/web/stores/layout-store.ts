import { create } from 'zustand';
import { Layout, Layouts } from 'react-grid-layout';
import type { ReactNode } from 'react';

export type CardType =
  | 'watchlist'
  | 'tape'
  | 'quick-ticket'
  | 'order-creator'
  | 'depth'
  | 'orderbook'
  | 'scenario-builder'
  | 'exposure-tree'
  | 'activity-scanner'
  | 'resolution-criteria'
  | 'chart'
  | 'tradingview-chart'
  | 'correlation-matrix'
  | 'market-discovery'
  | 'market-info'
  | 'market-research'
  | 'news'
  | 'positions'
  | 'transaction-history'
  | 'order-history'
  | 'team-management'
  | 'journal'
  | 'comments'
  | 'kelly-calculator'
  | 'position-sizing'
  | 'price-converter'
  | 'market-trade';

export interface CardTab {
  id: string;
  label?: string; // Optional label, defaults to market question or card type
  props: Record<string, unknown>;
}

export interface CardConfig {
  id: string;
  type: CardType;
  layout: Layout;
  props?: Record<string, unknown>;
  isMinimized?: boolean;
  isMaximized?: boolean;
  tabs?: CardTab[]; // Array of tabs for this card
  activeTabId?: string; // ID of the currently active tab
  linkGroupId?: string; // ID of the link group this card belongs to (optional)
}

// Color palette for link groups - distinct colors that work well in dark mode
export const LINK_GROUP_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
] as const;

export interface LinkGroup {
  id: string;
  cardIds: string[]; // Array of card IDs that are linked together
  name?: string; // Optional name for the link group
  color: string; // Color for visual identification
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  cards: CardConfig[];
  _lastLoaded?: number; // Timestamp when layout was loaded from DB
  _lastSaved?: string; // Serialized version of last saved layout for comparison
}

interface LayoutState {
  currentWorkspaceId: string | null;
  userId: string | null;
  workspaces: Record<string, WorkspaceLayout>;
  currentLayout: WorkspaceLayout | null;
  _pendingFetches: Map<string, Promise<WorkspaceLayout | null>>; // Deduplicate simultaneous fetches
  favouriteCardTypes: CardType[]; // User's favourite card types
  linkGroups: Record<string, LinkGroup>; // Link groups for the current workspace
  setCurrentWorkspace: (id: string) => Promise<void>;
  setUserId: (userId: string) => void;
  updateLayout: (layout: Layouts) => void;
  addCard: (card: Omit<CardConfig, 'layout'>) => void;
  removeCard: (cardId: string) => void;
  updateCardProps: (cardId: string, props: Record<string, unknown>) => void;
  minimizeCard: (cardId: string) => void;
  maximizeCard: (cardId: string) => void;
  restoreCard: (cardId: string) => void;
  saveLayout: () => Promise<void>;
  _saveLayoutIfChanged: () => Promise<void>; // Helper to save only if changed
  loadLayout: (id: string) => Promise<void>;
  hasLayoutChanged: (layout: WorkspaceLayout) => Promise<boolean>;
  toggleFavouriteCardType: (type: CardType) => boolean;
  isFavouriteCardType: (type: CardType) => boolean;
  loadFavouriteCardTypes: () => void;
  // Tab management
  addTab: (cardId: string, tab: CardTab) => void;
  removeTab: (cardId: string, tabId: string) => void;
  switchTab: (cardId: string, tabId: string) => void;
  moveTab: (sourceCardId: string, sourceTabId: string, targetCardId: string, targetIndex?: number) => void;
  updateTabProps: (cardId: string, tabId: string, props: Record<string, unknown>) => void;
  // Link management
  createLinkGroup: (cardIds: string[], name?: string, color?: string) => string; // Returns link group ID
  addCardToLinkGroup: (cardId: string, linkGroupId: string) => void;
  removeCardFromLinkGroup: (cardId: string) => void;
  removeLinkGroup: (linkGroupId: string) => void;
  getLinkGroup: (linkGroupId: string) => LinkGroup | undefined;
  getCardLinkGroup: (cardId: string) => LinkGroup | undefined;
  getLinkedCards: (cardId: string) => string[]; // Returns all card IDs linked to this card
  // Link selection mode
  linkSelectionMode: boolean;
  selectedCardIdsForLinking: Set<string>;
  startLinkSelection: (initialCardId: string) => void;
  toggleCardSelection: (cardId: string) => void;
  clearLinkSelection: () => void;
  confirmLinkSelection: (name?: string, color?: string) => string | null; // Returns link group ID or null
}

const defaultCardLayout = (index: number): Layout => ({
  i: `card-${index}`,
  x: (index % 3) * 4,
  y: Math.floor(index / 3) * 6,
  w: 4,
  h: 6,
  minW: 2,
  minH: 3,
});

// Load favourites from localStorage
const loadFavouritesFromStorage = (): CardType[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('favouriteCardTypes');
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.warn('[LayoutStore] Failed to load favourite card types from localStorage:', error);
  }
  return [];
};

// Save favourites to localStorage
const saveFavouritesToStorage = (favourites: CardType[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('favouriteCardTypes', JSON.stringify(favourites));
  } catch (error) {
    console.warn('[LayoutStore] Failed to save favourite card types to localStorage:', error);
  }
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  currentWorkspaceId: null,
  userId: null,
  workspaces: {},
  currentLayout: null,
  _pendingFetches: new Map(),
  favouriteCardTypes: loadFavouritesFromStorage(),
  linkGroups: {},
  linkSelectionMode: false,
  selectedCardIdsForLinking: new Set<string>(),

  setUserId: (userId: string) => {
    set({ userId });
  },

  setCurrentWorkspace: async (id) => {
    const currentWorkspaceId = get().currentWorkspaceId;
    const currentLayout = get().currentLayout;
    const workspaces = get().workspaces;
    
    // If we're already on this workspace and have a layout, don't reload
    if (currentWorkspaceId === id && currentLayout) {
      return;
    }
    
    // Save current workspace layout before switching (non-blocking, only if it has changed)
    if (currentWorkspaceId && currentLayout && currentLayout.cards.length > 0) {
      // Don't await - let save run in background without blocking workspace switch
      get()._saveLayoutIfChanged().catch(() => {
        // Silent fail - we'll save on next switch or unmount
      });
    }
    
    // Check if layout is already cached in memory and recent (less than 5 minutes old)
    let layout = workspaces[id];
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (increased from 30 seconds)
    
    if (layout && layout._lastLoaded && (Date.now() - layout._lastLoaded < CACHE_TTL)) {
      // Use cached version - skip DB fetch
      set({
        currentWorkspaceId: id,
        currentLayout: layout,
      });
      return;
    }
    
    // Check for pending fetch to deduplicate simultaneous requests
    const pendingFetch = get()._pendingFetches.get(id);
    if (pendingFetch) {
      // Wait for existing fetch to complete
      const fetchedLayout = await pendingFetch;
      if (fetchedLayout) {
        set({
          currentWorkspaceId: id,
          currentLayout: fetchedLayout,
        });
        return;
      }
    }
    
    // Create fetch promise for deduplication
    const fetchPromise = (async (): Promise<WorkspaceLayout | null> => {
      try {
        const response = await fetch(`/api/layouts?workspaceId=${id}`);
        if (response.ok) {
          const data = await response.json();
          const savedLayouts = data.layouts || [];
          
          // Find default layout or use first one (most recent)
          const savedLayout = savedLayouts.find((l: any) => l.isDefault) || savedLayouts[0];
          
          if (savedLayout && savedLayout.config) {
            const layoutConfig = savedLayout.config as WorkspaceLayout;
            const loadedLayout: WorkspaceLayout = {
              id: savedLayout.id,
              name: savedLayout.name || 'Default Layout',
              // Ensure cards have proper layout structure with saved positions
              // Filter out removed cards (alerts and theme-editor) that have been moved to Settings
              cards: (layoutConfig.cards || [])
                .filter((card: CardConfig) => (card.type as string) !== 'alerts' && (card.type as string) !== 'theme-editor')
                .map((card: CardConfig) => ({
                  ...card,
                  layout: {
                    ...card.layout,
                    i: card.id, // Ensure 'i' matches card id
                  },
                })),
              _lastLoaded: Date.now(),
            };
            
            // Cache the layout
            set((state) => ({
              workspaces: {
                ...state.workspaces,
                [id]: loadedLayout,
              },
            }));
            
            return loadedLayout;
          }
        }
      } catch (error) {
        console.error('Failed to load layout from database:', error);
      }
      
      return null;
    })();
    
    // Store fetch promise for deduplication
    get()._pendingFetches.set(id, fetchPromise);
    
    // Wait for fetch to complete
    const fetchedLayout = await fetchPromise;
    
    // Clean up pending fetch
    get()._pendingFetches.delete(id);
    
    // If layout was fetched, use it
    if (fetchedLayout) {
      layout = fetchedLayout;
    }
    
    // If layout exists in memory but not from DB, use memory version
    if (!layout) {
      layout = workspaces[id];
    }
    
    // If no layout exists after trying to load, create a default one with a few starter cards
    if (!layout) {
      console.log('[setCurrentWorkspace] No layout found, creating default layout for workspace:', id);
      const defaultCards: CardConfig[] = [
        {
          id: 'watchlist-1',
          type: 'watchlist',
          layout: { i: 'watchlist-1', x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
        },
        {
          id: 'tape-1',
          type: 'tape',
          layout: { i: 'tape-1', x: 4, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
        },
        {
          id: 'quick-ticket-1',
          type: 'quick-ticket',
          layout: { i: 'quick-ticket-1', x: 8, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
        },
      ];
      
      layout = {
        id: `layout-${id}`,
        name: 'Default Layout',
        cards: defaultCards,
        _lastLoaded: Date.now(),
      };
      
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [id]: layout,
        },
      }));
    }
    
    // If layout exists but has no cards, add default cards
    if (layout && (!layout.cards || layout.cards.length === 0)) {
      const defaultCards: CardConfig[] = [
        {
          id: 'watchlist-1',
          type: 'watchlist',
          layout: { i: 'watchlist-1', x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
        },
        {
          id: 'tape-1',
          type: 'tape',
          layout: { i: 'tape-1', x: 4, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
        },
      ];
      
      layout = {
        ...layout,
        cards: defaultCards,
      };
      
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [id]: layout,
        },
      }));
    }
    
    // Ensure _lastLoaded is set
    if (layout && !layout._lastLoaded) {
      layout._lastLoaded = Date.now();
    }
    
    // Always set the workspace, even if layout is null (will show empty workspace)
    // This ensures the workspace is selected and the UI updates
    console.log('[setCurrentWorkspace] Setting workspace:', id, 'layout:', layout ? 'exists' : 'null');
    set({
      currentWorkspaceId: id,
      currentLayout: layout || null,
    });
  },

  updateLayout: (layouts: Layouts) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    if (!currentLayout) return;

    // React-grid-layout passes layouts keyed by breakpoint (lg, md, sm, xs)
    // Each breakpoint contains an array of layout items with { i, x, y, w, h }
    const layoutArray = layouts.lg || layouts.md || layouts.sm || layouts.xs || [];
    
    // Create a map of card id -> layout for quick lookup
    const layoutMap = new Map<string, Layout>();
    if (Array.isArray(layoutArray)) {
      layoutArray.forEach((item: any) => {
        if (item && item.i) {
          layoutMap.set(item.i, {
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: item.minW,
            minH: item.minH,
          });
        }
      });
    }

    // Update cards with their new layouts
    const updatedCards = currentLayout.cards.map((card) => {
      const newLayout = layoutMap.get(card.id);
      if (newLayout) {
        return { ...card, layout: newLayout };
      }
      return card;
    });

    const updatedLayout = { ...currentLayout, cards: updatedCards };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after layout update with debouncing (increased to 2-3 seconds)
    // Clear any pending save timeout
    if ((get() as any).saveTimeout) {
      clearTimeout((get() as any).saveTimeout);
    }
    
    // Set new timeout for saving (increased debounce to 2.5 seconds)
    const timeout = setTimeout(() => {
      get().saveLayout().catch((err) => {
        console.error('Failed to auto-save layout:', err);
      });
      (get() as any).saveTimeout = null;
    }, 2500); // 2.5 seconds debounce (increased from 500ms)
    
    (get() as any).saveTimeout = timeout;
  },

  addCard: (card) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    // If no layout exists but we have a workspace, create a default layout
    if (!currentLayout && currentWorkspaceId) {
      const defaultLayout: WorkspaceLayout = {
        id: `layout-${currentWorkspaceId}`,
        name: 'Default Layout',
        cards: [],
      };
      set({
        currentLayout: defaultLayout,
        workspaces: {
          ...get().workspaces,
          [currentWorkspaceId]: defaultLayout,
        },
      });
      // Recursively call with the new layout
      return get().addCard(card);
    }
    
    if (!currentLayout) {
      console.warn('Cannot add card: no workspace selected');
      return;
    }

    const index = currentLayout.cards.length;
    const newCard: CardConfig = {
      ...card,
      layout: defaultCardLayout(index),
    };

    const updatedLayout = {
      ...currentLayout,
      cards: [...currentLayout.cards, newCard],
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Save layout immediately (only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  removeCard: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    set({
      currentLayout: {
        ...currentLayout,
        cards: currentLayout.cards.filter((c) => c.id !== cardId),
      },
    });
    
    // Auto-save after removing card (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  updateCardProps: (cardId, props) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    // Find the card to determine its type
    const card = currentLayout.cards.find(c => c.id === cardId);
    if (!card) return;

    // For chart cards, ensure marketId and marketIds are synchronized
    // If marketIds is being set, clear marketId (chart cards use marketIds)
    // If marketId is being set and it's a chart card, convert to marketIds
    const normalizedProps = { ...props };
    if (card.type === 'chart') {
      if (normalizedProps.marketIds !== undefined) {
        // Chart card: use marketIds, clear marketId
        normalizedProps.marketId = undefined;
      } else if (normalizedProps.marketId !== undefined) {
        // Chart card: convert marketId to marketIds array
        normalizedProps.marketIds = normalizedProps.marketId ? [normalizedProps.marketId] : [];
        normalizedProps.marketId = undefined;
      }
    } else {
      // Non-chart cards: use marketId, clear marketIds
      if (normalizedProps.marketId !== undefined) {
        normalizedProps.marketIds = undefined;
      }
    }

    // Update the card's props
    const updatedCards = currentLayout.cards.map((c) => {
      if (c.id === cardId) {
        const newProps = { ...c.props, ...normalizedProps };
        // Remove undefined values to clean up props
        Object.keys(newProps).forEach(key => {
          if (newProps[key] === undefined) {
            delete newProps[key];
          }
        });
        return { ...c, props: newProps };
      }
      return c;
    });

    // Check if this card is in a link group and if marketId is being updated
    const updatedCard = updatedCards.find(c => c.id === cardId);
    const linkGroup = updatedCard?.linkGroupId ? get().linkGroups[updatedCard.linkGroupId] : undefined;
    
    // If marketId or marketIds is being updated and card is in a link group, update all linked cards
    if (linkGroup && (normalizedProps.marketId !== undefined || normalizedProps.marketIds !== undefined)) {
      const linkedCardIds = linkGroup.cardIds.filter(id => id !== cardId);
      linkedCardIds.forEach(linkedCardId => {
        const linkedCardIndex = updatedCards.findIndex(c => c.id === linkedCardId);
        if (linkedCardIndex >= 0) {
          const linkedCard = updatedCards[linkedCardIndex];
          const linkedCardProps = { ...linkedCard.props };
          
          // Sync the market selection to linked cards based on their type
          if (linkedCard.type === 'chart') {
            // Chart cards use marketIds
            if (normalizedProps.marketIds !== undefined) {
              linkedCardProps.marketIds = normalizedProps.marketIds;
              linkedCardProps.marketId = undefined;
            } else if (normalizedProps.marketId !== undefined) {
              linkedCardProps.marketIds = normalizedProps.marketId ? [normalizedProps.marketId] : [];
              linkedCardProps.marketId = undefined;
            }
          } else {
            // Other cards use marketId
            if (normalizedProps.marketId !== undefined) {
              linkedCardProps.marketId = normalizedProps.marketId;
              linkedCardProps.marketIds = undefined;
            } else if (normalizedProps.marketIds !== undefined && Array.isArray(normalizedProps.marketIds) && normalizedProps.marketIds.length > 0) {
              linkedCardProps.marketId = normalizedProps.marketIds[0] as string;
              linkedCardProps.marketIds = undefined;
            }
          }
          
          // Remove undefined values
          Object.keys(linkedCardProps).forEach(key => {
            if (linkedCardProps[key] === undefined) {
              delete linkedCardProps[key];
            }
          });
          
          updatedCards[linkedCardIndex] = {
            ...linkedCard,
            props: linkedCardProps,
          };
        }
      });
    }

    set({
      currentLayout: {
        ...currentLayout,
        cards: updatedCards,
      },
    });
    
    // Auto-save after updating props (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  minimizeCard: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    set({
      currentLayout: {
        ...currentLayout,
        cards: currentLayout.cards.map((c) =>
          c.id === cardId ? { ...c, isMinimized: true, isMaximized: false } : c
        ),
      },
    });
  },

  maximizeCard: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    set({
      currentLayout: {
        ...currentLayout,
        cards: currentLayout.cards.map((c) =>
          c.id === cardId ? { ...c, isMaximized: true, isMinimized: false } : c
        ),
      },
    });
  },

  restoreCard: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    set({
      currentLayout: {
        ...currentLayout,
        cards: currentLayout.cards.map((c) => {
          if (c.id === cardId) {
            // Preserve layout dimensions when restoring - ensure they're not too small
            const preservedLayout = { ...c.layout };
            // If layout dimensions are suspiciously small, restore to defaults
            if (preservedLayout.w < 2 || preservedLayout.h < 3) {
              preservedLayout.w = 4;
              preservedLayout.h = 6;
            }
            return { ...c, isMinimized: false, isMaximized: false, layout: preservedLayout };
          }
          return c;
        }),
      },
    });
  },

  hasLayoutChanged: async (layout: WorkspaceLayout): Promise<boolean> => {
    // Compare current layout with last saved version
    const currentSaved = layout._lastSaved;
    if (!currentSaved) {
      // No saved version exists, so it has changed
      return true;
    }
    
    // Serialize current layout for comparison (excluding metadata)
    const { _lastLoaded, _lastSaved, ...layoutToCompare } = layout;
    const serialized = JSON.stringify(layoutToCompare);
    
    // Compare with last saved version
    return serialized !== currentSaved;
  },

  // Helper function to save layout only if it has changed
  _saveLayoutIfChanged: async () => {
    const { currentLayout, currentWorkspaceId, userId } = get();
    if (!currentLayout || !currentWorkspaceId) {
      return; // Silent return - no need to warn
    }

    // Check if layout has actually changed before saving
    const hasChanged = await get().hasLayoutChanged(currentLayout);
    if (!hasChanged) {
      // Layout hasn't changed, skip save
      return;
    }

    // Check for pending save to prevent duplicate simultaneous saves
    const pendingSaveKey = `${currentWorkspaceId}-save`;
    const pendingSave = (get() as any)._pendingSaves?.get(pendingSaveKey);
    if (pendingSave) {
      // Wait for existing save to complete
      await pendingSave;
      return;
    }

    // Call the actual save function
    await get().saveLayout();
  },

  saveLayout: async () => {
    const { currentLayout, currentWorkspaceId, userId } = get();
    if (!currentLayout || !currentWorkspaceId) {
      console.warn('Cannot save layout: missing workspace or layout');
      return;
    }

    // Check if layout has actually changed before saving
    const hasChanged = await get().hasLayoutChanged(currentLayout);
    if (!hasChanged) {
      // Layout hasn't changed, skip save
      return;
    }

    // If no userId is set, try to get it from the auth hook
    let actualUserId = userId;
    if (!actualUserId) {
      // We'll need to set userId from the page component
      console.warn('No userId set in layout store - layout not saved');
      return;
    }

    // Serialize layout for comparison (excluding metadata)
    const { _lastLoaded, _lastSaved, ...layoutToSave } = currentLayout;
    const serializedLayout = JSON.stringify(layoutToSave);

    // Check for pending save to deduplicate simultaneous saves
    const pendingSaveKey = `${currentWorkspaceId}-save`;
    const pendingSave = (get() as any)._pendingSaves?.get(pendingSaveKey);
    if (pendingSave) {
      // Wait for existing save to complete
      await pendingSave;
      return;
    }

    // Create save promise for deduplication
    const savePromise = (async () => {
      try {
        const response = await fetch(`/api/layouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            userId: actualUserId,
            name: currentLayout.name || 'Default Layout',
            config: layoutToSave,
            isDefault: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to save layout:', errorData.error || response.statusText);
          throw new Error(errorData.error || 'Failed to save layout');
        }
        
        const data = await response.json();
        
        // Update the layout with the saved ID and mark as saved
        const updatedLayout = {
          ...currentLayout,
          id: data.layout?.id || currentLayout.id,
          _lastSaved: serializedLayout,
        };
        
        set({
          currentLayout: updatedLayout,
          workspaces: {
            ...get().workspaces,
            [currentWorkspaceId]: updatedLayout,
          },
        });
      } finally {
        // Clean up pending save
        (get() as any)._pendingSaves?.delete(pendingSaveKey);
      }
    })();

    // Store save promise for deduplication
    if (!(get() as any)._pendingSaves) {
      (get() as any)._pendingSaves = new Map();
    }
    (get() as any)._pendingSaves.set(pendingSaveKey, savePromise);
    
    await savePromise;
  },

  loadLayout: async (id: string) => {
    try {
      const response = await fetch(`/api/layouts/${id}`);
      if (!response.ok) {
        console.error('Failed to load layout');
        return;
      }

      const data = await response.json();
      const layoutConfig = data.layout?.config || data.config;
      const layout: WorkspaceLayout = {
        id: data.layout?.id || data.id,
        name: data.layout?.name || data.name,
        cards: layoutConfig?.cards || [],
      };

      const currentWorkspaceId = get().currentWorkspaceId;
      
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          ...(layout.id && { [layout.id]: layout }),
          ...(currentWorkspaceId && { [currentWorkspaceId]: layout }),
        },
        currentLayout: layout,
      }));
    } catch (error) {
      console.error('Error loading layout:', error);
    }
  },

  toggleFavouriteCardType: (type: CardType) => {
    const currentFavourites = get().favouriteCardTypes;
    const isFavourite = currentFavourites.includes(type);
    
    const newFavourites = isFavourite
      ? currentFavourites.filter(t => t !== type)
      : [...currentFavourites, type];
    
    set({ favouriteCardTypes: newFavourites });
    saveFavouritesToStorage(newFavourites);
    return !isFavourite; // Return true if added, false if removed
  },

  isFavouriteCardType: (type: CardType) => {
    return get().favouriteCardTypes.includes(type);
  },

  loadFavouriteCardTypes: () => {
    const favourites = loadFavouritesFromStorage();
    set({ favouriteCardTypes: favourites });
  },

  // Tab management functions
  addTab: (cardId, tab) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    if (!currentLayout) return;

    const updatedCards = currentLayout.cards.map(card => {
      if (card.id === cardId) {
        const existingTabs = card.tabs || [];
        // If this is the first tab, convert current props to a tab
        if (existingTabs.length === 0 && card.props) {
          const firstTab: CardTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            props: { ...card.props },
          };
          return {
            ...card,
            tabs: [firstTab, tab],
            activeTabId: tab.id,
            props: undefined, // Clear props since we're using tabs now
          };
        }
        return {
          ...card,
          tabs: [...existingTabs, tab],
          activeTabId: tab.id,
        };
      }
      return card;
    });

    const updatedLayout = {
      ...currentLayout,
      cards: updatedCards,
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after adding tab (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  removeTab: (cardId, tabId) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    if (!currentLayout) return;

    const updatedCards = currentLayout.cards.map(card => {
      if (card.id === cardId) {
        const existingTabs = card.tabs || [];
        const filteredTabs = existingTabs.filter(tab => tab.id !== tabId);
        
        // If no tabs left, convert back to props
        if (filteredTabs.length === 0) {
          return {
            ...card,
            tabs: undefined,
            activeTabId: undefined,
            props: {},
          };
        }
        
        // If removing active tab, switch to first remaining tab
        const newActiveTabId = card.activeTabId === tabId 
          ? filteredTabs[0]?.id 
          : card.activeTabId;
        
        return {
          ...card,
          tabs: filteredTabs,
          activeTabId: newActiveTabId,
        };
      }
      return card;
    });

    const updatedLayout = {
      ...currentLayout,
      cards: updatedCards,
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after removing tab (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  switchTab: (cardId, tabId) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    if (!currentLayout) return;

    const updatedCards = currentLayout.cards.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          activeTabId: tabId,
        };
      }
      return card;
    });

    const updatedLayout = {
      ...currentLayout,
      cards: updatedCards,
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after switching tab (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  moveTab: (sourceCardId, sourceTabId, targetCardId, targetIndex) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    if (!currentLayout) return;

    let sourceTab: CardTab | null = null;
    let sourceCard: CardConfig | null = null;

    // Find and remove tab from source card
    const cardsAfterRemove = currentLayout.cards.map(card => {
      if (card.id === sourceCardId) {
        const existingTabs = card.tabs || [];
        const tabIndex = existingTabs.findIndex(tab => tab.id === sourceTabId);
        if (tabIndex !== -1) {
          sourceTab = existingTabs[tabIndex];
          sourceCard = card;
          const filteredTabs = existingTabs.filter(tab => tab.id !== sourceTabId);
          
          // If no tabs left, convert back to props
          if (filteredTabs.length === 0) {
            return {
              ...card,
              tabs: undefined,
              activeTabId: undefined,
              props: {},
            };
          }
          
          // If moving active tab, switch to first remaining tab
          const newActiveTabId = card.activeTabId === sourceTabId 
            ? filteredTabs[0]?.id 
            : card.activeTabId;
          
          return {
            ...card,
            tabs: filteredTabs,
            activeTabId: newActiveTabId,
          };
        }
      }
      return card;
    });

    if (!sourceTab || !sourceCard) return;

    // Add tab to target card
    const updatedCards = cardsAfterRemove.map(card => {
      if (card.id === targetCardId && sourceTab) {
        const existingTabs = card.tabs || [];
        
        // If target has no tabs yet, convert current props to first tab
        if (existingTabs.length === 0 && card.props) {
          const firstTab: CardTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            props: { ...card.props },
          };
          const newTabs = [firstTab, sourceTab];
          if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < newTabs.length) {
            newTabs.splice(targetIndex, 0, sourceTab);
            newTabs.pop(); // Remove the duplicate
          }
          return {
            ...card,
            tabs: newTabs,
            activeTabId: sourceTab.id,
            props: undefined,
          };
        }
        
        // Insert at target index or append
        const newTabs = [...existingTabs];
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newTabs.length) {
          newTabs.splice(targetIndex, 0, sourceTab);
        } else {
          newTabs.push(sourceTab);
        }
        
        return {
          ...card,
          tabs: newTabs,
          activeTabId: sourceTab.id,
        };
      }
      return card;
    });

    const updatedLayout = {
      ...currentLayout,
      cards: updatedCards,
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after moving tab (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  updateTabProps: (cardId, tabId, props) => {
    const currentLayout = get().currentLayout;
    const currentWorkspaceId = get().currentWorkspaceId;
    
    if (!currentLayout) return;

    const updatedCards = currentLayout.cards.map(card => {
      if (card.id === cardId) {
        const existingTabs = card.tabs || [];
        const updatedTabs = existingTabs.map(tab => 
          tab.id === tabId ? { ...tab, props: { ...tab.props, ...props } } : tab
        );
        return {
          ...card,
          tabs: updatedTabs,
        };
      }
      return card;
    });

    const updatedLayout = {
      ...currentLayout,
      cards: updatedCards,
    };

    set({
      currentLayout: updatedLayout,
      workspaces: {
        ...get().workspaces,
        ...(currentWorkspaceId && {
          [currentWorkspaceId]: updatedLayout,
        }),
      },
    });
    
    // Auto-save after updating tab props (immediate, only if changed)
    get()._saveLayoutIfChanged().catch((err) => {
      console.error('Failed to auto-save layout:', err);
    });
  },

  // Link management functions
  createLinkGroup: (cardIds, name, color) => {
    const linkGroupId = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // If no color provided, assign the next available color from the palette
    let assignedColor = color;
    if (!assignedColor) {
      const existingColors = Object.values(get().linkGroups).map(g => g.color);
      const availableColors = LINK_GROUP_COLORS.filter(c => !existingColors.includes(c));
      assignedColor = availableColors.length > 0 
        ? availableColors[0] 
        : LINK_GROUP_COLORS[Object.keys(get().linkGroups).length % LINK_GROUP_COLORS.length];
    }
    
    const linkGroup: LinkGroup = {
      id: linkGroupId,
      cardIds: [...cardIds],
      name,
      color: assignedColor,
    };

    // Update cards to reference this link group
    const currentLayout = get().currentLayout;
    if (currentLayout) {
      const updatedCards = currentLayout.cards.map(card => {
        if (cardIds.includes(card.id)) {
          return { ...card, linkGroupId };
        }
        return card;
      });

      set({
        linkGroups: {
          ...get().linkGroups,
          [linkGroupId]: linkGroup,
        },
        currentLayout: {
          ...currentLayout,
          cards: updatedCards,
        },
      });
    } else {
      set({
        linkGroups: {
          ...get().linkGroups,
          [linkGroupId]: linkGroup,
        },
      });
    }

    return linkGroupId;
  },

  addCardToLinkGroup: (cardId, linkGroupId) => {
    const linkGroup = get().linkGroups[linkGroupId];
    if (!linkGroup) return;

    // Add card to link group if not already present
    if (!linkGroup.cardIds.includes(cardId)) {
      const updatedLinkGroup = {
        ...linkGroup,
        cardIds: [...linkGroup.cardIds, cardId],
      };

      // Update card to reference this link group
      const currentLayout = get().currentLayout;
      if (currentLayout) {
        const updatedCards = currentLayout.cards.map(card => {
          if (card.id === cardId) {
            return { ...card, linkGroupId };
          }
          return card;
        });

        set({
          linkGroups: {
            ...get().linkGroups,
            [linkGroupId]: updatedLinkGroup,
          },
          currentLayout: {
            ...currentLayout,
            cards: updatedCards,
          },
        });
      } else {
        set({
          linkGroups: {
            ...get().linkGroups,
            [linkGroupId]: updatedLinkGroup,
          },
        });
      }
    }
  },

  removeCardFromLinkGroup: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    const card = currentLayout.cards.find(c => c.id === cardId);
    if (!card?.linkGroupId) return;

    const linkGroup = get().linkGroups[card.linkGroupId];
    if (!linkGroup) return;

    // Remove card from link group
    const updatedCardIds = linkGroup.cardIds.filter(id => id !== cardId);
    
    // If link group is now empty, remove it
    if (updatedCardIds.length === 0) {
      const { [card.linkGroupId]: removed, ...remainingLinkGroups } = get().linkGroups;
      set({ linkGroups: remainingLinkGroups });
    } else {
      // Update link group
      set({
        linkGroups: {
          ...get().linkGroups,
          [card.linkGroupId]: {
            ...linkGroup,
            cardIds: updatedCardIds,
          },
        },
      });
    }

    // Remove linkGroupId from card
    const updatedCards = currentLayout.cards.map(c => {
      if (c.id === cardId) {
        const { linkGroupId, ...rest } = c;
        return rest;
      }
      return c;
    });

    set({
      currentLayout: {
        ...currentLayout,
        cards: updatedCards,
      },
    });
  },

  removeLinkGroup: (linkGroupId) => {
    const linkGroup = get().linkGroups[linkGroupId];
    if (!linkGroup) return;

    // Remove linkGroupId from all cards in the group
    const currentLayout = get().currentLayout;
    if (currentLayout) {
      const updatedCards = currentLayout.cards.map(card => {
        if (card.linkGroupId === linkGroupId) {
          const { linkGroupId, ...rest } = card;
          return rest;
        }
        return card;
      });

      set({
        linkGroups: Object.fromEntries(
          Object.entries(get().linkGroups).filter(([id]) => id !== linkGroupId)
        ),
        currentLayout: {
          ...currentLayout,
          cards: updatedCards,
        },
      });
    } else {
      set({
        linkGroups: Object.fromEntries(
          Object.entries(get().linkGroups).filter(([id]) => id !== linkGroupId)
        ),
      });
    }
  },

  getLinkGroup: (linkGroupId) => {
    return get().linkGroups[linkGroupId];
  },

  getCardLinkGroup: (cardId) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return undefined;

    const card = currentLayout.cards.find(c => c.id === cardId);
    if (!card?.linkGroupId) return undefined;

    return get().linkGroups[card.linkGroupId];
  },

  getLinkedCards: (cardId) => {
    const linkGroup = get().getCardLinkGroup(cardId);
    if (!linkGroup) return [];

    return linkGroup.cardIds.filter(id => id !== cardId);
  },

  // Link selection mode functions
  startLinkSelection: (initialCardId) => {
    set({
      linkSelectionMode: true,
      selectedCardIdsForLinking: new Set([initialCardId]),
    });
  },

  toggleCardSelection: (cardId) => {
    const currentSelection = get().selectedCardIdsForLinking;
    const newSelection = new Set(currentSelection);
    
    if (newSelection.has(cardId)) {
      newSelection.delete(cardId);
    } else {
      newSelection.add(cardId);
    }
    
    set({
      selectedCardIdsForLinking: newSelection,
    });
  },

  clearLinkSelection: () => {
    set({
      linkSelectionMode: false,
      selectedCardIdsForLinking: new Set<string>(),
    });
  },

  confirmLinkSelection: (name, color) => {
    const selectedIds = Array.from(get().selectedCardIdsForLinking);
    
    if (selectedIds.length < 2) {
      // Need at least 2 cards to create a link
      return null;
    }
    
    const linkGroupId = get().createLinkGroup(selectedIds, name, color);
    
    // Clear selection mode
    set({
      linkSelectionMode: false,
      selectedCardIdsForLinking: new Set<string>(),
    });
    
    return linkGroupId;
  },
}));

