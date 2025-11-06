// Alert templates for common trading scenarios
// These templates provide pre-configured alerts that users can quickly apply

import { Alert, AlertCondition, AlertAction } from './alert-system';

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  category: 'price' | 'volume' | 'liquidity' | 'flow' | 'spread';
  conditions: AlertCondition[];
  actions: AlertAction[];
  defaultCooldownMinutes?: number;
  icon?: string;
}

/**
 * Pre-built alert templates for common scenarios
 */
export const ALERT_TEMPLATES: AlertTemplate[] = [
  // Price Breakout Templates
  {
    id: 'price-breakout-up',
    name: 'Price Breakout Up',
    description: 'Alert when price breaks above a threshold (bullish signal)',
    category: 'price',
    conditions: [
      { type: 'price', operator: 'gt', value: 70 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Price breakout detected! Price above 70%' } },
    ],
    defaultCooldownMinutes: 15,
  },
  {
    id: 'price-breakout-down',
    name: 'Price Breakout Down',
    description: 'Alert when price breaks below a threshold (bearish signal)',
    category: 'price',
    conditions: [
      { type: 'price', operator: 'lt', value: 30 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Price breakdown detected! Price below 30%' } },
    ],
    defaultCooldownMinutes: 15,
  },
  {
    id: 'price-extreme',
    name: 'Price Extreme',
    description: 'Alert when price reaches extreme levels (>80% or <20%)',
    category: 'price',
    conditions: [
      { type: 'price', operator: 'gte', value: 80 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Extreme price level reached! Consider taking profit or entering position.' } },
    ],
    defaultCooldownMinutes: 30,
  },

  // Volume Templates
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Alert when 24h volume exceeds a threshold (high activity)',
    category: 'volume',
    conditions: [
      { type: 'volume', operator: 'gt', value: 10000 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Volume spike detected! High trading activity.' } },
    ],
    defaultCooldownMinutes: 60,
  },
  {
    id: 'volume-surge',
    name: 'Volume Surge',
    description: 'Alert when volume exceeds $50K (major activity)',
    category: 'volume',
    conditions: [
      { type: 'volume', operator: 'gt', value: 50000 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Major volume surge! Market moving significantly.' } },
    ],
    defaultCooldownMinutes: 60,
  },

  // Liquidity Templates
  {
    id: 'low-liquidity',
    name: 'Low Liquidity Warning',
    description: 'Alert when order book depth is low (hard to trade)',
    category: 'liquidity',
    conditions: [
      { type: 'depth', operator: 'lt', value: 1000 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Low liquidity detected! High slippage risk.' } },
    ],
    defaultCooldownMinutes: 30,
  },
  {
    id: 'high-liquidity',
    name: 'High Liquidity Opportunity',
    description: 'Alert when liquidity improves (good trading conditions)',
    category: 'liquidity',
    conditions: [
      { type: 'depth', operator: 'gt', value: 5000 },
    ],
    actions: [
      { type: 'notify', config: { message: 'High liquidity available! Good trading conditions.' } },
    ],
    defaultCooldownMinutes: 30,
  },

  // Spread Templates
  {
    id: 'wide-spread',
    name: 'Wide Spread Warning',
    description: 'Alert when spread is wide (>5% = high trading cost)',
    category: 'spread',
    conditions: [
      { type: 'spread', operator: 'gt', value: 5 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Wide spread detected! High trading costs.' } },
    ],
    defaultCooldownMinutes: 30,
  },
  {
    id: 'tight-spread',
    name: 'Tight Spread Opportunity',
    description: 'Alert when spread is tight (<2% = good trading conditions)',
    category: 'spread',
    conditions: [
      { type: 'spread', operator: 'lt', value: 2 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Tight spread detected! Good trading conditions.' } },
    ],
    defaultCooldownMinutes: 30,
  },

  // Multi-Signal Templates
  {
    id: 'price-volume-breakout',
    name: 'Price & Volume Breakout',
    description: 'Alert when price breaks out AND volume spikes (strong signal)',
    category: 'price',
    conditions: [
      { type: 'price', operator: 'gt', value: 65 },
      { type: 'volume', operator: 'gt', value: 5000 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Strong breakout signal! Price and volume both elevated.' } },
    ],
    defaultCooldownMinutes: 30,
  },
  {
    id: 'perfect-storm',
    name: 'Perfect Storm (Multi-Signal)',
    description: 'Alert when price, volume, and liquidity all align (optimal conditions)',
    category: 'price',
    conditions: [
      { type: 'price', operator: 'gt', value: 50 },
      { type: 'volume', operator: 'gt', value: 10000 },
      { type: 'depth', operator: 'gt', value: 3000 },
      { type: 'spread', operator: 'lt', value: 3 },
    ],
    actions: [
      { type: 'notify', config: { message: 'Perfect trading conditions! All metrics aligned.' } },
    ],
    defaultCooldownMinutes: 60,
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: AlertTemplate['category']): AlertTemplate[] {
  return ALERT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AlertTemplate | undefined {
  return ALERT_TEMPLATES.find(t => t.id === id);
}

/**
 * Convert template to alert (for creating alert from template)
 */
export function templateToAlert(
  template: AlertTemplate,
  marketId?: string,
  customName?: string
): Partial<Alert> {
  return {
    name: customName || template.name,
    marketId,
    conditions: template.conditions,
    actions: template.actions,
    isActive: true,
    cooldownPeriodMinutes: template.defaultCooldownMinutes,
  };
}

