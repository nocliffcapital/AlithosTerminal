// Alert system for multi-signal alerts and automation
import { sendWebhook } from '@/lib/notifications/webhook-client';
import { sendEmail } from '@/lib/notifications/email-client';

export type AlertCondition = {
  type: 'price' | 'volume' | 'depth' | 'flow' | 'spread';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
};

export type AlertAction = {
  type: 'notify' | 'order' | 'webhook';
  config: {
    message?: string;
    orderParams?: {
      marketId: string;
      outcome: 'YES' | 'NO';
      amount: number;
      type: 'buy' | 'sell';
    };
    webhookUrl?: string;
  };
};

export interface Alert {
  id: string;
  name: string;
  marketId?: string; // undefined for global alerts
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  cooldownPeriodMinutes?: number; // Cooldown period in minutes (undefined = no cooldown)
  lastTriggered?: Date;
}

// Data fetcher interface for connecting to real market data
export interface AlertDataFetcher {
  getPrice: (marketId: string) => number | null;
  getVolume: (marketId: string) => number | null;
  getDepth: (marketId: string, outcome?: 'YES' | 'NO') => number | null;
  getSpread: (marketId: string, outcome?: 'YES' | 'NO') => number | null;
  getFlow: (marketId: string, outcome?: 'YES' | 'NO') => number | null;
}

class AlertSystem {
  private alerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private dataFetcher: AlertDataFetcher | null = null;

  /**
   * Set the data fetcher for real-time market data
   */
  setDataFetcher(fetcher: AlertDataFetcher): void {
    this.dataFetcher = fetcher;
  }

  addAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);
    this.startChecking();
  }

  removeAlert(id: string): void {
    this.alerts.delete(id);
    if (this.alerts.size === 0) {
      this.stopChecking();
    }
  }

  updateAlert(id: string, updates: Partial<Alert>): void {
    const alert = this.alerts.get(id);
    if (alert) {
      this.alerts.set(id, { ...alert, ...updates });
    }
  }

  private startChecking(): void {
    if (this.checkInterval) return;

    // Check alerts every 5 seconds
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 5000);
  }

  private stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAlerts(): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.isActive) continue;

      // Check cooldown period
      if (alert.cooldownPeriodMinutes && alert.cooldownPeriodMinutes > 0 && alert.lastTriggered) {
        const now = new Date();
        const minutesSinceLastTrigger = (now.getTime() - alert.lastTriggered.getTime()) / (1000 * 60);
        if (minutesSinceLastTrigger < alert.cooldownPeriodMinutes) {
          continue; // Still in cooldown
        }
      }

      const triggered = await this.evaluateConditions(alert);
      if (triggered) {
        await this.executeActions(alert);
        this.updateAlert(alert.id, { lastTriggered: new Date() });
        
        // Sync trigger timestamp to database
        await this.syncTriggerToDatabase(alert.id);
      }
    }
  }

  private async evaluateConditions(alert: Alert): Promise<boolean> {
    // All conditions must be met (AND logic)
    for (const condition of alert.conditions) {
      // For flow conditions, we might need async handling
      let value: number;
      
      if (condition.type === 'flow' && alert.marketId) {
        // Flow requires async calculation, so we'll handle it specially
        // For now, use the sync version from data fetcher
        value = await this.getValueForCondition(condition, alert.marketId);
      } else {
        value = await this.getValueForCondition(condition, alert.marketId);
      }
      
      if (!this.compareValue(value, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  }

  private async getValueForCondition(
    condition: AlertCondition,
    marketId?: string
  ): Promise<number> {
    // If no market ID, return 0 (can't evaluate without market)
    if (!marketId || !this.dataFetcher) {
      // Fallback to mock values if no data fetcher is set
      switch (condition.type) {
        case 'price':
          return 50;
        case 'volume':
          return 1000;
        case 'depth':
          return 500;
        case 'flow':
          return 100;
        case 'spread':
          return 0.02;
        default:
          return 0;
      }
    }

    // Use real data fetcher
    try {
      switch (condition.type) {
        case 'price': {
          // Get price as probability (0-100)
          const price = this.dataFetcher.getPrice(marketId);
          return price !== null ? price : 50; // Default to 50% if no price
        }
        case 'volume': {
          // Get 24h volume in USDC
          const volume = this.dataFetcher.getVolume(marketId);
          return volume !== null ? volume : 0;
        }
        case 'depth': {
          // Get order book depth (total size of bids + asks)
          // Default to YES outcome if not specified
          const depth = this.dataFetcher.getDepth(marketId, 'YES');
          return depth !== null ? depth : 0;
        }
        case 'flow': {
          // Get net flow (positive = buy pressure, negative = sell pressure)
          // Flow requires async calculation, so if fetcher returns null, calculate it
          const flow = this.dataFetcher.getFlow(marketId, 'YES');
          if (flow !== null) {
            return flow;
          }
          // If flow is null, it means we need async calculation
          // For now, return 0 as fallback (will be improved with async support)
          return 0;
        }
        case 'spread': {
          // Get spread as percentage (0-1 range)
          // Default to YES outcome if not specified
          const spread = this.dataFetcher.getSpread(marketId, 'YES');
          return spread !== null ? spread * 100 : 0; // Convert to percentage
        }
        default:
          return 0;
      }
    } catch (error) {
      console.error('[AlertSystem] Error fetching condition value:', error);
      return 0;
    }
  }

  private compareValue(
    value: number,
    operator: AlertCondition['operator'],
    threshold: number
  ): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return Math.abs(value - threshold) < 0.001;
      default:
        return false;
    }
  }

  private async executeActions(alert: Alert): Promise<void> {
    // Fetch user preferences and email (API uses auth to get current user)
    let preferences: { browser: boolean; email: boolean; webhook: boolean; webhookUrl?: string } | null = null;
    let userEmail: string | null = null;
    
    try {
      // Fetch preferences
      const prefResponse = await fetch('/api/user/preferences');
      if (prefResponse.ok) {
        const prefData = await prefResponse.json();
        preferences = prefData.preferences;
      }
      
      // Fetch user email (for email notifications)
      const userResponse = await fetch('/api/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userEmail = userData.user?.email || null;
      }
    } catch (error) {
      console.error('[AlertSystem] Failed to fetch user data:', error);
      // Continue with defaults if fetch fails
    }

    for (const action of alert.actions) {
      switch (action.type) {
        case 'notify':
          const message = action.config.message || 'Alert triggered';
          
          // Send browser notification if enabled in preferences
          if (!preferences || preferences.browser) {
            this.sendNotification(message);
          }
          
          // Send email notification if enabled in preferences and user has email
          if (preferences?.email && userEmail) {
            await sendEmail({
              to: userEmail,
              subject: `Alert Triggered: ${alert.name}`,
              body: message,
              html: `<p>${message}</p><p>Alert: ${alert.name}</p><p>Market: ${alert.marketId || 'Global'}</p>`,
            }).catch((error) => {
              console.error('[AlertSystem] Failed to send email notification:', error);
            });
          }
          break;
        case 'order':
          if (action.config.orderParams) {
            // Would execute order via trading system
            console.log('Execute order:', action.config.orderParams);
          }
          break;
        case 'webhook':
          // Use user's webhook URL from preferences if available, otherwise use action config
          const webhookUrl = preferences?.webhook && preferences?.webhookUrl 
            ? preferences.webhookUrl 
            : action.config.webhookUrl;
          
          if (webhookUrl && (!preferences || preferences.webhook)) {
            const webhookPayload = {
              alert: alert.name,
              alertId: alert.id,
              timestamp: new Date().toISOString(),
              marketId: alert.marketId,
              message: action.config.message || 'Alert triggered',
              conditions: alert.conditions,
            };
            
            const result = await sendWebhook(webhookUrl, webhookPayload, {
              maxRetries: 3,
              retryDelay: 1000,
              timeout: 10000,
            });
            
            if (!result.success) {
              console.error('[AlertSystem] Webhook delivery failed:', result.error);
            }
          }
          break;
      }
    }
  }

  /**
   * Sync alert trigger timestamp to database
   * This should be called when an alert is triggered
   */
  async syncTriggerToDatabase(alertId: string): Promise<void> {
    try {
      // Call API to update lastTriggered timestamp
      await fetch(`/api/alerts/${alertId}/trigger`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error(`[AlertSystem] Failed to sync trigger timestamp for alert ${alertId}:`, error);
      // Don't throw - this is a non-critical operation
    }
  }

  private sendNotification(message: string): void {
    // Browser notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Alithos Terminal Alert', {
        body: message,
        icon: '/icon.png',
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('Alithos Terminal Alert', {
            body: message,
            icon: '/icon.png',
          });
        }
      });
    }

    // Also log to console
    console.log('[ALERT]', message);
  }


  /**
   * Test alert conditions without triggering actions
   * Returns detailed test results showing which conditions passed/failed
   */
  async testAlert(alert: Alert): Promise<{
    wouldTrigger: boolean;
    conditions: Array<{
      condition: AlertCondition;
      currentValue: number;
      passed: boolean;
      description: string;
    }>;
  }> {
    const results: Array<{
      condition: AlertCondition;
      currentValue: number;
      passed: boolean;
      description: string;
    }> = [];

    let wouldTrigger = true;

    // Evaluate each condition
    for (const condition of alert.conditions) {
      const value = await this.getValueForCondition(condition, alert.marketId);
      const passed = this.compareValue(value, condition.operator, condition.value);
      
      // Format description
      const operatorSymbol = {
        gt: '>',
        lt: '<',
        gte: '≥',
        lte: '≤',
        eq: '=',
      }[condition.operator];
      
      const conditionTypeLabel = {
        price: 'Price',
        volume: 'Volume (24h)',
        depth: 'Depth',
        spread: 'Spread',
        flow: 'Flow',
      }[condition.type];
      
      const description = `${conditionTypeLabel}: ${value.toFixed(2)} ${operatorSymbol} ${condition.value.toFixed(2)}`;
      
      results.push({
        condition,
        currentValue: value,
        passed,
        description,
      });

      if (!passed) {
        wouldTrigger = false;
      }
    }

    return {
      wouldTrigger,
      conditions: results,
    };
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }
}

export const alertSystem = new AlertSystem();
export default alertSystem;

