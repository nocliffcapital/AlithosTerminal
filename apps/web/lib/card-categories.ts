import { CardType } from '@/stores/layout-store';

export type CardCategory = 
  | 'Trading'
  | 'Analysis'
  | 'Research'
  | 'Risk Management'
  | 'Automation'
  | 'Team'
  | 'Utilities';

export interface CardTypeInfo {
  type: CardType;
  label: string;
  category: CardCategory;
}

export const cardCategories: Record<CardCategory, CardTypeInfo[]> = {
  'Trading': [
    { type: 'watchlist', label: 'Watchlist', category: 'Trading' },
    { type: 'tape', label: 'Tape', category: 'Trading' },
    { type: 'quick-ticket', label: 'Quick Ticket', category: 'Trading' },
    { type: 'order-creator', label: 'Order Creator', category: 'Trading' },
    { type: 'orderbook', label: 'Order Book', category: 'Trading' },
    { type: 'market-trade', label: 'Market Trade', category: 'Trading' },
    { type: 'positions', label: 'Positions & P&L', category: 'Trading' },
    { type: 'order-history', label: 'Order History', category: 'Trading' },
    { type: 'transaction-history', label: 'Transaction History', category: 'Trading' },
  ],
  'Analysis': [
    { type: 'chart', label: 'Chart', category: 'Analysis' },
    { type: 'tradingview-chart', label: 'TradingView Chart', category: 'Analysis' },
    { type: 'depth', label: 'Depth & Impact', category: 'Analysis' },
    { type: 'correlation-matrix', label: 'Correlation Matrix', category: 'Analysis' },
    { type: 'exposure-tree', label: 'Exposure Tree', category: 'Analysis' },
    { type: 'activity-scanner', label: 'Activity Scanner', category: 'Analysis' },
  ],
  'Research': [
    { type: 'market-discovery', label: 'Market Discovery', category: 'Research' },
    { type: 'market-info', label: 'Market Info', category: 'Research' },
    { type: 'market-research', label: 'AI Market Research', category: 'Research' },
    { type: 'news', label: 'News', category: 'Research' },
    { type: 'resolution-criteria', label: 'Resolution Criteria', category: 'Research' },
  ],
  'Risk Management': [
    { type: 'kelly-calculator', label: 'Kelly Calculator', category: 'Risk Management' },
    { type: 'position-sizing', label: 'Position Sizing', category: 'Risk Management' },
    { type: 'scenario-builder', label: 'Scenario Builder', category: 'Risk Management' },
    { type: 'price-converter', label: 'Price Converter', category: 'Risk Management' },
  ],
  'Automation': [],
  'Team': [
    { type: 'team-management', label: 'Team Management', category: 'Team' },
  ],
  'Utilities': [
    { type: 'journal', label: 'Journal', category: 'Utilities' },
    { type: 'comments', label: 'Comments', category: 'Utilities' },
  ],
};

// Flatten all cards for backward compatibility
export const allCardTypes: CardTypeInfo[] = Object.values(cardCategories).flat();

// Get card info by type
export const getCardInfo = (type: CardType): CardTypeInfo | undefined => {
  return allCardTypes.find(card => card.type === type);
};

// Get category for a card type
export const getCardCategory = (type: CardType): CardCategory | undefined => {
  return getCardInfo(type)?.category;
};

