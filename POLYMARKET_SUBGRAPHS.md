# Polymarket Subgraphs Guide

Polymarket has multiple subgraphs available on The Graph, each serving different purposes. This guide explains which ones to use for what.

## Available Subgraphs

Based on [The Graph Explorer](https://thegraph.com/explorer), here are the available Polymarket subgraphs:

### 1. **Main Polymarket** (Primary - Recommended)
- **Subgraph ID**: `81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC`
- **URL**: https://thegraph.com/explorer/subgraphs/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC
- **Network**: Polygon (matic)
- **Version**: v1.0.0
- **Signal**: 9.8K
- **Use for**: General market data, price history, market metadata
- **Default**: ✅ Yes - this is the default for price data

### 2. **Activity Polygon** (Trades & Activity)
- **Subgraph ID**: `Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`
- **URL**: https://thegraph.com/explorer/subgraphs/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp
- **Network**: Polygon (matic)
- **Version**: v0.0.1
- **Signal**: 397.8
- **Use for**: Trade history, activity data, transaction data
- **Default**: ✅ Yes - this is the default for activity data

### 3. **Open Interest**
- **Subgraph ID**: `ELaW6RtkbmYNmMMU6hEPsghG9Ko3EXSmiRkH855M4qfF`
- **URL**: https://thegraph.com/explorer/subgraphs/ELaW6RtkbmYNmMMU6hEPsghG9Ko3EXSmiRkH855M4qfF
- **Network**: Polygon (matic)
- **Version**: v1.0.0
- **Signal**: 395.0
- **Use for**: Open interest data, market exposure
- **Default**: ⚠️ No - must be configured separately

### 4. **Profit and Loss** (P&L)
- **Subgraph ID**: `6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz`
- **URL**: https://thegraph.com/explorer/subgraphs/6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz
- **Network**: Polygon (matic)
- **Version**: v1.0.1
- **Signal**: 307.4
- **Use for**: User P&L data, position tracking, profit/loss calculations
- **Default**: ✅ Yes - this is the default for P&L data

### 5. **Orderbook**
- **Subgraph ID**: `7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrQxphhoEypyY`
- **URL**: https://thegraph.com/explorer/subgraphs/7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrQxphhoEypyY
- **Network**: Polygon (matic)
- **Version**: v0.0.21
- **Signal**: 490.4
- **Updated**: 3 months ago
- **Use for**: Historical order book data, order book snapshots
- **Default**: ✅ Yes - this is the default for orderbook data

### 6. **Polymarket Names** (ENS)
- **Subgraph ID**: `22CoTbEtpv6fURB6moTNfJPWNUPXtiFGRA8h1zajMha3`
- **URL**: https://thegraph.com/explorer/subgraphs/22CoTbEtpv6fURB6moTNfJPWNUPXtiFGRA8h1zajMha3
- **Network**: Polygon (matic)
- **Version**: v0.3.1
- **Signal**: 191.8
- **Use for**: ENS name resolution, wallet address to name mapping
- **Default**: ⚠️ No - must be configured separately

## Configuration

### Basic Setup (Recommended)

Add to `apps/web/.env.local`:

```bash
# Subgraph API Key (required for all subgraphs)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_API_KEY=088766533a5122db541ca7cdb16e8133
```

That's it! The defaults are already set for:
- **Main Polymarket** (price history)
- **Activity Polygon** (trades/activity)
- **Profit and Loss** (P&L data)
- **Orderbook** (order book data)

### Custom Subgraph IDs (Optional)

If you want to use different subgraphs or override defaults:

```bash
# Main Polymarket (for price history)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_MAIN=81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC

# Activity Polygon (for trades/activity)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_ACTIVITY=Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp

# Profit and Loss (for P&L data)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_PNL=6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz

# Orderbook (for order book data)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_ID_ORDERBOOK=7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrQxphhoEypyY
```

## Usage in Code

The API client automatically uses the correct subgraph for each feature:

```typescript
import { polymarketClient } from '@/lib/api/polymarket';

// Historical prices (uses Main Polymarket subgraph)
const prices = await polymarketClient.getHistoricalPrices(marketId, startTime, endTime);

// Activity data (uses Activity Polygon subgraph)
const activity = await polymarketClient.getActivityData(marketId, 100);

// P&L data (uses Profit and Loss subgraph)
const pnl = await polymarketClient.getPnLData(userAddress);

// Orderbook from subgraph (uses Orderbook subgraph)
const orderbook = await polymarketClient.getOrderbookFromSubgraph(marketId, 'YES');
```

## Feature Mapping

### Chart Card
- **Uses**: Main Polymarket subgraph (`81Dm16...`)
- **Data**: Historical price data
- **Method**: `getHistoricalPrices()`

### Tape Card / Activity Scanner
- **Uses**: Activity Polygon subgraph (`Bx1W4S...`)
- **Data**: Trade history, activity data
- **Method**: `getActivityData()`

### Exposure Tree / P&L
- **Uses**: Profit and Loss subgraph (`6c58N5...`)
- **Data**: User positions, P&L calculations
- **Method**: `getPnLData()`

### Depth Card (Historical)
- **Uses**: Orderbook subgraph (`7fu2DW...`)
- **Data**: Historical order book snapshots
- **Method**: `getOrderbookFromSubgraph()`

### CLOB API (Primary for Order Book)
- **Note**: For real-time order book, use CLOB API instead of subgraph
- **Method**: `getOrderBook()` (uses CLOB API)
- **Subgraph**: Used only for historical order book data

## Current Configuration

Your current setup:
- ✅ **Subgraph API Key**: `088766533a5122db541ca7cdb16e8133`
- ✅ **Default Subgraph IDs**: All defaults are set
- ✅ **Main Polymarket**: `81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC`
- ✅ **Activity**: `Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`
- ✅ **P&L**: `6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz`
- ✅ **Orderbook**: `7fu2DWYK93ePfzB24c2wrP94S3x4LGHUrQxphhoEypyY`

## Gateway URL Format

The Graph Gateway uses this format:
```
https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID}
```

Example with your API key:
```
https://gateway.thegraph.com/api/088766533a5122db541ca7cdb16e8133/subgraphs/id/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC
```

## Next Steps

1. ✅ API key is already configured
2. ✅ Default subgraph IDs are set
3. Restart your dev server:
   ```bash
   cd apps/web
   npm run dev
   ```
4. Test the Chart card - it should now load historical data!

## References

- [The Graph Explorer](https://thegraph.com/explorer)
- [Polymarket Subgraphs](https://thegraph.com/explorer?query=Polymarket)
- [The Graph Gateway Documentation](https://thegraph.com/docs/en/querying/managing-api-keys/)

