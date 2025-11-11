// Default templates provided to all users
// These templates are seeded into the database and marked with isDefault: true

import { WorkspaceLayout } from '@/stores/layout-store';

export interface DefaultTemplate {
  name: string;
  description: string;
  workspaceType: 'SCALPING' | 'EVENT_DAY' | 'ARB_DESK' | 'RESEARCH' | 'CUSTOM';
  config: WorkspaceLayout;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Scalping Workspace',
    description: 'Optimized for fast trading with market discovery, tape, order book, and quick ticket',
    workspaceType: 'SCALPING',
    config: {
      id: 'default-scalping',
      name: 'Scalping Workspace',
      cards: [
        {
          id: 'market-discovery-1',
          type: 'market-discovery',
          layout: { i: 'market-discovery-1', x: 0, y: 0, w: 4, h: 8, minW: 2, minH: 4 },
        },
        {
          id: 'tape-1',
          type: 'tape',
          layout: { i: 'tape-1', x: 4, y: 0, w: 4, h: 8, minW: 3, minH: 4 },
        },
        {
          id: 'orderbook-1',
          type: 'orderbook',
          layout: { i: 'orderbook-1', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 4 },
        },
        {
          id: 'quick-ticket-1',
          type: 'quick-ticket',
          layout: { i: 'quick-ticket-1', x: 0, y: 8, w: 4, h: 6, minW: 2, minH: 4 },
        },
        {
          id: 'depth-1',
          type: 'depth',
          layout: { i: 'depth-1', x: 4, y: 8, w: 4, h: 6, minW: 3, minH: 4 },
        },
        {
          id: 'positions-1',
          type: 'positions',
          layout: { i: 'positions-1', x: 8, y: 8, w: 4, h: 6, minW: 2, minH: 4 },
        },
      ],
    },
  },
  {
    name: 'Event Day Workspace',
    description: 'Perfect for event-driven trading with market discovery, news, and research tools',
    workspaceType: 'EVENT_DAY',
    config: {
      id: 'default-event-day',
      name: 'Event Day Workspace',
      cards: [
        {
          id: 'market-discovery-1',
          type: 'market-discovery',
          layout: { i: 'market-discovery-1', x: 0, y: 0, w: 6, h: 10, minW: 4, minH: 6 },
        },
        {
          id: 'news-1',
          type: 'news',
          layout: { i: 'news-1', x: 6, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
        },
        {
          id: 'market-research-1',
          type: 'market-research',
          layout: { i: 'market-research-1', x: 6, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
        },
        {
          id: 'chart-1',
          type: 'chart',
          layout: { i: 'chart-1', x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
        },
        {
          id: 'quick-ticket-1',
          type: 'quick-ticket',
          layout: { i: 'quick-ticket-1', x: 6, y: 10, w: 6, h: 6, minW: 3, minH: 4 },
        },
      ],
    },
  },
  {
    name: 'Arbitrage Desk',
    description: 'Designed for arbitrage opportunities with correlation matrix, exposure tree, and activity scanner',
    workspaceType: 'ARB_DESK',
    config: {
      id: 'default-arb-desk',
      name: 'Arbitrage Desk',
      cards: [
        {
          id: 'correlation-matrix-1',
          type: 'correlation-matrix',
          layout: { i: 'correlation-matrix-1', x: 0, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
        },
        {
          id: 'exposure-tree-1',
          type: 'exposure-tree',
          layout: { i: 'exposure-tree-1', x: 6, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
        },
        {
          id: 'activity-scanner-1',
          type: 'activity-scanner',
          layout: { i: 'activity-scanner-1', x: 0, y: 8, w: 6, h: 6, minW: 4, minH: 4 },
        },
        {
          id: 'positions-1',
          type: 'positions',
          layout: { i: 'positions-1', x: 6, y: 8, w: 6, h: 6, minW: 3, minH: 4 },
        },
      ],
    },
  },
  {
    name: 'Research Workspace',
    description: 'Focused on market research with discovery, info, research tools, and news',
    workspaceType: 'RESEARCH',
    config: {
      id: 'default-research',
      name: 'Research Workspace',
      cards: [
        {
          id: 'market-discovery-1',
          type: 'market-discovery',
          layout: { i: 'market-discovery-1', x: 0, y: 0, w: 6, h: 10, minW: 4, minH: 6 },
        },
        {
          id: 'market-info-1',
          type: 'market-info',
          layout: { i: 'market-info-1', x: 6, y: 0, w: 6, h: 5, minW: 4, minH: 3 },
        },
        {
          id: 'market-research-1',
          type: 'market-research',
          layout: { i: 'market-research-1', x: 6, y: 5, w: 6, h: 5, minW: 4, minH: 3 },
        },
        {
          id: 'news-1',
          type: 'news',
          layout: { i: 'news-1', x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
        },
        {
          id: 'chart-1',
          type: 'chart',
          layout: { i: 'chart-1', x: 6, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
        },
        {
          id: 'journal-1',
          type: 'journal',
          layout: { i: 'journal-1', x: 0, y: 16, w: 12, h: 4, minW: 4, minH: 3 },
        },
      ],
    },
  },
  {
    name: 'Starter Workspace',
    description: 'A simple starter template with market discovery, tape, and quick ticket',
    workspaceType: 'CUSTOM',
    config: {
      id: 'default-starter',
      name: 'Starter Workspace',
      cards: [
        {
          id: 'market-discovery-1',
          type: 'market-discovery',
          layout: { i: 'market-discovery-1', x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
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
      ],
    },
  },
];

