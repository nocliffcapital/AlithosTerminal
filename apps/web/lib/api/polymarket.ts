// Polymarket API client
// Based on: https://docs.polymarket.com/
// Uses multiple APIs:
// 1. Gamma Markets API - Market metadata (no key required)
// 2. CLOB API - Order books, trading (requires key)
// 3. Data-API - Positions, trades, activity (mixed public/authenticated)
// 4. Subgraph - Historical data (optional)

// API Endpoints
// Legacy Gamma API (may be deprecated)
const GAMMA_API_BASE = process.env.NEXT_PUBLIC_POLYMARKET_GAMMA_API_URL || 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com';
const DATA_API_BASE = process.env.NEXT_PUBLIC_POLYMARKET_DATA_API_URL || 'https://data-api.polymarket.com';
// Subgraph configuration - supports Goldsky (official) and The Graph subgraphs
// Goldsky subgraphs (official Polymarket):
// - Orderbook: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn
// - Positions: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn
// - Activity: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn
// - Open Interest: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn
// - PNL: https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn
//
// The Graph subgraphs (legacy):
// - Main Polymarket: 81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC
// - Activity Polygon: Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp
// - Open Interest: ELaW6RtkbmYNmMMU6hEPsghG9Ko3EXSmiRkH855M4qfF
// - Profit and Loss: 6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz
// - Orderbook: 7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrQxphhoEypyY
// - Names: 22CoTbEtpv6fURB6moTNfJPWNUPXtiFGRA8h1zajMha3

// Goldsky base URL (official Polymarket subgraphs)
// Based on: https://github.com/Polymarket/polymarket-subgraph
const GOLDSKY_BASE_URL = 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs';
// Note: FPMM and Polymarket subgraphs don't have versioned endpoints, using The Graph as fallback
// Goldsky URLs that don't exist will return 404 and fallback to The Graph automatically
const GOLDSKY_SUBGRAPH_FPMM = null; // Not available on Goldsky - use The Graph instead
const GOLDSKY_SUBGRAPH_POLYMARKET = null; // Not available on Goldsky - use The Graph instead
const GOLDSKY_SUBGRAPH_ORDERBOOK = `${GOLDSKY_BASE_URL}/orderbook-subgraph/0.0.1/gn`;
const GOLDSKY_SUBGRAPH_POSITIONS = `${GOLDSKY_BASE_URL}/positions-subgraph/0.0.7/gn`;
const GOLDSKY_SUBGRAPH_ACTIVITY = `${GOLDSKY_BASE_URL}/activity-subgraph/0.0.4/gn`;
const GOLDSKY_SUBGRAPH_OPEN_INTEREST = `${GOLDSKY_BASE_URL}/oi-subgraph/0.0.6/gn`;
const GOLDSKY_SUBGRAPH_PNL = `${GOLDSKY_BASE_URL}/pnl-subgraph/0.0.14/gn`;

// Legacy The Graph support
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL;
const SUBGRAPH_API_KEY = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_API_KEY;
const SUBGRAPH_ID_MAIN = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_MAIN || '81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC';
const SUBGRAPH_ID_ACTIVITY = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_ACTIVITY || 'Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp';
const SUBGRAPH_ID_PNL = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_PNL || '6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz';
const SUBGRAPH_ID_ORDERBOOK = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_ORDERBOOK || '7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrXxphhoEypyY';

export interface Market {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  endDate: string;
  resolutionSource: string;
  resolutionCriteria?: string; // Resolution rules/criteria text
  imageUrl?: string;
  active: boolean;
  archived: boolean;
  category?: string;
  volume?: number;
  liquidity?: number;
  outcomePrices?: {
    YES: number;
    NO: number;
  };
  // CLOB-specific fields for fast price history
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner?: boolean;
  }>;
  clobTokenIds?: string[]; // Array of token IDs [NO, YES] or [outcome1, outcome2]
  // Event information for grouping related markets
  eventId?: string; // ID of the parent event
  eventImageUrl?: string; // Event-level image (should be used for multimarkets)
  eventTitle?: string; // Event title/name
}

export interface MarketPrice {
  marketId: string;
  outcome: 'YES' | 'NO';
  price: number;
  probability: number;
  volume24h: number;
  liquidity: number;
}

export interface OrderBook {
  marketId: string;
  outcome: 'YES' | 'NO';
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
}

export interface Trade {
  id: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  price: number;
  timestamp: number;
  user: string;
  transactionHash: string;
}

export interface Position {
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: string;
  costBasis: number;
  currentValue: number;
}

class PolymarketClient {
  private clobApiKey?: string;
  private hasClobApiKey: boolean;
  // Error deduplication: track seen errors to prevent spam
  private seenErrors = new Map<string, number>();
  private readonly ERROR_DEDUP_WINDOW = 60000; // 60 seconds

  constructor(clobApiKey?: string) {
    // CLOB API key is required for order placement and some order book features
    this.clobApiKey = clobApiKey || process.env.NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY;
    this.hasClobApiKey = !!this.clobApiKey;
    
    // Only log warning once per session (suppress repeated warnings)
    if (!this.hasClobApiKey && typeof window !== 'undefined' && !(window as any).__polymarket_clob_warned) {
      (window as any).__polymarket_clob_warned = true;
      // Suppress these warnings - they're informational, not errors
      // console.warn('CLOB API key not configured. Order placement and some features will be unavailable.');
      // console.warn('Note: Gamma API (public) will still work for market data.');
    }
  }

  /**
   * Log error with deduplication to prevent console spam
   */
  private logErrorOnce(key: string, message: string, error?: any, level: 'error' | 'warn' = 'warn'): void {
    const now = Date.now();
    const lastSeen = this.seenErrors.get(key);
    
    // Only log if we haven't seen this error recently
    if (!lastSeen || now - lastSeen > this.ERROR_DEDUP_WINDOW) {
      this.seenErrors.set(key, now);
      
      // Clean old entries periodically (keep last 100)
      if (this.seenErrors.size > 100) {
        const entries = Array.from(this.seenErrors.entries());
        entries.sort((a, b) => b[1] - a[1]);
        this.seenErrors = new Map(entries.slice(0, 50));
      }
      
      if (level === 'error') {
        if (error) {
          console.error(message, error);
        } else {
          console.error(message);
        }
      } else {
        if (error) {
          console.warn(message, error);
        } else {
          console.warn(message);
        }
      }
    }
  }

  /**
   * Check if CLOB API is configured
   */
  isConfigured(): boolean {
    return this.hasClobApiKey;
  }

  /**
   * Update CLOB API key at runtime
   */
  setApiKey(apiKey: string) {
    this.clobApiKey = apiKey;
    this.hasClobApiKey = !!apiKey;
  }

