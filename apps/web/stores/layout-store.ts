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
  | 'alerts'
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
  | 'theme-editor'
  | 'kelly-calculator'
  | 'position-sizing'
  | 'price-converter';

export interface CardConfig {
  id: string;
  type: CardType;
  layout: Layout;
  props?: Record<string, unknown>;
  isMinimized?: boolean;
  isMaximized?: boolean;
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
  loadLayout: (id: string) => Promise<void>;
  hasLayoutChanged: (layout: WorkspaceLayout) => Promise<boolean>;
  toggleFavouriteCardType: (type: CardType) => void;
  isFavouriteCardType: (type: CardType) => boolean;
  loadFavouriteCardTypes: () => void;
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
    
    // Save current workspace layout before switching (only if it has changed)
    if (currentWorkspaceId && currentLayout && currentLayout.cards.length > 0) {
      try {
        // Only save if layout has actually changed
        const hasChanged = await get().hasLayoutChanged(currentLayout);
        if (hasChanged) {
          await get().saveLayout();
        }
      } catch (error) {
        console.error('Failed to save layout before switching:', error);
      }
    }
    
    // Check if layout is already cached in memory and recent (less than 30 seconds old)
    let layout = workspaces[id];
    const CACHE_TTL = 30000; // 30 seconds
    
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
              cards: (layoutConfig.cards || []).map((card: CardConfig) => ({
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
    layout = await fetchPromise;
    
    // Clean up pending fetch
    get()._pendingFetches.delete(id);
    
    // If layout exists in memory but not from DB, use memory version
    if (!layout) {
      layout = workspaces[id];
    }
    
    // If no layout exists after trying to load, create a default one with a few starter cards
    if (!layout) {
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
    
    set({
      currentWorkspaceId: id,
      currentLayout: layout,
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
    
    // Save layout (debounced to prevent excessive saves)
    const saveTimeout = (get() as any).__saveTimeout;
    if (saveTimeout) clearTimeout(saveTimeout);
    (get() as any).__saveTimeout = setTimeout(() => {
      get().saveLayout().catch((err) => {
        console.error('Failed to auto-save layout:', err);
      });
    }, 2500); // Debounce saves to 2.5 seconds (increased from 1s)
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
    
    // Auto-save after removing card (debounced)
    setTimeout(() => {
      get().saveLayout().catch((err) => {
        console.error('Failed to auto-save layout:', err);
      });
    }, 2500); // Increased to 2.5 seconds
  },

  updateCardProps: (cardId, props) => {
    const currentLayout = get().currentLayout;
    if (!currentLayout) return;

    set({
      currentLayout: {
        ...currentLayout,
        cards: currentLayout.cards.map((c) =>
          c.id === cardId ? { ...c, props: { ...c.props, ...props } } : c
        ),
      },
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
  },

  isFavouriteCardType: (type: CardType) => {
    return get().favouriteCardTypes.includes(type);
  },

  loadFavouriteCardTypes: () => {
    const favourites = loadFavouritesFromStorage();
    set({ favouriteCardTypes: favourites });
  },
}));

