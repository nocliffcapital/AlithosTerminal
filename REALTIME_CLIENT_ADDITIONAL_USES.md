# Additional Uses for Real-Time Data Client

We've extended the Real-Time Data Client implementation to support many more real-time data streams. Here's what's available:

## ✅ Implemented Features

### 1. **Real-Time Orderbook Updates** (`useRealtimeOrderbook`)
- **What**: Instant orderbook updates without polling
- **Topic**: `clob_market` / `agg_orderbook`
- **Auth Required**: ❌ No
- **Use Case**: Replace 3-second polling in OrderBookCard with instant updates
- **Benefits**: 
  - Eliminates polling overhead
  - Instant price updates
  - Better user experience

### 2. **Real-Time Trade Updates** (`useRealtimeTrades`)
- **What**: Live trade feed for markets
- **Topics**: `activity` / `trades` and `activity` / `orders_matched`
- **Auth Required**: ❌ No
- **Use Case**: Replace polling in MarketTradeCard, TapeCard, ActivityScannerCard
- **Benefits**:
  - See trades as they happen
  - No delay in trade feed
  - Better market activity visibility

### 3. **Real-Time Price Updates** (`useRealtimePrice`)
- **What**: Instant price change notifications
- **Topics**: `clob_market` / `price_change` and `clob_market` / `last_trade_price`
- **Auth Required**: ❌ No
- **Use Case**: Update market prices instantly in MarketInfoCard, charts, etc.
- **Benefits**:
  - Real-time price updates
  - Best bid/ask updates
  - Last trade price updates

### 4. **Real-Time Order Status** (`useRealtimeOrderStatus`)
- **What**: Live order status updates (placement, fill, cancellation)
- **Topic**: `clob_user` / `order`
- **Auth Required**: ✅ Yes (CLOB API key)
- **Use Case**: Update OrderHistoryCard with live order status
- **Status**: Framework ready, needs CLOB API key configuration
- **Benefits**:
  - Instant order fill notifications
  - Real-time order status changes
  - Better order tracking

## 📋 Available Topics (Not Yet Implemented)

### Activity Streams (No Auth Required)
- ✅ `activity` / `trades` - Market trades (implemented)
- ✅ `activity` / `orders_matched` - Matched orders (implemented)
- ❌ `activity` / `*` - All activity (could be useful for activity feed)

### CLOB Market Data (No Auth Required)
- ✅ `clob_market` / `agg_orderbook` - Aggregated orderbook (implemented)
- ✅ `clob_market` / `price_change` - Price changes (implemented)
- ✅ `clob_market` / `last_trade_price` - Last trade price (implemented)
- ❌ `clob_market` / `tick_size_change` - Tick size changes
- ❌ `clob_market` / `market_created` - New market creation
- ❌ `clob_market` / `market_resolved` - Market resolution

### CLOB User Data (Requires CLOB Auth)
- ✅ `clob_user` / `order` - User order updates (framework ready)
- ✅ `clob_user` / `trade` - User trade updates (framework ready)

### Comments (No Auth Required)
- ✅ `comments` / `comment_created` - New comments (implemented)
- ❌ `comments` / `comment_removed` - Comment deletions
- ❌ `comments` / `reaction_created` - Comment reactions
- ❌ `comments` / `reaction_removed` - Reaction removals

### Crypto Prices (No Auth Required)
- ❌ `crypto_prices` / `update` - Crypto price updates (BTC, ETH, etc.)
- **Use Case**: Display crypto prices in UI

### RFQ (Request for Quote) (No Auth Required)
- ❌ `rfq` / `request_created` - New RFQ requests
- ❌ `rfq` / `quote_created` - New quotes
- **Use Case**: RFQ trading features

## 🚀 How to Use

### Example: Add Real-Time Orderbook to OrderBookCard

```typescript
import { useRealtimeOrderbook } from '@/lib/hooks/useRealtimeOrderbook';

function OrderBookCardComponent({ marketId, outcome }) {
  // Add real-time orderbook subscription
  useRealtimeOrderbook(marketId, outcome);
  
  // Existing orderbook query will now update in real-time
  const { data: orderBook } = useOrderBook(marketId, outcome);
  
  // ... rest of component
}
```

### Example: Add Real-Time Trades to MarketTradeCard

```typescript
import { useRealtimeTrades } from '@/lib/hooks/useRealtimeTrades';

function MarketTradeCardComponent({ marketId }) {
  // Add real-time trade subscription
  useRealtimeTrades(marketId);
  
  // Existing trades query will now update in real-time
  const { data: trades } = useTrades(marketId);
  
  // ... rest of component
}
```

### Example: Add Real-Time Price Updates

```typescript
import { useRealtimePrice } from '@/lib/hooks/useRealtimePrice';

function MarketInfoCard({ marketId, outcome }) {
  // Add real-time price subscription
  useRealtimePrice(marketId, outcome);
  
  // Price will update automatically
  const { data: price } = useMarketPrice(marketId);
  
  // ... rest of component
}
```

## 🎯 Recommended Next Steps

1. **Integrate into OrderBookCard** - Replace polling with real-time updates
2. **Integrate into MarketTradeCard** - Show trades as they happen
3. **Integrate into TapeCard** - Live trade tape
4. **Add price updates to charts** - Real-time chart updates
5. **Configure CLOB auth for order status** - Enable user order tracking

## 📊 Performance Benefits

- **Reduced API calls**: No more polling every 2-3 seconds
- **Lower latency**: Instant updates vs. polling delay
- **Better UX**: Users see changes immediately
- **Reduced server load**: WebSocket is more efficient than HTTP polling

## 🔧 Configuration

All real-time subscriptions work automatically once the `useRealtimeConnection()` hook is called (already done in `app/page.tsx`).

For CLOB user data (order status), you'll need to configure CLOB API credentials:
- `NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY`
- `POLYMARKET_CLOB_API_SECRET` (server-side)
- `POLYMARKET_CLOB_API_PASSPHRASE` (server-side)

## 📝 Notes

- All market data subscriptions (orderbook, prices, trades) work **without authentication**
- User-specific data (orders, user trades) requires CLOB API authentication
- The real-time client handles reconnection automatically
- Subscriptions are cleaned up automatically when components unmount
- Multiple components can subscribe to the same data stream efficiently



