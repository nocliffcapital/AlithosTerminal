import { create } from 'zustand';
import { Market, MarketPrice, OrderBook } from '@/lib/api/polymarket';

interface MarketState {
  markets: Record<string, Market>;
  prices: Record<string, MarketPrice>;
  orderBooks: Record<string, OrderBook>;
  selectedMarketId: string | null;
  
  // Actions
  setMarkets: (markets: Market[]) => void;
  setMarketPrice: (marketId: string, price: MarketPrice) => void;
  setOrderBook: (marketId: string, outcome: 'YES' | 'NO', book: OrderBook) => void;
  selectMarket: (marketId: string | null) => void;
  getMarket: (marketId: string) => Market | undefined;
  getPrice: (marketId: string) => MarketPrice | undefined;
  getOrderBook: (marketId: string, outcome: 'YES' | 'NO') => OrderBook | undefined;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: {},
  prices: {},
  orderBooks: {},
  selectedMarketId: null,

  setMarkets: (markets) =>
    set((state) => ({
      markets: markets.reduce(
        (acc, market) => ({ ...acc, [market.id]: market }),
        state.markets
      ),
    })),

  setMarketPrice: (marketId, price) =>
    set((state) => ({
      prices: { ...state.prices, [marketId]: price },
    })),

  setOrderBook: (marketId, outcome, book) =>
    set((state) => {
      const key = `${marketId}-${outcome}`;
      return {
        orderBooks: { ...state.orderBooks, [key]: book },
      };
    }),

  selectMarket: (marketId) =>
    set({ selectedMarketId: marketId }),

  getMarket: (marketId) => get().markets[marketId],
  
  getPrice: (marketId) => get().prices[marketId],
  
  getOrderBook: (marketId, outcome) => {
    const key = `${marketId}-${outcome}`;
    return get().orderBooks[key];
  },
}));

