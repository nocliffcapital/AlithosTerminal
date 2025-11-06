import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Helper functions to distinguish between market IDs and event IDs
const EVENT_PREFIX = 'event:';
export const isEventId = (id: string) => id.startsWith(EVENT_PREFIX);
export const getEventId = (eventId: string) => `${EVENT_PREFIX}${eventId}`;
export const getEventIdFromPrefixed = (prefixedId: string) => prefixedId.replace(EVENT_PREFIX, '');

interface WatchlistState {
  marketIds: string[];
  addToWatchlist: (marketId: string) => void;
  removeFromWatchlist: (marketId: string) => void;
  isInWatchlist: (marketId: string) => boolean;
  clearWatchlist: () => void;
  // Event/multimarket group methods
  addEventToWatchlist: (eventId: string) => void;
  removeEventFromWatchlist: (eventId: string) => void;
  isEventInWatchlist: (eventId: string) => boolean;
  getEventIds: () => string[];
  getAllWatchlistIds: () => string[]; // Returns all IDs (market + event)
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      marketIds: [],
      addToWatchlist: (marketId: string) => {
        set((state) => {
          if (state.marketIds.includes(marketId)) {
            return state; // Already in watchlist
          }
          return {
            marketIds: [...state.marketIds, marketId],
          };
        });
      },
      removeFromWatchlist: (marketId: string) => {
        set((state) => ({
          marketIds: state.marketIds.filter((id) => id !== marketId),
        }));
      },
      isInWatchlist: (marketId: string) => {
        return get().marketIds.includes(marketId);
      },
      clearWatchlist: () => {
        set({ marketIds: [] });
      },
      // Event/multimarket group methods
      addEventToWatchlist: (eventId: string) => {
        set((state) => {
          const prefixedId = getEventId(eventId);
          if (state.marketIds.includes(prefixedId)) {
            return state; // Already in watchlist
          }
          return {
            marketIds: [...state.marketIds, prefixedId],
          };
        });
      },
      removeEventFromWatchlist: (eventId: string) => {
        set((state) => {
          const prefixedId = getEventId(eventId);
          return {
            marketIds: state.marketIds.filter((id) => id !== prefixedId),
          };
        });
      },
      isEventInWatchlist: (eventId: string) => {
        const prefixedId = getEventId(eventId);
        return get().marketIds.includes(prefixedId);
      },
      getEventIds: () => {
        return get().marketIds
          .filter((id) => isEventId(id))
          .map((id) => getEventIdFromPrefixed(id));
      },
      getAllWatchlistIds: () => {
        return get().marketIds;
      },
    }),
    {
      name: 'watchlist-storage',
    }
  )
);

