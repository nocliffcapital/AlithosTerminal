// Adapter for Polymarket Real-Time Data Client
// Provides real-time updates for comments, orders, trades, and market data
// Uses @polymarket/real-time-data-client library

import {
  RealTimeDataClient,
  RealTimeDataClientArgs,
  SubscriptionMessage,
  Message,
  ConnectionStatus,
} from '@polymarket/real-time-data-client';

type MessageCallback = (message: Message) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class PolymarketRealtimeAdapter {
  private client: RealTimeDataClient | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private subscriptions: Map<string, SubscriptionMessage> = new Map();
  private isConnecting = false;
  private host: string;
  private lastMessageLogTime: number = 0;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private lastConnectionAttempt = 0;
  private connectionCooldown = 30000; // 30 seconds cooldown between attempts
  private isConnectionDisabled = false;

  constructor(host?: string) {
    // Use the correct Polymarket RTDS endpoint
    // Default: wss://ws-live-data.polymarket.com (from official docs)
    // Remove trailing slash if present
    const baseHost = host || process.env.NEXT_PUBLIC_POLYMARKET_RTDS_HOST || 'wss://ws-live-data.polymarket.com';
    this.host = baseHost.endsWith('/') ? baseHost.slice(0, -1) : baseHost;
  }

  /**
   * Initialize and connect the client
   */
  connect(): void {
    // Check if connection is disabled due to too many failures
    if (this.isConnectionDisabled) {
      console.warn('[RealtimeClient] ⛔ Connection disabled due to repeated failures. Will retry after cooldown.');
      return;
    }

    // Check cooldown period
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      const remaining = Math.ceil((this.connectionCooldown - (now - this.lastConnectionAttempt)) / 1000);
      console.log(`[RealtimeClient] ⏳ Connection cooldown active. Retry in ${remaining}s...`);
      return;
    }

    if (this.client || this.isConnecting) {
      console.log('[RealtimeClient] ⏭️  Already connected or connecting, skipping...');
      return;
    }

    // Check if we've exceeded max attempts
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.error(`[RealtimeClient] ⛔ Max connection attempts (${this.maxConnectionAttempts}) reached. Disabling auto-connect.`);
      this.isConnectionDisabled = true;
      // Reset after a longer cooldown (5 minutes)
      setTimeout(() => {
        this.connectionAttempts = 0;
        this.isConnectionDisabled = false;
        console.log('[RealtimeClient] 🔄 Connection attempts reset. Auto-connect re-enabled.');
      }, 5 * 60 * 1000);
      return;
    }

    this.connectionAttempts++;
    this.lastConnectionAttempt = now;
    console.log(`[RealtimeClient] 🔌 Connecting to Polymarket real-time data stream... (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
    this.isConnecting = true;

    const args: RealTimeDataClientArgs = {
      host: this.host,
      autoReconnect: true, // Enable auto-reconnect - the package handles it well
      pingInterval: 5000, // 5 seconds (default) - server expects frequent pings
      onConnect: (client) => {
        console.log('[RealtimeClient] ✅ Connected to Polymarket real-time data stream');
        this.isConnecting = false;
        this.connectionAttempts = 0; // Reset on successful connection
        this.isConnectionDisabled = false;
        
        // Note: Subscriptions will be handled by onStatusChange when status becomes CONNECTED
        // This ensures the WebSocket is fully ready before subscribing
      },
      onMessage: (client, message) => {
        // Notify all registered callbacks
        // Use Array.from to avoid issues if callbacks modify the set during iteration
        const callbacks = Array.from(this.messageCallbacks);
        
        // Guard against empty callbacks
        if (callbacks.length === 0) {
          return;
        }
        
        // Validate connection state before processing messages
        if (!this.client || this.isConnecting) {
          return;
        }
        
        // Log message receipt in development (throttled to prevent spam)
        if (process.env.NODE_ENV === 'development' && callbacks.length > 0) {
          const now = Date.now();
          if (!this.lastMessageLogTime || now - this.lastMessageLogTime > 5000) {
            console.log(`[RealtimeClient] 📨 Received ${message.topic}/${message.type} (${callbacks.length} callback(s))`);
            this.lastMessageLogTime = now;
          }
        }
        
        // Limit callback execution to prevent loops
        let executedCount = 0;
        const MAX_CALLBACK_EXECUTIONS = 10;
        
        callbacks.forEach((callback) => {
          if (executedCount >= MAX_CALLBACK_EXECUTIONS) {
            console.warn('[RealtimeClient] ⚠️ Too many callbacks, stopping execution');
            return;
          }
          
          try {
            callback(message);
            executedCount++;
          } catch (error) {
            console.error('[RealtimeClient] ❌ Error in message callback:', error);
            // Don't increment on error to prevent infinite loops
          }
        });
      },
      onStatusChange: (status) => {
        // Update connection state based on status
        const previousStatus = this.getStatus();
        if (status === ConnectionStatus.CONNECTED) {
          this.isConnecting = false;
          this.connectionAttempts = 0; // Reset on successful connection
          this.isConnectionDisabled = false;
          
          // When connected, subscribe to all queued subscriptions after a delay
          // to ensure the WebSocket is fully ready
          const subscribeToQueued = (retryCount = 0) => {
            if (!this.client || this.getStatus() !== ConnectionStatus.CONNECTED) {
              return;
            }
            
            const maxRetries = 3;
            this.subscriptions.forEach((subscription) => {
              try {
                this.client!.subscribe(subscription);
              } catch (error) {
                if (retryCount < maxRetries) {
                  // Retry after a delay if WebSocket might not be ready yet
                  setTimeout(() => subscribeToQueued(retryCount + 1), 200 * (retryCount + 1));
                } else {
                  console.warn('[RealtimeClient] Failed to subscribe after connection (max retries):', error);
                }
              }
            });
          };
          
          // Initial delay to ensure WebSocket is ready
          setTimeout(() => subscribeToQueued(), 500);
        } else if (status === ConnectionStatus.CONNECTING) {
          this.isConnecting = true;
        } else if (status === ConnectionStatus.DISCONNECTED) {
          this.isConnecting = false;
          // Don't log every disconnect to avoid spam, only log if we're not in a cooldown
          if (Date.now() - this.lastConnectionAttempt > this.connectionCooldown) {
            console.warn(`[RealtimeClient] ❌ Disconnected (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
          }
        }
        
        // Log status changes (but throttle disconnects)
        if (status !== previousStatus) {
          const statusEmoji = status === ConnectionStatus.CONNECTED ? '✅' : 
                             status === ConnectionStatus.CONNECTING ? '🔄' : '❌';
          // Only log disconnect if it's been a while since last attempt
          if (status !== ConnectionStatus.DISCONNECTED || Date.now() - this.lastConnectionAttempt > this.connectionCooldown) {
            console.log(`[RealtimeClient] ${statusEmoji} Status: ${status}`);
          }
        }
        
        // Notify all status callbacks
        const callbacks = Array.from(this.statusCallbacks);
        callbacks.forEach((callback) => {
          try {
            callback(status);
          } catch (error) {
            console.error('[RealtimeClient] ❌ Error in status callback:', error);
          }
        });
      },
    };

    try {
      const client = new RealTimeDataClient(args);
      this.client = client;
      // Always call connect() explicitly - the constructor doesn't connect automatically
      // autoReconnect only controls whether it reconnects after disconnection
      client.connect();
    } catch (error) {
      console.error('[RealtimeClient] ❌ Failed to create client:', error);
      this.isConnecting = false;
      this.connectionAttempts--;
    }
  }

  /**
   * Disconnect the client
   */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.isConnecting = false;
    this.messageCallbacks.clear();
    this.statusCallbacks.clear();
    this.subscriptions.clear();
    // Don't reset connection attempts on manual disconnect
  }

  /**
   * Manually reset connection attempts (for testing or manual retry)
   */
  resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
    this.isConnectionDisabled = false;
    this.lastConnectionAttempt = 0;
  }

  /**
   * Subscribe to a topic with optional filters
   * @param topic - Topic name (e.g., 'comments', 'clob_market', 'orders')
   * @param type - Message type (e.g., '*', 'comment_created', 'price_change')
   * @param filters - Optional JSON string filters
   * @param clobAuth - Optional CLOB API credentials
   * @param gammaAuth - Optional Gamma auth (wallet address)
   * @returns Unsubscribe function
   */
  subscribe(
    topic: string,
    type: string = '*',
    filters?: string,
    clobAuth?: { key: string; secret: string; passphrase: string },
    gammaAuth?: { address: string }
  ): () => void {
    const subscriptionKey = `${topic}:${type}:${filters || ''}`;
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`[RealtimeClient] ⏭️  Already subscribed to ${topic}/${type}`);
      // Return unsubscribe function for existing subscription
      return () => {
        // Remove from subscriptions map first
        const existingSub = this.subscriptions.get(subscriptionKey);
        this.subscriptions.delete(subscriptionKey);
        
        // Try to unsubscribe if client is connected
        if (this.client && this.getStatus() === ConnectionStatus.CONNECTED && existingSub) {
          try {
            this.client.unsubscribe(existingSub);
          } catch (error) {
            // Silently fail if WebSocket is not ready - subscription is already removed from map
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[RealtimeClient] Failed to unsubscribe from ${topic}/${type}:`, error);
            }
          }
        }
      };
    }
    
    const subscription: SubscriptionMessage = {
      subscriptions: [
        {
          topic,
          type,
          ...(filters && { filters }),
          ...(clobAuth && { clob_auth: clobAuth }),
          ...(gammaAuth && { gamma_auth: gammaAuth }),
        },
      ],
    };

    // Store subscription (queue it - will be subscribed when connection is ready)
    this.subscriptions.set(subscriptionKey, subscription);
    console.log(`[RealtimeClient] 📡 Queuing subscription to ${topic}/${type}${filters ? ` (filtered)` : ''}`);

    // Connect if not already connected or connecting
    if (!this.client && !this.isConnecting) {
      this.connect();
    }
    // Note: Subscriptions will be handled by onStatusChange when status becomes CONNECTED
    // This ensures the WebSocket is fully ready before subscribing

    // Return unsubscribe function
    return () => {
      // Remove from subscriptions map first
      this.subscriptions.delete(subscriptionKey);
      
      // Try to unsubscribe if client is connected
      if (this.client && this.getStatus() === ConnectionStatus.CONNECTED) {
        try {
          this.client.unsubscribe(subscription);
        } catch (error) {
          // Silently fail if WebSocket is not ready - subscription is already removed from map
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[RealtimeClient] Failed to unsubscribe from ${topic}/${type}:`, error);
          }
        }
      }
    };
  }

  /**
   * Subscribe to comments for a specific market
   * @param marketId - Market ID (numeric)
   * @param entityType - Entity type ('Event', 'Series', 'market') - according to Polymarket API docs
   * @param gammaAuth - Optional Gamma auth for user-specific data
   * @returns Unsubscribe function
   */
  subscribeToComments(
    marketId: string | number,
    entityType: string = 'market',
    gammaAuth?: { address: string }
  ): () => void {
    const filters = JSON.stringify({
      parentEntityID: typeof marketId === 'string' ? parseInt(marketId, 10) : marketId,
      parentEntityType: entityType,
    });

    return this.subscribe('comments', '*', filters, undefined, gammaAuth);
  }

  /**
   * Subscribe to CLOB market price changes (no auth required)
   * @param assetIds - Array of asset IDs (token IDs)
   * @returns Unsubscribe function
   */
  subscribeToClobMarketPriceChanges(assetIds: string[]): () => void {
    const filters = JSON.stringify(assetIds);
    return this.subscribe('clob_market', 'price_change', filters);
  }

  /**
   * Subscribe to aggregated orderbook (no auth required)
   * @param assetIds - Array of asset IDs (token IDs)
   * @returns Unsubscribe function
   */
  subscribeToOrderbook(assetIds: string[]): () => void {
    const filters = JSON.stringify(assetIds);
    return this.subscribe('clob_market', 'agg_orderbook', filters);
  }

  /**
   * Subscribe to price changes (no auth required)
   * @param assetIds - Array of asset IDs (token IDs)
   * @returns Unsubscribe function
   */
  subscribeToPriceChanges(assetIds: string[]): () => void {
    const filters = JSON.stringify(assetIds);
    return this.subscribe('clob_market', 'price_change', filters);
  }

  /**
   * Subscribe to last trade price (no auth required)
   * @param assetIds - Array of asset IDs (token IDs)
   * @returns Unsubscribe function
   */
  subscribeToLastTradePrice(assetIds: string[]): () => void {
    const filters = JSON.stringify(assetIds);
    return this.subscribe('clob_market', 'last_trade_price', filters);
  }

  /**
   * Subscribe to activity trades (no auth required)
   * @param marketSlug - Market slug for filtering
   * @returns Unsubscribe function
   */
  subscribeToActivityTrades(marketSlug?: string): () => void {
    const filters = marketSlug ? JSON.stringify({ market_slug: marketSlug }) : undefined;
    return this.subscribe('activity', 'trades', filters);
  }

  /**
   * Subscribe to activity orders matched (no auth required)
   * @param marketSlug - Market slug for filtering
   * @returns Unsubscribe function
   */
  subscribeToOrdersMatched(marketSlug?: string): () => void {
    const filters = marketSlug ? JSON.stringify({ market_slug: marketSlug }) : undefined;
    return this.subscribe('activity', 'orders_matched', filters);
  }

  /**
   * Subscribe to user orders (requires CLOB auth)
   * @param clobAuth - CLOB API credentials
   * @returns Unsubscribe function
   */
  subscribeToUserOrders(clobAuth: { key: string; secret: string; passphrase: string }): () => void {
    return this.subscribe('clob_user', 'order', undefined, clobAuth);
  }

  /**
   * Subscribe to user trades (requires CLOB auth)
   * @param clobAuth - CLOB API credentials
   * @returns Unsubscribe function
   */
  subscribeToUserTrades(clobAuth: { key: string; secret: string; passphrase: string }): () => void {
    return this.subscribe('clob_user', 'trade', undefined, clobAuth);
  }

  /**
   * Register a callback for all messages
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => {
      this.messageCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for connection status changes
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    // Check if client exists and WebSocket is actually open
    if (!this.client) {
      return false;
    }
    
    // The RealTimeDataClient doesn't expose WebSocket state directly
    // We'll track connection state via status callbacks
    return !this.isConnecting;
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    if (!this.client) {
      return ConnectionStatus.DISCONNECTED;
    }
    if (this.isConnecting) {
      return ConnectionStatus.CONNECTING;
    }
    return ConnectionStatus.CONNECTED;
  }
}

// Singleton instance - lazy initialization
let realtimeClientInstance: PolymarketRealtimeAdapter | null = null;

function getRealtimeClient(): PolymarketRealtimeAdapter {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new PolymarketRealtimeAdapter();
  }
  return realtimeClientInstance;
}

export const realtimeClient = new Proxy({} as PolymarketRealtimeAdapter, {
  get(_target, prop) {
    const instance = getRealtimeClient();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export default realtimeClient;