  /**
   * Fetch from Gamma API (public, no key required)
   */
  private async fetchGamma<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const url = `${GAMMA_API_BASE}${endpoint}`;
      // Suppress verbose logs to reduce console noise
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        // Only log errors once per request
        const errorKey = `gamma-api-${response.status}-${url.substring(0, 50)}`;
        if (!this.seenErrors.has(errorKey)) {
          this.seenErrors.set(errorKey, Date.now());
          console.error('[Gamma API] Error response:', errorText.substring(0, 200));
        }
        throw new Error(`Gamma API error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Gamma API] Fetch error:', error);
      if (error instanceof Error) {
        console.error('[Gamma API] Error message:', error.message);
        console.error('[Gamma API] Error stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Fetch from CLOB API
   * Supports both L1 (wallet signature) and L2 (API key) authentication
   * L1 authentication is preferred - uses wallet directly, no API key needed!
   * L2 authentication uses API key for convenience (created via /auth/api-key)
   */
  private async fetchCLOB<T>(
    endpoint: string, 
    options?: RequestInit,
    useL1Auth?: boolean,
    walletAddress?: string,
    walletClient?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // L1 Authentication (wallet signature) - preferred method
    // See: https://docs.polymarket.com/developers/CLOB/authentication
    if (useL1Auth && walletAddress && walletClient) {
      try {
        const { generateL1AuthHeaders } = await import('./clob-auth');
        const l1Headers = await generateL1AuthHeaders(
          walletAddress as any,
          walletClient
        );
        Object.assign(headers, l1Headers);
      } catch (error) {
        console.error('Error generating L1 auth headers:', error);
        // Fall back to L2 if L1 fails
      }
    }

    // L2 Authentication (API key) - fallback or convenience method
    if (!useL1Auth && this.hasClobApiKey) {
      // For L2 auth, we'd need to generate HMAC signature
      // This requires the API secret which should be stored securely
      // For now, we'll note that L1 authentication is preferred
      if (endpoint.includes('/orders') || endpoint.includes('/fills')) {
        // For authenticated endpoints, prefer L1 auth
        // If L2 is required, API secret needs to be configured
        console.warn('Using API key for L2 auth - HMAC signing not yet implemented. Prefer L1 wallet auth.');
      }
      // Basic API key header (some endpoints may accept this)
      Object.assign(headers, {
        'X-API-Key': this.clobApiKey,
      });
    }

    // If neither L1 nor L2 auth and endpoint requires auth, throw error
    if (!useL1Auth && !this.hasClobApiKey && 
        (endpoint.includes('/orders') || endpoint.includes('/fills') || endpoint.includes('/auth/'))) {
      throw new Error(
        'CLOB API authentication required. ' +
        'Use L1 authentication (wallet signature) or configure API key for L2 authentication. ' +
        'See: https://docs.polymarket.com/developers/CLOB/authentication'
      );
    }

    // In browser, use API proxy route to avoid CORS for /book endpoint
    if (typeof window !== 'undefined' && endpoint.includes('/book')) {
      try {
        // Extract token_id from endpoint (format: /book?token_id=...)
        const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
        const tokenId = urlParams.get('token_id');
        
        if (!tokenId) {
          throw new Error('token_id parameter is required for /book endpoint');
        }
        
        // Use proxy route
        const proxyUrl = `/api/polymarket/clob/book?token_id=${encodeURIComponent(tokenId)}`;
        // Suppress repeated log messages
        
        // Forward L1 auth headers to proxy route
        const proxyHeaders: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        // Forward L1 auth headers if present
        const authHeaderNames = [
          'x-polymarket-signature',
          'x-polymarket-signature-expiration',
          'x-polymarket-signature-address',
        ];
        
        authHeaderNames.forEach(headerName => {
          const headersObj = headers as Record<string, string | undefined>;
          const headerValue = headersObj[headerName.toLowerCase()] || headersObj[headerName];
          if (headerValue) {
            proxyHeaders[headerName] = String(headerValue);
          }
        });
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: proxyHeaders,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const errorData = await response.json().catch(() => ({ error: errorText }));
          throw new Error(errorData.error || `CLOB API error (${response.status}): ${errorText}`);
        }

        return response.json();
      } catch (error: any) {
        // Only log error details if it's a new error (not a retry)
        if (!error.message?.includes('retry')) {
          console.error('[fetchCLOB] Proxy route error:', error.message || error);
        }
        throw error;
      }
    }

    try {
      const response = await fetch(`${CLOB_API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CLOB API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('CLOB API fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch from Data-API (some endpoints public, others need CLOB auth)
   */
  private async fetchData<T>(endpoint: string, options?: RequestInit, requiresAuth = false): Promise<T> {
    if (requiresAuth && !this.hasClobApiKey) {
      throw new Error('CLOB API key required for authenticated Data-API endpoints');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(requiresAuth && this.clobApiKey && { 'Authorization': `Bearer ${this.clobApiKey}` }),
      ...(requiresAuth && this.clobApiKey && { 'X-API-Key': this.clobApiKey }),
      ...options?.headers,
    };

    try {
      const response = await fetch(`${DATA_API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Data-API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Data-API fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch from Subgraph (GraphQL, optional)
   * Supports Goldsky (official) and The Graph Gateway format with API key
   * @param subgraphType - Type of subgraph to use ('orderbook' | 'positions' | 'activity' | 'open-interest' | 'pnl' | 'main')
   * @param subgraphId - Legacy: Specific The Graph subgraph ID to use (defaults to main Polymarket subgraph)
   */
  private async fetchSubgraph<T>(
    query: string, 
    variables?: Record<string, unknown>, 
    subgraphType?: 'fpmm' | 'polymarket' | 'orderbook' | 'positions' | 'activity' | 'open-interest' | 'pnl' | 'main',
    subgraphId?: string,
    suppressErrors = false
  ): Promise<T> {
    // Determine which Goldsky subgraph URL to use
    // Based on: https://github.com/Polymarket/polymarket-subgraph
    let goldskyUrl: string | null = null;
    if (subgraphType) {
      switch (subgraphType) {
        case 'fpmm':
          goldskyUrl = GOLDSKY_SUBGRAPH_FPMM;
          break;
        case 'polymarket':
          goldskyUrl = GOLDSKY_SUBGRAPH_POLYMARKET;
          break;
        case 'orderbook':
          goldskyUrl = GOLDSKY_SUBGRAPH_ORDERBOOK;
          break;
        case 'positions':
          goldskyUrl = GOLDSKY_SUBGRAPH_POSITIONS;
          break;
        case 'activity':
          goldskyUrl = GOLDSKY_SUBGRAPH_ACTIVITY;
          break;
        case 'open-interest':
          goldskyUrl = GOLDSKY_SUBGRAPH_OPEN_INTEREST;
          break;
        case 'pnl':
          goldskyUrl = GOLDSKY_SUBGRAPH_PNL;
          break;
        case 'main':
        default:
          // For main, try fpmm first (markets), then polymarket, then custom URL, then The Graph
          goldskyUrl = GOLDSKY_SUBGRAPH_FPMM;
          break;
      }
    }

    // Try Goldsky subgraph first (official Polymarket subgraphs - no API key needed)
    // Skip if goldskyUrl is null (e.g., FPMM/Polymarket subgraphs not available on Goldsky)
    if (goldskyUrl) {
      try {
        const response = await fetch(goldskyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          // If 404, skip to fallback (subgraph doesn't exist on Goldsky)
          if (response.status === 404) {
            throw new Error(`Goldsky subgraph not found (404) - will try fallback`);
          }
          throw new Error(`Subgraph error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        if (data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
      } catch (error: any) {
        // Only log errors that aren't expected 404s (when subgraph doesn't exist on Goldsky) or if not suppressing
        if (!suppressErrors && !error?.message?.includes('404') && !error?.message?.includes('not found')) {
          const errorKey = `goldsky-${subgraphType || 'unknown'}-${error?.message?.substring(0, 50) || 'unknown'}`;
          this.logErrorOnce(errorKey, 'Goldsky subgraph fetch error:', error, 'error');
        }
        // Fall through to try other options (The Graph fallback)
      }
    }

    // Check if we have a direct Subgraph URL configured (custom/override)
    if (SUBGRAPH_URL) {
      try {
        const response = await fetch(SUBGRAPH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          throw new Error(`Subgraph error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        if (data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
      } catch (error: any) {
        if (!suppressErrors) {
          const errorKey = `subgraph-${subgraphType || 'unknown'}-${error?.message?.substring(0, 50) || 'unknown'}`;
          this.logErrorOnce(errorKey, 'Subgraph fetch error:', error, 'error');
        }
        throw error;
      }
    }

    // If no direct URL, try to construct The Graph Gateway URL with API key (legacy)
    if (SUBGRAPH_API_KEY) {
      // Use provided subgraph ID or default to main
      const targetSubgraphId = subgraphId || SUBGRAPH_ID_MAIN;
      const gatewayUrl = `https://gateway.thegraph.com/api/${SUBGRAPH_API_KEY}/subgraphs/id/${targetSubgraphId}`;
      
      try {
        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          throw new Error(`Subgraph error (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        if (data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
      } catch (error: any) {
        if (!suppressErrors) {
          const errorKey = `thegraph-${subgraphType || 'unknown'}-${error?.message?.substring(0, 50) || 'unknown'}`;
          this.logErrorOnce(errorKey, 'The Graph subgraph fetch error:', error, 'error');
        }
        throw error;
      }
    }

    throw new Error('Subgraph URL or API key not configured. Goldsky subgraphs should work without configuration.');
  }

  /**
   * Fetch markets from Gamma API (public, no key required)
   */
  async getMarkets(params?: {
    active?: boolean;
    archived?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<Market[]> {
    try {
      // Suppress verbose logs to reduce console noise
      
      // If no limit is specified, fetch all markets (pass null to API)
      const limit = params?.limit;
      
      // FIRST: Try Gamma API directly for real market data (has questions, slugs, etc.)
      // This is the best source for actual market information
      const activeParam = params?.active !== false;
      const limitParam = limit;
      let gammaMarkets: any[] = [];
      
      try {
        
        // In browser, use API route to avoid CORS
        // Use closed=false to only get open markets (not old closed ones)
        // Note: When category is specified, API route will use events endpoint and filter by tag slug
        if (typeof window !== 'undefined') {
          const categoryParam = params?.category ? `&category=${encodeURIComponent(params.category)}` : '';
          const tagParam = params?.category ? `&tag=${encodeURIComponent(params.category)}` : '';
          // If limit is undefined, don't pass limit parameter (API will fetch all)
          const limitParam = limit === undefined ? '' : `&limit=${limit === null ? 'all' : limit}`;
          const apiUrl = `/api/polymarket/markets?active=${activeParam}&closed=false${limitParam}${categoryParam}${tagParam}`;
          // Suppress verbose logs
          
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          try {
            const response = await fetch(apiUrl, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              gammaMarkets = await response.json();
            } else {
              const errorText = await response.text().catch(() => '');
              let errorData: any;
              try {
                errorData = JSON.parse(errorText);
              } catch {
                errorData = { error: errorText || `API route error (${response.status}): ${response.statusText}` };
              }
              throw new Error(errorData.error || `API route error (${response.status}): ${response.statusText}`);
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
              throw new Error('Request timeout - markets API took too long to respond');
            }
            throw fetchError;
          }
        } else {
          // On server, call Gamma API directly or use events endpoint if category is specified
          // Note: Markets endpoint doesn't support category filtering, so use events endpoint
          if (params?.category) {
            // Use events endpoint and filter by tag slug (same as API route)
            const eventsUrl = `${GAMMA_API_BASE}/events?active=${activeParam}&closed=false&limit=500`;
            console.log('[getMarkets] Fetching events from Gamma API (server):', eventsUrl);
            
            const eventsResponse = await fetch(eventsUrl);
            if (eventsResponse.ok) {
              const events = await eventsResponse.json();
              
              // Filter events by matching tag slug in the events' tags array
              const filterValueLower = params.category.toLowerCase();
              const filteredEvents = events.filter((event: any) => {
                const eventTags = event.tags || [];
                return eventTags.some((tag: any) => {
                  const tagSlug = tag?.slug?.toLowerCase();
                  return tagSlug === filterValueLower || 
                         tagSlug?.includes(filterValueLower) || 
                         filterValueLower.includes(tagSlug || '');
                });
              });
              
              // Extract markets from filtered events and assign the matching tag slug as category
              gammaMarkets = filteredEvents.flatMap((event: any) => {
                if (event.markets && Array.isArray(event.markets)) {
                  // Find the matching tag slug to use as category
                  const matchingTag = event.tags?.find((tag: any) => {
                    const tagSlug = tag?.slug?.toLowerCase();
                    return tagSlug === filterValueLower || 
                           tagSlug?.includes(filterValueLower) || 
                           filterValueLower.includes(tagSlug || '');
                  });
                  
                  // Get event-level image (events often have logos like NYC seal)
                  // Check multiple possible field names for event images
                  const eventImage = event.imageUrl || 
                                    event.image || 
                                    event.icon || 
                                    event.logo ||
                                    event.image_url ||
                                    event.cover_image ||
                                    event.thumbnail ||
                                    event.photo ||
                                    event.picture ||
                                    undefined;
                  
                  // Debug: Log event image extraction for multimarkets
                  if (event.markets.length > 1 && eventImage) {
                    console.log(`[getMarkets] Event "${event.title || event.name || event.id}" has ${event.markets.length} markets and image:`, eventImage);
                  }
                  
                  return event.markets.map((market: any) => {
                    // Check all possible market image fields
                    const marketImage = market.imageUrl || 
                                      market.image || 
                                      market.icon ||
                                      market.image_url ||
                                      market.cover_image ||
                                      market.thumbnail ||
                                      market.photo ||
                                      market.picture ||
                                      undefined;
                    
                    // Use market-specific image first, only fall back to event image if market doesn't have one
                    // Each market should have its own image (e.g., candidate headshot, team logo)
                    // Event image is only used as a fallback when market doesn't have its own image
                    const finalImageUrl = marketImage || eventImage || undefined;
                    
                    // Debug: Log when we assign event image to a multimarket
                    if (eventImage && !marketImage && event.markets.length > 1) {
                      console.log(`[getMarkets] Assigning event image to multimarket "${market.question || market.id}":`, eventImage);
                    }
                    
                    return {
                      ...market,
                      // Assign the matching tag slug as the category
                      category: matchingTag?.slug || params.category,
                      // Use event image if market doesn't have one (events have logos like NYC seal)
                      // Prioritize event image for multimarkets
                      imageUrl: finalImageUrl,
                      // Store event information for grouping
                      eventId: event.id || event.slug || event.title,
                      eventImageUrl: eventImage,
                      eventTitle: event.title || event.name,
                    };
                  });
                }
                return [];
              });
              
              console.log(`[getMarkets] ✅ Got ${events.length} events, filtered to ${filteredEvents.length} events with tag "${params.category}", extracted ${gammaMarkets.length} markets`);
            } else {
              throw new Error(`Gamma API events error (${eventsResponse.status}): ${eventsResponse.statusText}`);
            }
          } else {
            // No category filter, use markets endpoint
            // Use a very large limit if no limit specified
            const marketsLimit = limitParam === undefined ? 10000 : limitParam;
            const gammaUrl = `${GAMMA_API_BASE}/markets?active=${activeParam}&closed=false&limit=${marketsLimit}`;
            console.log('[getMarkets] Fetching markets from Gamma API (server):', gammaUrl);
            
            const response = await fetch(gammaUrl);
            if (response.ok) {
              gammaMarkets = await response.json();
            } else {
              throw new Error(`Gamma API error (${response.status}): ${response.statusText}`);
            }
          }
        }
        
        // If we got markets from browser or we're on server, use them
        if (gammaMarkets.length > 0) {
          console.log('[getMarkets] ✅ Got', gammaMarkets.length, 'markets from Gamma API');
          
          // Debug: Log sample market structure to understand available fields
          if (gammaMarkets.length > 0 && gammaMarkets[0]) {
            const sample = gammaMarkets[0];
            const categoryFields = ['category', 'tag', 'tags', 'categorySlug', 'categoryName'];
            const sampleFields = categoryFields.map(field => ({ [field]: sample[field] })).reduce((a, b) => ({ ...a, ...b }), {});
            console.log('[getMarkets] Sample market category fields:', sampleFields);
            console.log('[getMarkets] Sample market keys:', Object.keys(sample).filter(k => k.toLowerCase().includes('categor') || k.toLowerCase().includes('tag')));
          }
          
          const now = new Date();
          
          const markets: Market[] = gammaMarkets
            .filter((m: any) => {
              // Filter out closed markets (even if API returned them)
              if (m.closed === true) {
                return false;
              }
              
              // Filter out archived markets
              if (m.archived === true) {
                return false;
              }
              
              // Optionally filter out markets that have already ended
              if (m.endDate) {
                try {
                  const endDate = new Date(m.endDate || m.endDateIso || m.end_date_iso);
                  // Only include markets that haven't ended yet (with 1 hour buffer)
                  if (endDate.getTime() < now.getTime() - 60 * 60 * 1000) {
                    return false;
                  }
                } catch (e) {
                  // If date parsing fails, include the market anyway
                }
              }
              
              return true;
            })
            .map((m: any) => {
              // Parse outcomePrices if it's a JSON string
              let outcomePrices: { YES: number; NO: number } | undefined;
              if (typeof m.outcomePrices === 'string') {
                try {
                  const parsed = JSON.parse(m.outcomePrices);
                  if (Array.isArray(parsed) && parsed.length >= 2) {
                    outcomePrices = {
                      YES: parseFloat(parsed[0]) || 0.5,
                      NO: parseFloat(parsed[1]) || 0.5,
                    };
                  }
                } catch (e) {
                  // If parsing fails, use defaults
                  outcomePrices = { YES: 0.5, NO: 0.5 };
                }
              } else if (m.outcomePrices && typeof m.outcomePrices === 'object') {
                outcomePrices = m.outcomePrices;
              } else {
                outcomePrices = { YES: 0.5, NO: 0.5 };
              }
              
              // Extract category from various possible fields
              // Markets can have category directly, or we can get it from the event
              let category = m.category || m.tag || m.tags?.[0] || m.categorySlug || undefined;
              
              // If no category on market, try to get it from the event (markets are nested in events)
              let eventImage: string | undefined;
              if (m.events && m.events.length > 0) {
                const event = m.events[0];
                if (!category) {
                  category = event.category;
                }
                // Get event-level image (events often have logos like NYC seal)
                // Check multiple possible field names
                eventImage = event.imageUrl || 
                            event.image || 
                            event.icon || 
                            event.logo ||
                            event.image_url ||
                            event.cover_image ||
                            event.thumbnail ||
                            event.photo ||
                            event.picture ||
                            undefined;
              }
              
              // Normalize category value
              if (category && typeof category === 'string') {
                category = category.trim();
                if (category === '') category = undefined;
              }
              
              // Use event image if market doesn't have one
              // Check all possible market image fields
              const marketImage = m.imageUrl || 
                                 m.image || 
                                 m.icon ||
                                 m.image_url ||
                                 m.cover_image ||
                                 m.thumbnail ||
                                 m.photo ||
                                 m.picture ||
                                 undefined;
              const finalImageUrl = marketImage || eventImage || undefined;
              
              // Debug: Log when we find event images
              if (eventImage && !marketImage) {
                console.log(`[getMarkets] Using event image for market ${m.id}:`, eventImage);
              }
              
              // Extract tokens array if available (for multimarket detection)
              let tokens: Array<{ token_id: string; outcome: string; price: number; winner?: boolean }> | undefined;
              let clobTokenIds: string[] | undefined;
              
              // Check if tokens array exists in the raw market data
              if (m.tokens && Array.isArray(m.tokens)) {
                tokens = m.tokens.map((t: any) => ({
                  token_id: t.token_id || t.tokenId || t.id || '',
                  outcome: t.outcome || t.name || '',
                  price: t.price || parseFloat(t.price) || 0,
                  winner: t.winner,
                }));
                clobTokenIds = tokens?.map(t => t.token_id).filter(Boolean);
              }
              
            return {
              id: m.id?.toString() || m.conditionId || m.slug,
              question: m.question || m.title || m.name || `Market ${m.id}`,
              slug: m.slug || m.id?.toString() || '',
              conditionId: m.conditionId || m.id?.toString() || '',
              endDate: m.endDate || m.endDateIso || m.end_date_iso || '',
              resolutionSource: m.resolutionSource || m.resolution_source || m.primaryResolutionSource || m.primary_resolution_source || '',
              resolutionCriteria: m.resolutionCriteria || m.resolution_criteria || m.rules || m.description || undefined,
              imageUrl: finalImageUrl,
              active: m.active !== false,
              archived: m.archived === true,
              category,
              volume: m.volumeNum || parseFloat(m.volume) || undefined,
              liquidity: m.liquidityNum || parseFloat(m.liquidity) || undefined,
              outcomePrices,
              tokens,
              clobTokenIds,
              // Preserve event information if available
              eventId: m.eventId,
              eventImageUrl: m.eventImageUrl,
              eventTitle: m.eventTitle,
            };
            });
          
          // Smarter filtering: Group markets by event and detect outcome tokens based on event structure
          // Outcome tokens typically have generic names and are part of events with many markets
          
          // First, group markets by eventId to analyze event structure
          const marketsByEvent: Record<string, typeof markets> = {};
          markets.forEach((market) => {
            if (market.eventId) {
              if (!marketsByEvent[market.eventId]) {
                marketsByEvent[market.eventId] = [];
              }
              marketsByEvent[market.eventId].push(market);
            }
          });
          
          // Detect generic outcome patterns (comprehensive)
          const isGenericOutcome = (question: string): boolean => {
            if (!question) return false;
            const q = question.trim();
            
            // Pattern: Generic names like "Company X", "Movie X", "Person X", "Team X", etc.
            const genericPattern = /^(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s*$/i;
            if (genericPattern.test(q)) return true;
            
            // Pattern: With question mark
            const genericWithQ = /^(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s*\?$/i;
            if (genericWithQ.test(q)) return true;
            
            // Pattern: "Will [Generic] X win..." or "Will [Generic] X be..."
            const willGenericPattern = /^Will\s+(?:Company|Movie|Person|Team|Player|Candidate|Option|Outcome|Choice)\s+[A-Z0-9]{1,3}\s+(?:win|be)/i;
            if (willGenericPattern.test(q)) return true;
            
            // Pattern: "another X"
            if (/^another\s+(?:company|movie|person|team|player|candidate|option|outcome|choice)/i.test(q)) return true;
            
            // Pattern: "someone else", "someone", "other", "others", etc. - generic placeholder outcomes
            if (/^(?:someone\s+else|someone|other|others|none|other\s+option|other\s+choice)$/i.test(q)) return true;
            
            return false;
          };
          
          // Filter out outcome tokens based on event structure
          let filtered = markets.filter((market) => {
            // If market has generic name pattern, check if it's part of an event
            if (market.eventId && isGenericOutcome(market.question || '')) {
              const eventMarkets = marketsByEvent[market.eventId] || [];
              
              // If event has 3+ markets (multimarket), and this is a generic outcome, filter it out
              // Generic outcomes like "Person A", "someone else" should not be shown as standalone markets
              // Only keep them if they have significant trading activity (real markets)
              if (eventMarkets.length >= 3) {
                // Check for any trading activity - if no volume/liquidity, it's an outcome token
                const hasAnyVolume = market.volume && market.volume > 0;
                const hasAnyLiquidity = market.liquidity && market.liquidity > 0;
                
                // If it's a generic outcome with no volume/liquidity, filter it out
                // This catches "Person A", "Person B", "someone else", etc. in multimarkets
                if (!hasAnyVolume && !hasAnyLiquidity) {
                  return false; // Filter out - likely an outcome token
                }
                
                // Even if it has some volume, if it's very low (< $100) and it's a generic outcome in a multimarket, filter it
                // Real markets in multimarkets typically have more activity
                const hasVeryLowVolume = market.volume && market.volume > 0 && market.volume < 100;
                const hasVeryLowLiquidity = market.liquidity && market.liquidity > 0 && market.liquidity < 10;
                
                if (hasVeryLowVolume && hasVeryLowLiquidity) {
                  return false; // Filter out - likely an outcome token with minimal activity
                }
              }
            }
            
            // Also filter generic outcomes even if not part of an event (standalone generic outcomes)
            if (!market.eventId && isGenericOutcome(market.question || '')) {
              // If it has no volume/liquidity and is a generic outcome, likely filter it out
              const hasAnyVolume = market.volume && market.volume > 0;
              const hasAnyLiquidity = market.liquidity && market.liquidity > 0;
              
              if (!hasAnyVolume && !hasAnyLiquidity) {
                return false; // Filter out - likely an outcome token
              }
            }
            
            return true; // Keep the market
            });
          
          // Filter by category if specified (flexible matching to handle variations)
          if (params?.category) {
            const filterValueLower = params.category.toLowerCase();
            filtered = filtered.filter((m) => {
              const marketCategory = m.category?.toLowerCase();
              if (!marketCategory) return false;
              return marketCategory === filterValueLower || 
                     marketCategory.includes(filterValueLower) || 
                     filterValueLower.includes(marketCategory);
            });
          }
          
          // Enrich markets that appear to be multimarkets but lack tokens
          // Check for markets with multimarket patterns (question patterns, etc.) that don't have tokens
          const marketsToEnrich = filtered.filter((m) => {
            // Skip if already has tokens
            if (m.tokens && m.tokens.length > 2) return false;
            if (m.clobTokenIds && m.clobTokenIds.length > 2) return false;
            
            // Check if market appears to be a multimarket based on question pattern
            const question = m.question?.toLowerCase() || '';
            const multiOutcomeKeywords = ['who will win', 'who will be', 'who will have', 'top grossing', 'largest company', 'drivers champion', 'mvp', 'cy young'];
            return multiOutcomeKeywords.some(keyword => question.includes(keyword)) || 
                   question.startsWith('who will') || 
                   question.startsWith('who will be');
          });
          
          // Fetch full market details for markets that need enrichment (limit to 10 to avoid performance issues)
          if (marketsToEnrich.length > 0 && marketsToEnrich.length <= 10) {
            const enrichmentPromises = marketsToEnrich.slice(0, 10).map(async (market) => {
              try {
                // Only enrich if we have a conditionId in the right format
                if (market.conditionId && market.conditionId.startsWith('0x')) {
                  const enrichedMarket = await this.getMarket(market.id);
                  if (enrichedMarket && enrichedMarket.tokens && enrichedMarket.tokens.length > 2) {
                    // Update the market in the filtered array
                    const index = filtered.findIndex(m => m.id === market.id);
                    if (index !== -1) {
                      filtered[index] = enrichedMarket;
                    }
                  }
                }
              } catch (error) {
                // Silently fail - don't block the entire request
                console.warn(`[getMarkets] Failed to enrich market ${market.id}:`, error);
              }
            });
            
            // Wait for enrichments but don't block if they fail
            await Promise.allSettled(enrichmentPromises);
          }
          
          // Suppress verbose success logs
          return filtered;
        }
      } catch (gammaError) {
        // If Gamma API failed, try retry before falling back
        console.warn('[getMarkets] Gamma API failed, retrying...', gammaError);
        // Store the error to throw if retries also fail
        const gammaErrorStored = gammaError;
        
        // RETRY Gamma API once (it might be temporarily slow)
        let gammaRetrySuccess = false;
        try {
          console.log('[getMarkets] Retrying Gamma API...');
          if (typeof window !== 'undefined') {
            const categoryParam = params?.category ? `&category=${encodeURIComponent(params.category)}` : '';
            const tagParam = params?.category ? `&tag=${encodeURIComponent(params.category)}` : '';
            // If limit is undefined, don't pass limit parameter (API will fetch all)
            const limitParam = limit === undefined ? '' : `&limit=${limit === null ? 'all' : limit}`;
            const apiUrl = `/api/polymarket/markets?active=${activeParam}&closed=false${limitParam}${categoryParam}${tagParam}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for retry
            
            try {
              const response = await fetch(apiUrl, {
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const retryMarkets = await response.json();
                if (retryMarkets && Array.isArray(retryMarkets) && retryMarkets.length > 0) {
                  console.log('[getMarkets] ✅ Gamma API retry succeeded!');
                  gammaMarkets = retryMarkets;
                  gammaRetrySuccess = true;
                }
              }
            } catch (retryError: any) {
              clearTimeout(timeoutId);
              console.warn('[getMarkets] Gamma API retry failed:', retryError);
            }
          }
        } catch (retryError) {
          console.warn('[getMarkets] Gamma API retry failed, trying subgraph fallback...');
        }
        
        // If Gamma API retry succeeded, we'll process markets below
        // Otherwise, fall back to subgraph
        if (!gammaRetrySuccess || gammaMarkets.length === 0) {
          // Gamma API failed even after retry - use subgraph fallback
          console.warn('[getMarkets] Gamma API failed after retry, trying subgraph fallback...');
          
          // FALLBACK: Use Subgraph (The Graph) to fetch markets - returns condition IDs only
          if (SUBGRAPH_API_KEY || SUBGRAPH_URL) {
        try {
          const limit = params?.limit ?? 100;
          const offset = params?.offset ?? 0;
          
          // Try a GraphQL introspection query first to discover the schema
          // Or use a minimal query with just id to see what works
          console.log('[getMarkets] Attempting schema introspection...');
          
          // First, try to get the schema using introspection
          const introspectionQuery = `
            query IntrospectionQuery {
              __schema {
                queryType {
                  fields {
                    name
                    type {
                      name
                    }
                  }
                }
              }
            }
          `;
          
          let schemaFields: string[] = [];
          try {
            const introspectionResult = await this.fetchSubgraph<any>(
              introspectionQuery,
              {},
              'main',
              SUBGRAPH_ID_MAIN
            );
            if (introspectionResult?.__schema?.queryType?.fields) {
              schemaFields = introspectionResult.__schema.queryType.fields.map((f: any) => f.name);
              console.log('[getMarkets] Available query fields:', schemaFields);
            }
          } catch (introError) {
            console.warn('[getMarkets] Introspection failed, trying minimal query...', introError);
          }
          
          // Try minimal query - just id field to see what root types exist
          const minimalQuery = `
            query GetMarkets {
              __typename
            }
          `;
          
          // Based on official Polymarket subgraph schema from:
          // https://github.com/Polymarket/polymarket-subgraph
          // Try these queries in order, starting with fpmm-subgraph which has FixedProductMarketMaker
          const queries = [
            // Query 1: FPMM subgraph - FixedProductMarketMaker (most likely for market data)
            `query GetMarkets($limit: Int, $offset: Int) {
              fixedProductMarketMakers(first: $limit, skip: $offset, orderBy: id, orderDirection: desc) {
                id
                condition
                collateralToken
                fee
              }
            }`,
            // Query 2: Polymarket subgraph - try tokenIdConditions
            `query GetMarkets($limit: Int, $offset: Int) {
              tokenIdConditions(first: $limit, skip: $offset, orderBy: id, orderDirection: desc) {
                id
                condition
                complement
              }
            }`,
            // Query 3: Try markets root field (if it exists)
            `query GetMarkets($limit: Int, $offset: Int) {
              markets(first: $limit, skip: $offset, orderBy: id, orderDirection: desc) {
                id
              }
            }`,
            // Query 4: Try conditions (if it exists)
            `query GetMarkets($limit: Int, $offset: Int) {
              conditions(first: $limit, skip: $offset, orderBy: id, orderDirection: desc) {
                id
              }
            }`
          ];
          
          // Try both fpmm and polymarket subgraphs
          const subgraphsToTry = ['fpmm', 'polymarket', 'main'] as const;
          
          let workingQuery: string | null = null;
          let queryData: any = null;
          let workingSubgraph: string | null = null;
          
          // Try each subgraph type with each query
          for (const subgraphType of subgraphsToTry) {
            for (const query of queries) {
              try {
                console.log(`[getMarkets] Trying ${subgraphType} subgraph with query:`, query.substring(0, 100));
                const testResult = await this.fetchSubgraph<any>(query, { limit, offset }, subgraphType, SUBGRAPH_ID_MAIN);
                if (testResult && (testResult.markets || testResult.fixedProductMarketMakers || testResult.tokenIdConditions || testResult.conditions)) {
                  workingQuery = query;
                  queryData = testResult;
                  workingSubgraph = subgraphType;
                  console.log(`[getMarkets] Working query found on ${subgraphType} subgraph!`);
                  break;
                }
              } catch (queryError: any) {
                // Silently continue to next query/subgraph
                continue;
              }
            }
            if (workingQuery && queryData) break; // Found a working combination
          }
          
          if (!workingQuery || !queryData) {
            throw new Error('No working query found - subgraph schema may be incompatible');
          }
          
          // Now we know what root field works
          const rootField = queryData.markets ? 'markets' : 
                           queryData.fixedProductMarketMakers ? 'fixedProductMarketMakers' : 
                           queryData.tokenIdConditions ? 'tokenIdConditions' :
                           'conditions';
          const items = queryData[rootField] || [];
          
          console.log('[getMarkets] Found working root field:', rootField, 'on', workingSubgraph, 'subgraph');
          console.log('[getMarkets] Retrieved', items.length, 'items');

          // Use the items we got from the minimal query
          const marketsData = items;

          if (marketsData && marketsData.length > 0) {
            console.log('[getMarkets] Found', marketsData.length, 'items from subgraph');
            console.log('[getMarkets] Sample item:', JSON.stringify(marketsData[0], null, 2));
            
            // Since Gamma API failed, try to enrich a small batch from CLOB API
            // This gives us proper market names/data for at least some markets
            console.log(`[getMarkets] Gamma API failed - enriching markets from CLOB API in small batches`);
            
            const requestedLimit = params?.limit ?? 100;
            // Fetch ALL requested markets from CLOB API to get full details
            const targetMarkets = Math.min(marketsData.length, requestedLimit);
            console.log(`[getMarkets] Will fetch ${targetMarkets} markets from CLOB API`);
            const conditionIds = marketsData.slice(0, targetMarkets).map((item: any) => item.id || item.condition).filter((id: any): id is string => !!id);
            
            console.log(`[getMarkets] Attempting to enrich ALL ${conditionIds.length} markets from CLOB API...`);
            
            // Try to fetch all markets from CLOB API list endpoint first (more efficient)
            // Use API route to avoid CORS issues
            const clobMarketsMap: Map<string, any> = new Map();
            try {
              console.log(`[getMarkets] Attempting to fetch markets list from CLOB API via API route...`);
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for list
              
              // Use API route to avoid CORS
              const listResponse = await fetch(`/api/polymarket/clob/markets?active=true&limit=1000`, {
                method: 'GET',
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              
              if (listResponse.ok) {
                const clobMarkets = await listResponse.json();
                console.log(`[getMarkets] ✅ Fetched ${Array.isArray(clobMarkets) ? clobMarkets.length : 0} markets from CLOB API list`);
                
                // Create a map by condition_id for quick lookup
                if (Array.isArray(clobMarkets)) {
                  clobMarkets.forEach((market: any) => {
                    const condId = market.condition_id || market.conditionId;
                    if (condId) {
                      clobMarketsMap.set(condId.toLowerCase(), market);
                    }
                  });
                }
              } else {
                console.warn(`[getMarkets] CLOB API list returned ${listResponse.status}, will try individual fetches`);
              }
            } catch (listError: any) {
              console.warn(`[getMarkets] CLOB API list fetch failed:`, listError.message || listError);
              // Continue with individual fetches
            }
            
            // Fetch market details from CLOB API in batches with reasonable timeouts
            const BATCH_SIZE = 10; // Larger batches for efficiency
            const markets: Market[] = [];
            
            // Process ALL markets, not just first few batches
            for (let i = 0; i < conditionIds.length; i += BATCH_SIZE) {
              const batch = conditionIds.slice(i, i + BATCH_SIZE);
              const batchPromises = batch.map(async (conditionId: string) => {
                  try {
                    // First check if we already have this market from the list
                    const clobMarket = clobMarketsMap.get(conditionId.toLowerCase());
                    if (clobMarket) {
                      const rawMarket = clobMarket;
                      return {
                        id: rawMarket.condition_id || conditionId,
                        question: rawMarket.question || `Market ${conditionId.substring(0, 10)}...`,
                        slug: rawMarket.market_slug || rawMarket.slug || conditionId.substring(0, 20),
                        conditionId: rawMarket.condition_id || conditionId,
                        endDate: rawMarket.end_date_iso || rawMarket.endDate || '',
                        resolutionSource: rawMarket.resolution_source || rawMarket.primary_resolution_source || '',
                        resolutionCriteria: rawMarket.resolution_criteria || rawMarket.rules || rawMarket.description || undefined,
                        imageUrl: rawMarket.image || rawMarket.icon || undefined,
                        active: rawMarket.active !== false,
                        archived: rawMarket.archived === true,
                        category: rawMarket.tags?.[0] || undefined,
                        volume: undefined, // CLOB doesn't provide volume in same format
                        liquidity: undefined,
                        outcomePrices: rawMarket.tokens && rawMarket.tokens.length >= 2 ? {
                          YES: rawMarket.tokens.find((t: any) => t.outcome?.toLowerCase().includes('yes'))?.price ||
                               rawMarket.tokens[0]?.price || 0.5,
                          NO: rawMarket.tokens.find((t: any) => t.outcome?.toLowerCase().includes('no'))?.price ||
                              rawMarket.tokens[1]?.price || 0.5,
                        } : { YES: 0.5, NO: 0.5 },
                        tokens: rawMarket.tokens || [],
                        clobTokenIds: rawMarket.tokens?.map((t: any) => t.token_id) || [],
                      } as Market;
                    }
                    
                    // Try CLOB API individual endpoint via API route (avoids CORS)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                  
                  try {
                    // Use API route to avoid CORS issues
                    const response = await fetch(`/api/polymarket/clob/markets?conditionId=${encodeURIComponent(conditionId)}`, {
                      method: 'GET',
                      signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                      const rawMarket = await response.json();
                      
              return {
                id: rawMarket.condition_id || conditionId,
                question: rawMarket.question || `Market ${conditionId.substring(0, 10)}...`,
                slug: rawMarket.market_slug || rawMarket.slug || conditionId.substring(0, 20),
                conditionId: rawMarket.condition_id || conditionId,
                endDate: rawMarket.end_date_iso || rawMarket.endDate || '',
                resolutionSource: rawMarket.resolution_source || rawMarket.primary_resolution_source || '',
                resolutionCriteria: rawMarket.resolution_criteria || rawMarket.rules || rawMarket.description || undefined,
                imageUrl: rawMarket.image || rawMarket.icon || undefined,
                active: rawMarket.active !== false,
                archived: rawMarket.archived === true,
                category: rawMarket.tags?.[0] || undefined,
                volume: undefined, // CLOB doesn't provide volume in same format
                liquidity: undefined,
                outcomePrices: rawMarket.tokens && rawMarket.tokens.length >= 2 ? {
                  YES: rawMarket.tokens.find((t: any) => t.outcome?.toLowerCase().includes('yes'))?.price ||
                       rawMarket.tokens[0]?.price || 0.5,
                  NO: rawMarket.tokens.find((t: any) => t.outcome?.toLowerCase().includes('no'))?.price ||
                      rawMarket.tokens[1]?.price || 0.5,
                } : { YES: 0.5, NO: 0.5 },
                tokens: rawMarket.tokens || [],
                clobTokenIds: rawMarket.tokens?.map((t: any) => t.token_id) || [],
              } as Market;
                    } else {
                      console.warn(`[getMarkets] CLOB API returned ${response.status} for condition ${conditionId.substring(0, 10)}...`);
                    }
                  } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    if (fetchError.name !== 'AbortError') {
                      console.warn(`[getMarkets] CLOB API fetch error for ${conditionId.substring(0, 10)}...:`, fetchError.message || fetchError);
                    }
                  }
                  
                  // If CLOB fails, return basic market object
                  return {
                    id: conditionId,
                    question: `Market ${conditionId.substring(0, 10)}...`,
                    slug: conditionId.substring(0, 20),
                    conditionId: conditionId,
                    endDate: '',
                    resolutionSource: '',
                    resolutionCriteria: undefined,
                    active: true,
                    archived: false,
                    category: undefined,
                    volume: undefined,
                    liquidity: undefined,
                    outcomePrices: { YES: 0.5, NO: 0.5 },
                  } as Market;
                } catch (error: any) {
                  // Return basic market on any error
                  console.warn(`[getMarkets] Error processing condition ${conditionId.substring(0, 10)}...:`, error.message || error);
                  return {
                    id: conditionId,
                    question: `Market ${conditionId.substring(0, 10)}...`,
                    slug: conditionId.substring(0, 20),
                    conditionId: conditionId,
                    endDate: '',
                    resolutionSource: '',
                    resolutionCriteria: undefined,
                    active: true,
                    archived: false,
                    category: undefined,
                    volume: undefined,
                    liquidity: undefined,
                    outcomePrices: { YES: 0.5, NO: 0.5 },
                  } as Market;
                }
              });
              
              const batchResults = await Promise.all(batchPromises);
              markets.push(...batchResults);
              
              console.log(`[getMarkets] Enriched batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(conditionIds.length / BATCH_SIZE)}: ${batchResults.filter(m => m.question && m.question !== `Market ${m.conditionId?.substring(0, 10)}...`).length}/${batch.length} markets with full details`);
            }
            
            const enrichedCount = markets.filter(m => m.question && !m.question.includes('Market 0x')).length;
            console.log(`[getMarkets] ✅ Returning ${markets.length} markets (${enrichedCount} with full details from CLOB API)`);

            // Filter by active if specified
            let filtered = markets;
            if (params?.active !== undefined) {
              filtered = markets.filter((m) => Boolean(m.active) === Boolean(params.active));
            }
            if (params?.category) {
              filtered = filtered.filter((m) => m.category === params.category);
            }

            console.log('[getMarkets] Subgraph success, returning', filtered.length, 'markets with full details');
            return filtered;
          } else {
            console.warn('[getMarkets] Subgraph returned no markets data');
            console.warn('[getMarkets] Query result keys:', queryData ? Object.keys(queryData) : 'null');
            console.warn('[getMarkets] Available schema fields:', schemaFields.length > 0 ? schemaFields.join(', ') : 'none discovered');
            // Subgraph returned empty data - throw error
            throw new Error('Subgraph query succeeded but returned no market data. Check subgraph configuration.');
          }
        } catch (subgraphError) {
          console.warn('[getMarkets] Subgraph failed, trying alternatives...', subgraphError);
          // If subgraph also fails, throw the original Gamma API error
          throw gammaErrorStored instanceof Error 
            ? gammaErrorStored 
            : new Error('Both Gamma API and subgraph failed. Check network connection.');
        }
        } else {
          // No subgraph configured and Gamma API failed - throw error
          throw gammaErrorStored instanceof Error 
            ? gammaErrorStored 
            : new Error('Gamma API failed and no subgraph configured. Check network connection or configure subgraph.');
        }
        } // closes if (!gammaRetrySuccess || gammaMarkets.length === 0)
      } // closes catch (gammaError)
      
      // If we got markets (from initial or retry), process them
      if (gammaMarkets.length > 0) {
        console.log('[getMarkets] ✅ Got', gammaMarkets.length, 'markets from Gamma API (after retry if needed)');
        
        const now = new Date();
        const markets: Market[] = gammaMarkets
          .filter((m: any) => {
            if (m.closed === true || m.archived === true) return false;
            if (m.endDate) {
              try {
                const endDate = new Date(m.endDate || m.endDateIso || m.end_date_iso);
                if (endDate.getTime() < now.getTime() - 60 * 60 * 1000) return false;
              } catch (e) {}
            }
            return true;
          })
          .map((m: any) => {
            let outcomePrices: { YES: number; NO: number } | undefined;
            if (typeof m.outcomePrices === 'string') {
              try {
                const parsed = JSON.parse(m.outcomePrices);
                if (Array.isArray(parsed) && parsed.length >= 2) {
                  outcomePrices = { YES: parseFloat(parsed[0]) || 0.5, NO: parseFloat(parsed[1]) || 0.5 };
                }
              } catch (e) {
                outcomePrices = { YES: 0.5, NO: 0.5 };
              }
            } else if (m.outcomePrices && typeof m.outcomePrices === 'object') {
              outcomePrices = m.outcomePrices;
            } else {
              outcomePrices = { YES: 0.5, NO: 0.5 };
            }
            
            let category = m.category || m.tag || m.tags?.[0] || m.categorySlug || undefined;
            let eventImage: string | undefined;
            if (m.events && m.events.length > 0) {
              const event = m.events[0];
              if (!category) {
                category = event.category;
              }
              // Get event-level image (events often have logos like NYC seal)
              eventImage = event.imageUrl || event.image || event.icon || event.logo;
            }
            if (category && typeof category === 'string') {
              category = category.trim();
              if (category === '') category = undefined;
            }
            
            // Use event image if market doesn't have one
            const marketImage = m.imageUrl || m.image || m.icon;
            const finalImageUrl = marketImage || eventImage || undefined;
            
            return {
              id: m.id?.toString() || m.conditionId || m.slug,
              question: m.question || m.title || m.name || `Market ${m.id}`,
              slug: m.slug || m.id?.toString() || '',
              conditionId: m.conditionId || m.id?.toString() || '',
              endDate: m.endDate || m.endDateIso || m.end_date_iso || '',
              resolutionSource: m.resolutionSource || m.resolution_source || m.primaryResolutionSource || m.primary_resolution_source || '',
              resolutionCriteria: m.resolutionCriteria || m.resolution_criteria || m.rules || m.description || undefined,
              imageUrl: finalImageUrl,
              active: m.active !== false,
              archived: m.archived === true,
              category,
              volume: m.volumeNum || parseFloat(m.volume) || undefined,
              liquidity: m.liquidityNum || parseFloat(m.liquidity) || undefined,
              outcomePrices,
            };
          });
        
        let filtered = markets;
        if (params?.category) {
          const filterValueLower = params.category.toLowerCase();
          filtered = filtered.filter((m) => {
            const marketCategory = m.category?.toLowerCase();
            if (!marketCategory) return false;
            return marketCategory === filterValueLower || 
                   marketCategory.includes(filterValueLower) || 
                   filterValueLower.includes(marketCategory);
          });
        }
        
        console.log('[getMarkets] Gamma API success, returning', filtered.length, 'markets');
        return filtered;
      }
      
      // If we reach here, all APIs failed - throw error
      throw new Error('Failed to fetch markets from Gamma API and all fallbacks failed. Check network connection.');
    } catch (error) {
      console.error('[getMarkets] Error fetching markets:', error);
      if (error instanceof Error) {
        console.error('[getMarkets] Error details:', error.message);
        // Re-throw the error so React Query can handle it properly
        throw error;
      }
      // If it's not an Error instance, wrap it
      throw new Error(`Failed to fetch markets: ${String(error)}`);
    }
  }

  /**
   * Fetch a single market by ID from CLOB API (includes token IDs for price history)
   * This is faster and includes token_id fields needed for /prices-history endpoint
   */
  async getMarketFromCLOB(conditionId: string): Promise<Market | null> {
    try {
      // Suppress verbose debug logs

      // Add timeout to prevent hanging on connection timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout (shorter for market lookup)
      
      try {
        // CLOB API endpoint for market details
        const response = await fetch(`${CLOB_API_BASE}/markets/${conditionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[getMarketFromCLOB] CLOB API returned ${response.status}`);
          return null;
        }

        const rawMarket = await response.json();

        if (!rawMarket) return null;

        // Transform CLOB API response to Market format
        const market: Market = {
          id: rawMarket.condition_id || conditionId,
          question: rawMarket.question || '',
          slug: rawMarket.market_slug || rawMarket.slug || '',
          conditionId: rawMarket.condition_id || conditionId,
          endDate: rawMarket.end_date_iso || rawMarket.endDate || '',
          resolutionSource: rawMarket.resolution_source || rawMarket.primary_resolution_source || '',
          resolutionCriteria: rawMarket.resolution_criteria || rawMarket.rules || rawMarket.description || undefined,
          imageUrl: rawMarket.image || rawMarket.icon || undefined,
          active: rawMarket.active !== false,
          archived: rawMarket.archived === true,
          category: rawMarket.tags?.[0] || undefined,
          volume: undefined, // CLOB doesn't provide volume in same format
          liquidity: undefined,
          outcomePrices: rawMarket.tokens && rawMarket.tokens.length >= 2 ? {
            YES: rawMarket.tokens.find((t: any) => t.outcome.toLowerCase().includes('yes'))?.price ||
                 rawMarket.tokens[0]?.price || 0.5,
            NO: rawMarket.tokens.find((t: any) => t.outcome.toLowerCase().includes('no'))?.price ||
                rawMarket.tokens[1]?.price || 0.5,
          } : undefined,
          // Store token information for price history endpoint
          tokens: rawMarket.tokens || [],
          clobTokenIds: rawMarket.tokens?.map((t: any) => t.token_id) || [],
        };

        // Suppress verbose success logs
        return market;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          // Suppress repeated timeout warnings - they're expected during API issues
          this.logErrorOnce('clob-timeout', '[getMarketFromCLOB] Request timed out after 8 seconds', undefined, 'warn');
        } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('ERR_CONNECTION_TIMED_OUT')) {
          // Suppress repeated connection errors
          this.logErrorOnce('clob-connection', '[getMarketFromCLOB] Connection failed/timed out', undefined, 'warn');
        } else {
          // Only log unexpected errors
          this.logErrorOnce(`clob-error-${fetchError.message || 'unknown'}`, '[getMarketFromCLOB] Error fetching market from CLOB:', fetchError, 'error');
        }
        return null;
      }
    } catch (error: any) {
      this.logErrorOnce('clob-general', '[getMarketFromCLOB] Error fetching market from CLOB:', error, 'error');
      return null;
    }
  }

  /**
   * Fetch a single market by ID (Gamma API)
   * Uses API route proxy when in browser to avoid CORS issues
   * Now also tries to enrich with CLOB data for token IDs
   */
  async getMarket(id: string): Promise<Market | null> {
    try {
      let rawMarket: any;

      // FIRST: Try to get full market data from CLOB API if we have a conditionId format
      // This is faster and includes token IDs needed for price history
      if (id.startsWith('0x')) {
        try {
          const clobMarket = await this.getMarketFromCLOB(id);
          if (clobMarket) {
            // Suppress verbose success logs
            return clobMarket;
          }
        } catch (clobError) {
          console.warn(`[getMarket] CLOB API failed, falling back to Gamma API:`, clobError);
        }
      }

      // FALLBACK: Use Gamma API (may not have token IDs)
      // In browser, use API route to avoid CORS
      if (typeof window !== 'undefined') {
        const response = await fetch(`/api/polymarket/market/${id}`);
        if (!response.ok) {
          throw new Error(`API route error (${response.status}): ${response.statusText}`);
        }
        rawMarket = await response.json();
      } else {
        // On server, call Gamma API directly
        rawMarket = await this.fetchGamma<any>(`/markets/${id}`);
      }

      if (!rawMarket) return null;
      
      // Transform the raw Gamma API response to Market format
      // Parse outcomePrices if it's a JSON string (Gamma API returns it as a string)
      let outcomePrices: { YES: number; NO: number } | undefined;
      if (typeof rawMarket.outcomePrices === 'string') {
        try {
          const parsed = JSON.parse(rawMarket.outcomePrices);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            outcomePrices = {
              YES: parseFloat(parsed[0]) || 0.5,
              NO: parseFloat(parsed[1]) || 0.5,
            };
          }
        } catch (e) {
          // If parsing fails, use defaults
          outcomePrices = { YES: 0.5, NO: 0.5 };
        }
      } else if (rawMarket.outcomePrices && typeof rawMarket.outcomePrices === 'object') {
        outcomePrices = rawMarket.outcomePrices;
      } else {
        outcomePrices = { YES: 0.5, NO: 0.5 };
      }
      
      // Transform to Market format
      const market: Market = {
        id: rawMarket.id?.toString() || rawMarket.conditionId || rawMarket.slug,
        question: rawMarket.question || rawMarket.title || rawMarket.name || `Market ${rawMarket.id}`,
        slug: rawMarket.slug || rawMarket.id?.toString() || '',
        conditionId: rawMarket.conditionId || rawMarket.id?.toString() || '',
        endDate: rawMarket.endDate || rawMarket.endDateIso || rawMarket.end_date_iso || '',
        resolutionSource: rawMarket.resolutionSource || rawMarket.resolution_source || rawMarket.primaryResolutionSource || rawMarket.primary_resolution_source || '',
        resolutionCriteria: rawMarket.resolutionCriteria || rawMarket.resolution_criteria || rawMarket.rules || rawMarket.description || undefined,
        imageUrl: rawMarket.imageUrl || rawMarket.image || undefined,
        active: rawMarket.active !== false,
        archived: rawMarket.archived === true,
        category: rawMarket.category || undefined,
        volume: rawMarket.volumeNum || parseFloat(rawMarket.volume) || undefined,
        liquidity: rawMarket.liquidityNum || parseFloat(rawMarket.liquidity) || undefined,
        outcomePrices,
      };

      // Try to enrich with CLOB data for token IDs (needed for fast price history)
      // Only do this if we have a valid conditionId (0x format)
      if (market.conditionId && market.conditionId.startsWith('0x')) {
        try {
          const clobMarket = await this.getMarketFromCLOB(market.conditionId);
          if (clobMarket && clobMarket.tokens && clobMarket.tokens.length > 0) {
            market.tokens = clobMarket.tokens;
            market.clobTokenIds = clobMarket.clobTokenIds;
            // Suppress verbose success logs
          }
        } catch (clobError) {
          // Non-critical error - we can still use the market without CLOB tokens
          console.warn(`[getMarket] Could not enrich with CLOB tokens (non-critical):`, clobError);
        }
      }

      return market;
    } catch (error: any) {
      // Check if it's a timeout/network error (expected) or something else
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('Gateway Timeout') || errorMessage.includes('504') || errorMessage.includes('502')) {
        this.logErrorOnce('market-timeout', 'Error fetching market (timeout/network issue):', undefined, 'warn');
      } else {
        this.logErrorOnce(`market-error-${errorMessage.substring(0, 50)}`, 'Error fetching market:', error, 'error');
      }
      return null;
    }
  }

  /**
   * Get current market price/probability (Gamma API)
   */
  async getMarketPrice(marketId: string): Promise<MarketPrice | null> {
    try {
      const market = await this.getMarket(marketId);
      if (!market) return null;
      
      const yesPrice = market.outcomePrices?.YES || 0.5;
      const noPrice = market.outcomePrices?.NO || 0.5;
      
      return {
        marketId,
        outcome: 'YES',
        price: yesPrice,
        probability: yesPrice * 100,
        volume24h: market.volume || 0,
        liquidity: market.liquidity || 0,
      };
    } catch (error) {
      console.error('Error fetching market price:', error);
      return null;
    }
  }

  /**
   * Get order book from CLOB API
   * Supports both L1 (wallet signature) and L2 (API key) authentication
   * @param useL1Auth - Use L1 authentication (wallet signature) - preferred, no API key needed
   * @param walletAddress - Wallet address for L1 auth
   * @param walletClient - Wallet client for signing (e.g., from useTrading hook)
   */
  async getOrderBook(
    marketId: string, 
    outcome: 'YES' | 'NO',
    useL1Auth?: boolean,
    walletAddress?: string,
    walletClient?: any
  ): Promise<OrderBook | null> {
    try {
      // Get market to find token ID (this now enriches with CLOB data automatically)
      const market = await this.getMarket(marketId);
      if (!market) {
        throw new Error(`Could not fetch market data for ${marketId}`);
      }

      // Try to get token ID from market data
      let tokenId: string | undefined;

      // First, try to get token from tokens array
      if (market.tokens && market.tokens.length > 0) {
        const targetToken = market.tokens.find((t) => {
          const outcomeLower = t.outcome.toLowerCase();
          if (outcome === 'YES') {
            return outcomeLower.includes('yes') || outcomeLower === 'y' || t.outcome === '1';
          } else {
            return outcomeLower.includes('no') || outcomeLower === 'n' || t.outcome === '0';
          }
        });

        if (targetToken) {
          tokenId = targetToken.token_id;
        } else {
          // If no exact match, use first token for YES, second for NO
          if (outcome === 'YES' && market.tokens.length > 0) {
            tokenId = market.tokens[0].token_id;
          } else if (outcome === 'NO' && market.tokens.length > 1) {
            tokenId = market.tokens[1].token_id;
          } else if (market.tokens.length > 0) {
            tokenId = market.tokens[0].token_id;
          }
        }
      }

      // Fallback: try clobTokenIds array
      // clobTokenIds is typically [NO, YES] or [outcome1, outcome2]
      if (!tokenId && market.clobTokenIds && market.clobTokenIds.length > 0) {
        if (outcome === 'YES') {
          tokenId = market.clobTokenIds[1] || market.clobTokenIds[0];
        } else {
          tokenId = market.clobTokenIds[0] || market.clobTokenIds[1];
        }
      }

      // Last resort fallback to standard format (likely won't work but worth trying)
      if (!tokenId) {
        tokenId = `${marketId}-${outcome === 'YES' ? '1' : '0'}`;
      }

      if (!tokenId) {
        throw new Error(`No token ID found for market ${marketId}, outcome ${outcome}`);
      }

      // CLOB API endpoint for order book
      const data = await this.fetchCLOB<OrderBook>(
        `/book?token_id=${tokenId}`,
        undefined,
        useL1Auth,
        walletAddress,
        walletClient
      );
      
      return {
        ...data,
        marketId,
        outcome,
      };
    } catch (error) {
      // Only log error once per market/outcome to avoid spam
      this.logErrorOnce(`orderbook-error-${marketId}-${outcome}`, 'Error fetching order book:', error, 'error');
      if (!useL1Auth && !this.hasClobApiKey) {
        // Return mock data if no auth configured (only log once)
        this.logErrorOnce('orderbook-mock-warn', 'No CLOB authentication configured - returning mock order book data', undefined, 'warn');
        return {
          marketId,
          outcome,
          bids: [{ price: 0.48, size: 1000 }, { price: 0.47, size: 500 }],
          asks: [{ price: 0.52, size: 1000 }, { price: 0.53, size: 500 }],
        };
      }
      return null;
    }
  }

  /**
   * Get recent trades/fills (CLOB API or Activity Subgraph)
   * Priority: Activity Subgraph (no API key needed) > Data-API > CLOB API
   */
  async getTrades(marketId: string, params?: { limit?: number; startTime?: number; conditionId?: string }): Promise<Trade[]> {
    const limit = params?.limit || 1000; // Default to 1000 for historical charts
    
    try {
      // FIRST: Try Activity Subgraph (Goldsky - no API key needed, best for historical data)
      try {
        const startTime = params?.startTime;
        // Use conditionId if provided, otherwise try marketId (might be condition ID if starts with 0x)
        const conditionId = params?.conditionId || (marketId.startsWith('0x') ? marketId : null);
        const queryId = conditionId || marketId;
        
        // Determine sort direction:
        // - For ALL time (no startTime): fetch newest first (desc) to ensure we get recent data
        //   Then reverse for chronological display
        // - For specific time ranges: fetch from startTime forward (asc) for chronological progression
        const orderDirection = startTime === undefined ? 'desc' : 'asc';
        
        // Try multiple query variations to match the actual schema
        // The Activity subgraph schema might vary, so we'll try common field names
        // For ALL time (no startTime), fetch from earliest to latest
        // For specific ranges (with startTime), fetch from startTime forward
        let query: string;
        let altQuery: string;
        let altQuery2: string;
        
        if (startTime !== undefined) {
          // Specific time range - add time filter
          query = `
            query GetTrades($queryId: String!, $limit: Int!, $startTime: BigInt!) {
              trades(where: { fpmm: $queryId, timestamp_gte: $startTime }, first: $limit, orderBy: timestamp, orderDirection: asc) {
                id
                fpmm
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                transactionHash
              }
            }
          `;
          
          altQuery = `
            query GetTrades($queryId: String!, $limit: Int!, $startTime: BigInt!) {
              trades(where: { conditionId: $queryId, timestamp_gte: $startTime }, first: $limit, orderBy: timestamp, orderDirection: asc) {
                id
                conditionId
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                transactionHash
              }
            }
          `;
          
          // Try alternative with different field names
          altQuery2 = `
            query GetTrades($queryId: String!, $limit: Int!, $startTime: BigInt!) {
              fills(where: { fpmm: $queryId, timestamp_gte: $startTime }, first: $limit, orderBy: timestamp, orderDirection: asc) {
                id
                fpmm
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                txHash
              }
            }
          `;
        } else {
          // ALL time - no time filter, fetch newest first (descending) to ensure we get recent data
          // We'll reverse the results later for chronological display
          query = `
            query GetTrades($queryId: String!, $limit: Int!) {
              trades(where: { fpmm: $queryId }, first: $limit, orderBy: timestamp, orderDirection: desc) {
                id
                fpmm
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                transactionHash
              }
            }
          `;
          
          altQuery = `
            query GetTrades($queryId: String!, $limit: Int!) {
              trades(where: { conditionId: $queryId }, first: $limit, orderBy: timestamp, orderDirection: desc) {
                id
                conditionId
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                transactionHash
              }
            }
          `;
          
          // Try alternative with different entity name
          altQuery2 = `
            query GetTrades($queryId: String!, $limit: Int!) {
              fills(where: { fpmm: $queryId }, first: $limit, orderBy: timestamp, orderDirection: desc) {
                id
                fpmm
                outcomeTokenIndex
                outcomeTokenAmount
                outcomeTokenPrice
                timestamp
                creator
                txHash
              }
            }
          `;
        }
        
        const variables: any = { queryId, limit };
        if (startTime) {
          variables.startTime = startTime.toString();
        }
        
        // Try primary query first (fpmm field)
        let data: any = null;
        let queryAttempt = 1;
        
        // Try queries in order: fpmm -> conditionId -> fills
        // Only try first 2 queries to avoid long loading times
        const queriesToTry = [
          { query, entityName: 'trades', description: 'trades with fpmm' },
          { query: altQuery, entityName: 'trades', description: 'trades with conditionId' },
        ];
        
        // Add timeout to prevent long waits
        const queryTimeout = 10000; // 10 seconds max per query
        
        for (const queryConfig of queriesToTry) {
          try {
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Query timeout')), queryTimeout);
            });
            
            // Race between query and timeout
            const result = await Promise.race([
              this.fetchSubgraph<{ [key: string]: any[] }>(
                queryConfig.query,
                variables,
                'activity',
                SUBGRAPH_ID_ACTIVITY,
                true // Suppress error logging - expected failures
              ),
              timeoutPromise
            ]) as { [key: string]: any[] };
            
            // Check if we got data (could be 'trades' or 'fills' entity)
            const tradesData = result[queryConfig.entityName] || result.trades || result.fills;
            
            if (tradesData && tradesData.length > 0) {
              // Suppress verbose success logs
              data = { trades: tradesData };
              break;
            }
          } catch (queryError: any) {
            // Silently skip - these are expected failures when schema doesn't match
            // Continue to next query or fallback
          }
          queryAttempt++;
        }
        
        // Skip fallback if we already have data or limit is too high (to prevent long waits)
        // Only use fallback for smaller limits
        if ((!data || !data.trades || data.trades.length === 0) && limit <= 1000) {
          // Suppress verbose debug logs
          try {
            // Fetch recent trades without filter (limited by smaller limit to avoid timeout)
            const allTradesQuery = `
              query GetRecentTrades($limit: Int!) {
                trades(first: $limit, orderBy: timestamp, orderDirection: desc) {
                  id
                  fpmm
                  conditionId
                  outcomeTokenIndex
                  outcomeTokenAmount
                  outcomeTokenPrice
                  timestamp
                  creator
                  transactionHash
                }
              }
            `;
            
            // Add timeout for fallback query too
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Fallback query timeout')), 5000); // 5 seconds for fallback
            });
            
            const allData = await Promise.race([
              this.fetchSubgraph<{ trades: any[] }>(
                allTradesQuery,
                { limit: Math.min(limit, 500) }, // Smaller limit for fallback
                'activity',
                SUBGRAPH_ID_ACTIVITY,
                true // Suppress errors - expected failures
              ),
              timeoutPromise
            ]) as { trades: any[] };
            
            if (allData.trades && allData.trades.length > 0) {
              // Filter by conditionId or marketId client-side
              const filtered = allData.trades.filter((trade: any) => {
                return (
                  (conditionId && (trade.fpmm === conditionId || trade.conditionId === conditionId)) ||
                  (!conditionId && (trade.fpmm === marketId || trade.conditionId === marketId))
                );
              });
              
              if (filtered.length > 0) {
                // Suppress verbose success logs
                // Sort ascending for historical display
                filtered.sort((a: any, b: any) => parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0'));
                data = { trades: filtered };
              }
            }
          } catch (fallbackError) {
            // Silently skip - expected failure when schema doesn't match
          }
        }
        
        if (data && data.trades && data.trades.length > 0) {
          // Transform subgraph trades to Trade format
          const trades: Trade[] = data.trades.map((trade: any) => {
            // Try to get market ID from fpmm or conditionId
            const tradeMarketId = trade.fpmm || trade.conditionId || marketId;
            
            // outcomeTokenIndex: 0 = YES, 1 = NO
            // outcomeTokenPrice is in the format: price in native token units (usually scaled)
            // For FPMM, price is typically the marginal price at time of trade
            // The price might be in wei (1e18) format, so we need to normalize
            let price = parseFloat(trade.outcomeTokenPrice || '0');
            
            // If price > 1, it might be scaled - normalize to 0-1 range
            // Prices from subgraph are often in wei (1e18), so divide by 1e18
            if (price > 1 && price < 1e19) {
              price = price / 1e18;
            }
            // If price is already in 0-1 range, keep it
            const normalizedPrice = Math.max(0, Math.min(1, price));
            
            // Parse timestamp (might be in seconds or milliseconds)
            let timestamp = parseInt(trade.timestamp || '0');
            // If timestamp is in seconds (less than year 2000 in ms), convert to milliseconds
            if (timestamp < 946684800000) { // Year 2000 in milliseconds
              timestamp = timestamp * 1000;
            }
            
            return {
              id: trade.id || trade.transactionHash || `${tradeMarketId}-${timestamp}`,
              marketId: tradeMarketId,
              outcome: ((trade.outcomeTokenIndex === '0' || trade.outcomeTokenIndex === 0) ? 'YES' : 'NO') as 'YES' | 'NO',
              amount: trade.outcomeTokenAmount || '0',
              price: normalizedPrice,
              timestamp: timestamp,
              user: trade.creator || trade.user || '',
              transactionHash: trade.transactionHash || trade.txHash || '',
            };
          });
          
          // For ALL time (no startTime), we fetched newest first (descending)
          // Reverse to chronological order (oldest to newest) for chart display
          if (startTime === undefined) {
            trades.sort((a, b) => a.timestamp - b.timestamp);
            // Suppress verbose success logs
          } else {
            // For specific time ranges, already in chronological order (ascending)
            // Suppress verbose success logs
          }
          
          return trades;
        }
      } catch (subgraphError) {
        // Silently skip - Activity subgraph doesn't support trades query
        // Fall through to try other sources (Data-API)
      }
      
      // SECOND: Try Data-API (public endpoint, no API key needed)
      try {
        const dataApiResponse = await this.fetchData<any>(`/trades?market_id=${marketId}&limit=${limit}`, {}, false);
        
        // Data-API might return trades in different formats
        let dataApiTrades: any[] = [];
        if (Array.isArray(dataApiResponse)) {
          dataApiTrades = dataApiResponse;
        } else if (dataApiResponse?.trades) {
          dataApiTrades = dataApiResponse.trades;
        } else if (dataApiResponse?.data) {
          dataApiTrades = dataApiResponse.data;
        }
        
        if (dataApiTrades && dataApiTrades.length > 0) {
          // Transform Data-API trades to our Trade format
          const trades: Trade[] = dataApiTrades
            .map((trade: any) => {
              // Parse timestamp - might be in seconds, milliseconds, or ISO string
              let timestamp = 0;
              if (trade.timestamp) {
                if (typeof trade.timestamp === 'string') {
                  // ISO string or Unix timestamp string
                  if (trade.timestamp.includes('T') || trade.timestamp.includes('-')) {
                    timestamp = new Date(trade.timestamp).getTime();
                  } else {
                    timestamp = parseInt(trade.timestamp) * (trade.timestamp.length === 10 ? 1000 : 1); // seconds -> ms if 10 digits
                  }
                } else if (typeof trade.timestamp === 'number') {
                  timestamp = trade.timestamp < 946684800000 ? trade.timestamp * 1000 : trade.timestamp; // seconds -> ms if < year 2000
                }
              } else if (trade.created_at || trade.createdAt) {
                const dateStr = trade.created_at || trade.createdAt;
                timestamp = new Date(dateStr).getTime();
              }
              
              // Parse outcome - might be 'YES'/'NO', 'yes'/'no', 0/1, or outcomeTokenIndex
              let outcome: 'YES' | 'NO' = 'YES';
              if (trade.outcome) {
                const outcomeStr = String(trade.outcome).toUpperCase();
                outcome = (outcomeStr === 'YES' || outcomeStr === '1' || trade.outcomeTokenIndex === '0' || trade.outcomeTokenIndex === 0) ? 'YES' : 'NO';
              } else if (trade.outcomeTokenIndex !== undefined) {
                outcome = (trade.outcomeTokenIndex === '0' || trade.outcomeTokenIndex === 0) ? 'YES' : 'NO';
              } else if (trade.token_id) {
                // Token ID format: marketId-0 (NO) or marketId-1 (YES)
                outcome = trade.token_id.endsWith('-1') || trade.token_id.endsWith('_1') ? 'YES' : 'NO';
              }
              
              // Parse price - normalize to 0-1 range
              let price = parseFloat(trade.price || trade.outcomeTokenPrice || '0.5');
              if (price > 1 && price < 1e19) {
                price = price / 1e18; // Wei scaling
              }
              price = Math.max(0, Math.min(1, price));
              
              return {
                id: trade.id || trade.txHash || trade.transaction_hash || `${marketId}-${timestamp}`,
                marketId: trade.market_id || trade.marketId || marketId,
                outcome,
                amount: trade.amount || trade.size || trade.outcomeTokenAmount || '0',
                price,
                timestamp: timestamp || Date.now(),
                user: trade.user || trade.creator || trade.maker || trade.taker || '',
                transactionHash: trade.transactionHash || trade.txHash || trade.transaction_hash || '',
              };
            })
            .filter((trade: Trade) => trade.timestamp > 0 && (trade.outcome === 'YES' || trade.outcome === 'NO')) // Only valid trades
            .sort((a, b) => a.timestamp - b.timestamp); // Sort chronologically
          
          if (trades.length > 0) {
            // Suppress verbose success logs
            return trades;
          }
        }
      } catch (dataApiError) {
        console.warn('[getTrades] Data-API failed, trying CLOB API:', dataApiError);
      }
      
      // THIRD: Try CLOB API if we have API key
      if (this.hasClobApiKey) {
        const tokenId = `${marketId}-1`; // YES outcome
        const fills = await this.fetchCLOB<any[]>(`/fills?token_id=${tokenId}&limit=${limit}`);
        
        const trades: Trade[] = fills.map((fill) => ({
          id: fill.id || fill.txHash,
          marketId,
          outcome: (fill.side === 'buy' ? 'YES' : 'NO') as 'YES' | 'NO',
          amount: fill.amount || '0',
          price: fill.price || 0,
          timestamp: fill.timestamp || Date.now(),
          user: fill.user || '',
          transactionHash: fill.txHash || '',
        }));
        
        console.log(`[getTrades] ✅ Fetched ${trades.length} fills from CLOB API for market ${marketId}`);
        return trades;
      }
      
      console.warn(`[getTrades] ⚠️ No trades found for market ${marketId} from any source`);
      return [];
    } catch (error) {
      console.error('[getTrades] Error fetching trades:', error);
      return [];
    }
  }

  /**
   * Get user positions (Data-API, requires CLOB API key)
   */
  async getPositions(userAddress: string): Promise<Position[]> {
    try {
      return await this.fetchData<Position[]>(`/positions?user=${userAddress}`, {}, true);
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }

  /**
   * Place limit order via CLOB API (OPTIONAL - for centralized order book)
   * NOTE: For basic trading, use Web3 smart contracts directly (no API key needed!)
   * This CLOB method is only for Polymarket's centralized order book (optional feature)
   * 
   * Use `useTrading()` hook from `@/lib/web3/trading` for direct contract trading instead
   * 
   * Supports L1 authentication (wallet signature) - no API key needed!
   * See: https://docs.polymarket.com/developers/CLOB/authentication
   * 
   * @param useL1Auth - Use L1 authentication (wallet signature) - preferred, no API key needed
   * @param walletAddress - Wallet address for L1 auth
   * @param walletClient - Wallet client for signing (e.g., from useTrading hook)
   */
  async placeLimitOrder(
    order: {
      marketId: string;
      outcome: 'YES' | 'NO';
      side: 'buy' | 'sell';
      amount: string;
      price: number;
    },
    useL1Auth?: boolean,
    walletAddress?: string,
    walletClient?: any
  ): Promise<{ orderId: string; status: string }> {
    if (!useL1Auth && !this.hasClobApiKey) {
      throw new Error(
        'CLOB API authentication required. ' +
        'Use L1 authentication (wallet signature) or configure API key. ' +
        'Alternatively, use Web3 trading for direct contract trades (no API needed).'
      );
    }

    try {
      const tokenId = `${order.marketId}-${order.outcome === 'YES' ? '1' : '0'}`;
      const response = await this.fetchCLOB<{ order_id: string; status: string }>(
        '/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            token_id: tokenId,
            side: order.side,
            size: order.amount,
            price: order.price,
          }),
        },
        useL1Auth,
        walletAddress,
        walletClient
      );

      return {
        orderId: response.order_id,
        status: response.status,
      };
    } catch (error) {
      console.error('Error placing CLOB order:', error);
      throw error;
    }
  }

  /**
   * Get historical price data from CLOB API prices-history endpoint
   * This is the preferred method - much faster than fetching trades!
   * Uses: GET /prices-history?market=TOKEN_ID&startTs=START&endTs=END&interval=1h
   */
  /**
   * Get historical prices using interval parameter (Polymarket API format)
   * @param marketId - Market ID (or tokenId if tokenIdOnly is true)
   * @param interval - Time interval: '1h', '6h', '1d', '1w', '1m', or 'max'
   * @param fidelity - Optional resolution in minutes
   * @param tokenIdOnly - If true, marketId is treated as a tokenId directly
   */
  async getHistoricalPrices(marketId: string, interval: string, fidelity?: number, tokenIdOnly: boolean = false): Promise<Array<{ timestamp: number; price: number }>> {
    // FIRST: Try CLOB API prices-history endpoint (no auth needed for read operations!)
    // This is the most efficient way to get price history
    try {
      let tokenId: string | undefined;
      
      // If tokenIdOnly is true, use marketId directly as tokenId
      if (tokenIdOnly) {
        tokenId = marketId;
        console.log(`[getHistoricalPrices] Using marketId directly as tokenId: ${tokenId.substring(0, 20)}...`);
      } else {
        // Get market to find token ID (this now enriches with CLOB data automatically)
        const market = await this.getMarket(marketId);
        if (!market) {
          console.warn('[getHistoricalPrices] Could not fetch market data');
        } else {
          // Try to get token ID from market data
          // The tokens array has: [{ token_id, outcome, price }, ...]
          // We want the YES token for price history

        // First, try to get YES token from tokens array
        if (market.tokens && market.tokens.length > 0) {
          const yesToken = market.tokens.find((t) =>
            t.outcome.toLowerCase().includes('yes') ||
            t.outcome.toLowerCase() === 'y' ||
            t.outcome === '1'
          );

          if (yesToken) {
            tokenId = yesToken.token_id;
            console.log(`[getHistoricalPrices] Found YES token ID from CLOB: ${tokenId.substring(0, 20)}...`);
          } else {
            // If no explicit YES, use first token
            tokenId = market.tokens[0].token_id;
            console.log(`[getHistoricalPrices] Using first token ID: ${tokenId.substring(0, 20)}...`);
          }
        }

        // Fallback: try clobTokenIds array
        if (!tokenId && market.clobTokenIds && market.clobTokenIds.length > 0) {
          tokenId = market.clobTokenIds[1] || market.clobTokenIds[0];
          console.log(`[getHistoricalPrices] Using token ID from clobTokenIds: ${tokenId.substring(0, 20)}...`);
        }

          // Last resort fallback to standard format (likely won't work but worth trying)
          if (!tokenId) {
            console.warn('[getHistoricalPrices] No CLOB token IDs found, trying fallback format (may not work)');
            tokenId = `${marketId}-1`; // YES token
          }
        }
        
        if (!tokenId) {
          console.warn('[getHistoricalPrices] No token ID available');
          return [];
        }
        
        // Suppress verbose debug logs
        try {
          // CLOB API prices-history endpoint (public, no auth needed for reads)
          // Use interval parameter instead of startTs/endTs (Polymarket API requirement)
          let url = `${CLOB_API_BASE}/prices-history?market=${tokenId}&interval=${interval}`;
          if (fidelity !== undefined) {
            url += `&fidelity=${fidelity}`;
          }
          // Suppress verbose debug logs
          
          // Add timeout to prevent hanging on connection timeouts
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json() as { history?: Array<{ t: number; p: number }> };

              if (data.history && data.history.length > 0) {
                const sortedHistory = [...data.history].sort((a, b) => a.t - b.t); // Sort by timestamp
                
                const firstDate = new Date(sortedHistory[0].t * 1000);
                const lastDate = new Date(sortedHistory[sortedHistory.length - 1].t * 1000);
                const actualTimeSpan = lastDate.getTime() - firstDate.getTime();
                
                // Suppress verbose success logs
                
                // Convert to our format: { timestamp, price }
                // t is timestamp in seconds, p is price
                const converted = sortedHistory.map((point) => ({
                  timestamp: point.t * 1000, // Convert to milliseconds
                  price: point.p, // Price is already in 0-1 format
                }));
                
                // Suppress verbose success logs
                return converted;
              } else {
                console.warn(`[getHistoricalPrices] CLOB API returned empty history array - will fallback to trades`);
              }
            } else {
              const errorText = await response.text().catch(() => '');
              console.warn(`[getHistoricalPrices] CLOB API returned ${response.status}: ${errorText.substring(0, 200)}`);
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
              console.warn('[getHistoricalPrices] CLOB API request timed out after 10 seconds - will fallback to trades');
            } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('ERR_CONNECTION_TIMED_OUT')) {
              console.warn('[getHistoricalPrices] CLOB API connection failed/timed out - will fallback to trades');
            } else {
              console.error('[getHistoricalPrices] CLOB API prices-history failed:', fetchError);
            }
          }
        } catch (clobError) {
          console.error('[getHistoricalPrices] CLOB API prices-history failed:', clobError);
        }
      }
    } catch (error) {
      console.warn('[getHistoricalPrices] Error fetching market for CLOB API, trying subgraph:', error);
    }
    
    // If CLOB API fails, return empty array (will fallback to trades in useHistoricalPrices hook)
    console.warn('[getHistoricalPrices] CLOB API failed, returning empty array (will fallback to trades)');
    return [];
  }

  /**
   * Get activity/trade data from Activity Polygon subgraph
   * Note: This is now redundant with getTrades() but kept for backward compatibility
   */
  async getActivityData(marketId: string, limit: number = 100): Promise<any[]> {
    try {
      const trades = await this.getTrades(marketId, { limit });
      return trades;
    } catch (error) {
      console.error('Error fetching activity data:', error);
      return [];
    }
  }

  /**
   * Get P&L data from Profit and Loss subgraph
   */
  async getPnLData(userAddress: string): Promise<any[]> {
    if (!SUBGRAPH_URL && !SUBGRAPH_API_KEY) {
      return [];
    }

    try {
      const query = `
        query GetPnL($userAddress: String!) {
          positions(where: { user: $userAddress }) {
            id
            marketId
            outcome
            amount
            costBasis
            currentValue
            realizedPnL
            unrealizedPnL
          }
        }
      `;

      const data = await this.fetchSubgraph<{ positions: any[] }>(
        query,
        { userAddress },
        'pnl',
        SUBGRAPH_ID_PNL
      );

      return data.positions || [];
    } catch (error) {
      console.error('Error fetching P&L data:', error);
      return [];
    }
  }

  /**
   * Get orderbook data from Orderbook subgraph
   */
  async getOrderbookFromSubgraph(marketId: string, outcome: 'YES' | 'NO'): Promise<any> {
    if (!SUBGRAPH_URL && !SUBGRAPH_API_KEY) {
      return null;
    }

    try {
      const query = `
        query GetOrderbook($marketId: String!, $outcome: String!) {
          orderBook(marketId: $marketId, outcome: $outcome) {
            bids {
              price
              size
            }
            asks {
              price
              size
            }
          }
        }
      `;

      const data = await this.fetchSubgraph<{ orderBook: any }>(
        query,
        { marketId, outcome },
        'orderbook',
        SUBGRAPH_ID_ORDERBOOK
      );

      return data.orderBook || null;
    } catch (error) {
      console.error('Error fetching orderbook data from subgraph:', error);
      return null;
    }
  }

  /**
   * Fetch comments from Polymarket Gamma API
   * @param marketId - Market ID (string, will be converted to integer for API)
   * @param params - Optional query parameters
   * @see https://docs.polymarket.com/api-reference/comments/list-comments
   */
  async getComments(
    marketId: string,
    params?: {
      limit?: number;
      offset?: number;
      order?: string;
      ascending?: boolean;
      getPositions?: boolean;
      holdersOnly?: boolean;
    }
  ): Promise<any[]> {
    try {
      // Convert marketId to integer (Polymarket API expects integer parent_entity_id)
      const marketIdInt = parseInt(marketId, 10);
      if (isNaN(marketIdInt)) {
        console.warn(`[getComments] Invalid market ID format: ${marketId}`);
        return [];
      }

      // Try different entity type formats based on Polymarket API documentation
      // The docs show: Event, Series, market (lowercase)
      const entityTypes = ['market', 'Market', 'Series']; // Try lowercase first, then others
      
      for (const entityType of entityTypes) {
        try {
          const queryParams = new URLSearchParams({
            parent_entity_type: entityType,
            parent_entity_id: marketIdInt.toString(),
            ...(params?.limit !== undefined && { limit: params.limit.toString() }),
            ...(params?.offset !== undefined && { offset: params.offset.toString() }),
            ...(params?.order && { order: params.order }),
            ...(params?.ascending !== undefined && { ascending: params.ascending.toString() }),
            ...(params?.getPositions !== undefined && { get_positions: params.getPositions.toString() }),
            ...(params?.holdersOnly !== undefined && { holders_only: params.holdersOnly.toString() }),
          });

          const url = `/comments?${queryParams.toString()}`;
          const response = await fetch(`${GAMMA_API_BASE}${url}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData: any;
            try {
              errorData = errorText ? JSON.parse(errorText) : { error: response.statusText };
            } catch {
              errorData = { error: errorText || response.statusText };
            }
            
            // If it's an "invalid entity type" error, try next type
            if (errorData.error && (
              errorData.error.includes('invalid entity type') || 
              errorData.error.includes('entity type')
            )) {
              console.log(`[getComments] Entity type "${entityType}" not valid, trying next...`);
              continue;
            }
            
            // If it's a different error, log it but continue to try other types
            console.warn(`[getComments] API error with ${entityType}:`, errorData.error);
            continue;
          }

          const comments = await response.json();
          
          // If we get a valid response (array), return it
          if (Array.isArray(comments)) {
            return comments;
          }
          
          // If we get an error object, check if it's an "invalid entity type" error
          if (comments && typeof comments === 'object' && 'error' in comments) {
            const errorMsg = (comments as any).error || '';
            if (errorMsg.includes('invalid entity type') || errorMsg.includes('entity type')) {
              // Try next entity type
              continue;
            }
            // If it's a different error, throw it
            throw new Error(errorMsg);
          }
        } catch (error: any) {
          // If it's an "invalid entity type" error, try next type
          if (error.message?.includes('invalid entity type') || 
              error.message?.includes('entity type')) {
            continue;
          }
          // Otherwise, re-throw
          throw error;
        }
      }
      
      // If all entity types failed, return empty array
      console.warn(`[getComments] All entity types failed for market ID: ${marketIdInt}`);
      return [];
    } catch (error) {
      console.error('[getComments] Error fetching comments:', error);
      // Return empty array instead of throwing to prevent UI breaking
      return [];
    }
  }
}

// Singleton instance
export const polymarketClient = new PolymarketClient();

export default polymarketClient;
