// WebSocket client for real-time Polymarket data
// Uses CLOB WebSocket: wss://ws-subscriptions-clob.polymarket.com/ws/
// Requires CLOB API key for authentication

type WebSocketCallback = (data: any) => void;

class PolymarketWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased max attempts
  private baseReconnectDelay = 1000; // Base delay in ms
  private maxReconnectDelay = 30000; // Max delay: 30 seconds
  private callbacks: Map<string, Set<WebSocketCallback>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private messageQueue: Array<{ type: string; data: any; timestamp: number }> = []; // Message queue for reconnection
  private maxQueueSize = 100; // Max messages to queue
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;

  constructor(url: string, apiKey?: string) {
    this.url = url;
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY;
  }

  /**
   * Check if CLOB API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (this.isConnected()) {
      // Reconnect with new API key
      this.disconnect();
      this.connect();
    }
  }

  connect(): void {
    // Don't connect if API key is not configured
    if (!this.apiKey) {
      console.warn('CLOB API key not configured - WebSocket connection disabled');
      console.warn('WebSocket requires CLOB API key for real-time order book and trade updates');
      return;
    }

    try {
      // CLOB WebSocket URL with API key
      const wsUrl = this.url.includes('?') 
        ? `${this.url}&apiKey=${this.apiKey}` 
        : `${this.url}?apiKey=${this.apiKey}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Polymarket CLOB WebSocket connected');
        this.reconnectAttempts = 0;
        this.connectionState = 'connected';
        this.lastPongTime = Date.now();
        this.startPing();
        this.startHealthCheck();
        
        // Process queued messages
        this.processMessageQueue();
        
        // Subscribe to channels if needed
        // Example: this.ws.send(JSON.stringify({ type: 'subscribe', channel: 'orderbook', token_id: '...' }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle pong responses
          if (data.type === 'pong' || data.type === 'ping') {
            this.lastPongTime = Date.now();
            return;
          }
          
          this.handleMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        this.stopPing();
        this.stopHealthCheck();
        this.connectionState = 'disconnected';
        
        // Only reconnect if it wasn't an intentional close and we have API key
        if (event.code !== 1000 && this.apiKey) {
          this.connectionState = 'reconnecting';
          this.reconnect();
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      if (this.apiKey) {
        this.reconnect();
      }
    }
  }

  private handleMessage(data: any): void {
    // Handle different message types from CLOB WebSocket
    if (data.type === 'orderbook' || data.channel === 'orderbook') {
      this.notifyCallbacks('orderbook', data);
    } else if (data.type === 'fill' || data.channel === 'fills' || data.type === 'trade') {
      this.notifyCallbacks('trade', data);
    } else if (data.type === 'price' || data.channel === 'price') {
      this.notifyCallbacks('price', data);
    } else if (data.type === 'order' || data.channel === 'orders') {
      this.notifyCallbacks('order', data);
    }
    
    // Update last message time for health check
    this.lastPongTime = Date.now();
  }

  /**
   * Queue message for processing after reconnection
   */
  private queueMessage(type: string, data: any): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message
      this.messageQueue.shift();
    }
    this.messageQueue.push({
      type,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    // Process messages in order
    this.messageQueue.forEach((item) => {
      // Only process recent messages (within last 5 minutes)
      const age = Date.now() - item.timestamp;
      if (age < 5 * 60 * 1000) {
        this.handleMessage(item.data);
      }
    });
    
    // Clear queue after processing
    this.messageQueue = [];
  }

  /**
   * Start health check to detect stale connections
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      
      // If no pong received in 60 seconds, consider connection stale
      if (timeSinceLastPong > 60000 && this.isConnected()) {
        console.warn('WebSocket health check failed - no response in 60 seconds');
        this.disconnect();
        if (this.apiKey) {
          this.connectionState = 'reconnecting';
          this.reconnect();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health check
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private notifyCallbacks(type: string, data: any): void {
    const callbacks = this.callbacks.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  subscribe(type: string, callback: WebSocketCallback): () => void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);

    // If connected, send subscription message immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel: type }));
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(type);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(type);
          // If connected, send unsubscribe message
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'unsubscribe', channel: type }));
          }
        }
      }
    };
  }

  /**
   * Subscribe to a specific market's data
   */
  subscribeToMarket(marketId: string, channels: string[], callback: WebSocketCallback): () => void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, subscription will be queued');
    }

    const unsubscribeFunctions: Array<() => void> = [];

    channels.forEach((channel) => {
      const fullChannel = `${channel}:${marketId}`;
      const unsubscribe = this.subscribe(fullChannel, (data) => {
        // Only call callback if data matches this market
        if (data.marketId === marketId || data.id === marketId) {
          callback(data);
        }
      });
      unsubscribeFunctions.push(unsubscribe);
    });

    // Return unsubscribe function that unsubscribes from all channels
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }

  /**
   * Get current subscription count
   */
  getSubscriptionCount(): number {
    let count = 0;
    this.callbacks.forEach((callbacks) => {
      count += callbacks.size;
    });
    return count;
  }

  /**
   * Get subscription count by channel
   */
  getSubscriptionCountByChannel(channel: string): number {
    return this.callbacks.get(channel)?.size || 0;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private reconnect(): void {
    if (!this.apiKey) {
      console.warn('Cannot reconnect - CLOB API key not configured');
      this.connectionState = 'disconnected';
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.connectionState = 'disconnected';
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    // Formula: baseDelay * 2^(attempt - 1) + random(0, baseDelay)
    const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * this.baseReconnectDelay;
    const delay = Math.min(exponentialDelay + jitter, this.maxReconnectDelay);

    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      if (this.connectionState === 'reconnecting') {
        this.connectionState = 'connecting';
        this.connect();
      }
    }, delay);
  }

  disconnect(): void {
    this.stopPing();
    this.stopHealthCheck();
    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }
    this.callbacks.clear();
    this.reconnectAttempts = 0;
    this.connectionState = 'disconnected';
    this.messageQueue = []; // Clear message queue on intentional disconnect
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.connectionState === 'connected';
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    return this.connectionState;
  }

  /**
   * Get reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Singleton instance
// CLOB WebSocket URL: wss://ws-subscriptions-clob.polymarket.com/ws/
const WS_URL = process.env.NEXT_PUBLIC_POLYMARKET_CLOB_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/';
export const polymarketWS = new PolymarketWebSocket(WS_URL);

export default polymarketWS;
