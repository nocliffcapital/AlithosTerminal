# Polymarket API Setup Guide

This guide explains how to configure Polymarket API integration for Alithos Terminal.

## Overview

Alithos Terminal uses multiple Polymarket APIs depending on the feature. **Important:** For basic trading (buy/sell), you only need a connected wallet - no API keys required! We interact directly with Polymarket's smart contracts on-chain.

1. **Gamma Markets API** - Market & event metadata (tickers, prices, volumes). **No key required.**
2. **CLOB API** - Centralized order book, limit orders. **Optional - only needed for order book features.** 
3. **Data-API** - Positions, trades, top holders, on-chain activity. **Some endpoints public; others need CLOB auth.**
4. **Subgraph (GraphQL)** - On-chain historical/aggregated data via The Graph/Goldsky. **Optional, but recommended for charts.**
5. **Direct Smart Contract Trading** - Buy/sell via wallet (no API key needed!) ✅ **This is what we use for trading**

## Trading Architecture

### Direct Smart Contract Trading (No API Key Required) ✅

**This is the primary trading method** - we interact directly with Polymarket's smart contracts:

- **FPMM (Fixed Product Market Maker)** - Direct buy/sell via smart contracts
- **Wallet-based** - Uses your connected wallet to sign transactions
- **No API key needed** - Just connect your wallet and trade!
- **On-chain** - All trades are on-chain, fully decentralized

**Implementation**: `apps/web/lib/web3/trading.ts` - Uses `useTrading()` hook

### CLOB API (Optional - Only for Order Book Features)

The CLOB API is **optional** and only needed if you want to:
- View the centralized order book
- Place limit orders on Polymarket's centralized order book
- Use advanced order book features

**You don't need CLOB API for basic trading!** The wallet is enough.

## API Usage by Feature

### Core Features

- **Watchlist** → Gamma API (market metadata, prices) ✅ No key needed
- **Tape** → CLOB API (fills) or Data-API (trades) ⚠️ Optional
- **Quick Ticket** → **Direct smart contract trading** ✅ Wallet only, no API key!
- **Depth** → CLOB API (order book) ⚠️ Optional - nice to have but not required
- **Trading** → **Direct smart contract trading** ✅ Wallet only, no API key!

### Advanced Features (Optional)

- **Charts** → Subgraph (historical data) or Data-API ⚠️ Optional
- **Exposure Tree** → Data-API (user positions) ⚠️ Optional - needs CLOB auth
- **Activity Scanner** → Data-API (on-chain activity) ⚠️ Optional
- **Correlation Matrix** → Gamma API (market data) ✅ No key needed

## Configuration

### Minimum Setup (Trading Works!)

For basic trading, you only need:
1. ✅ Connect your wallet (done via Privy)
2. ✅ Gamma API (automatic, no configuration)

**That's it!** You can start trading immediately.

### Optional API Keys (Enhanced Features)

Add these to `.env.local` in `apps/web/` for additional features:

```bash
# CLOB API Key (OPTIONAL - only for order book/limit orders)
# You DON'T need this for basic buy/sell trading!
NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY=your_clob_api_key_here
# REST endpoint: https://clob.polymarket.com
# WebSocket: wss://ws-subscriptions-clob.polymarket.com/ws/

# Subgraph (Optional - for historical chart data)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/polymarket/...
```

### Optional Custom Endpoints

The defaults work fine, but you can customize:

```bash
# Optional custom endpoints (defaults are fine)
NEXT_PUBLIC_POLYMARKET_GAMMA_API_URL=https://gamma-api.polymarket.com
NEXT_PUBLIC_POLYMARKET_CLOB_API_URL=https://clob.polymarket.com
NEXT_PUBLIC_POLYMARKET_DATA_API_URL=https://data-api.polymarket.com
NEXT_PUBLIC_POLYMARKET_CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/
```

## Trading Methods

### Method 1: Direct Smart Contract Trading ✅ (Recommended)

**What you need**: Just a connected wallet

**How it works**:
- Uses Polymarket's FPMM (Fixed Product Market Maker) smart contract
- Wallet signs transactions directly
- Trades execute on-chain immediately
- No API keys required

**Implementation**:
```typescript
import { useTrading } from '@/lib/web3/trading';

const { buy, sell } = useTrading();

// Buy YES outcome
await buy({
  marketId: 'market-id',
  outcome: 'YES',
  amount: parseUnits('100', 6), // 100 USDC
});

// Sell YES outcome
await sell({
  marketId: 'market-id',
  outcome: 'YES',
  amount: parseUnits('50', 6), // 50 USDC worth
});
```

**Features**:
- ✅ No API key needed
- ✅ Works immediately when wallet is connected
- ✅ Fully decentralized
- ✅ Direct on-chain settlement
- ✅ Gas fees only (no trading fees from API)

### Method 2: CLOB API Limit Orders (Optional)

**What you need**: CLOB API key

**How it works**:
- Places orders on Polymarket's centralized order book
- Orders can sit in the book waiting for matches
- Requires API key from Polymarket

**When to use**:
- You want limit orders (not immediate execution)
- You want to view/manage order book orders
- You want advanced order types

**Implementation**:
```typescript
import { polymarketClient } from '@/lib/api/polymarket';

await polymarketClient.placeLimitOrder({
  marketId: 'market-id',
  outcome: 'YES',
  side: 'buy',
  amount: '100',
  price: 0.52,
});
```

## What Works Without API Keys

✅ **All core trading features work:**
- Watchlist (Gamma API - no key)
- Quick Ticket trading (direct contracts - no key)
- Market data (Gamma API - no key)
- Basic market information

❌ **Features that need API keys:**
- Order book depth view (needs CLOB API)
- Limit orders on centralized book (needs CLOB API)
- User positions from Data-API (needs CLOB auth)
- Real-time WebSocket updates (needs CLOB API)

## Getting CLOB API Key (Optional)

You only need this if you want order book features. Get it from:

1. **Via Polymarket Dashboard**:
   - Sign in to Polymarket
   - Go to API settings
   - Generate API key from your connected wallet

2. **Programmatically**:
   - Use your wallet to sign a message
   - Polymarket provides instructions for generating API keys

**Note**: This is optional! Basic trading works without it.

## API Endpoints Summary

### 1. Gamma Markets API (Public) ✅
**Base URL**: `https://gamma-api.polymarket.com`
**Authentication**: None required
**Used for**: Market metadata, prices, volumes
**Required for**: Watchlist, basic market data

### 2. CLOB API (Optional) ⚠️
**REST Base**: `https://clob.polymarket.com`
**WebSocket**: `wss://ws-subscriptions-clob.polymarket.com/ws/`
**Authentication**: API key (wallet-derived)
**Used for**: Order book, limit orders, fills
**Required for**: Order book view, limit orders (optional)

### 3. Data-API (Mixed) ⚠️
**Base URL**: `https://data-api.polymarket.com`
**Authentication**: CLOB API key for authenticated endpoints
**Used for**: Positions, trades, top holders
**Required for**: User positions (optional)

### 4. Subgraph (Optional) ⚠️
**Base URL**: Varies (The Graph or Goldsky)
**Authentication**: Optional
**Used for**: Historical price data, charts
**Required for**: Historical charts (optional)

### 5. Smart Contracts (Direct Trading) ✅
**Network**: Polygon Mainnet
**Contracts**: FPMM, Conditional Tokens
**Authentication**: Wallet signature
**Used for**: Buy/sell orders
**Required for**: Trading (this is the primary method!)

## Testing

### Without API Keys (Basic Trading) ✅
The application works for core trading:
- ✅ Watchlist (using Gamma API)
- ✅ Basic market data
- ✅ **Direct contract trading** (buy/sell)
- ❌ Order book view
- ❌ Limit orders
- ❌ User positions from API

### With CLOB API Key (Enhanced Features)
Full functionality:
- ✅ All basic features
- ✅ Order book view
- ✅ Limit orders
- ✅ Real-time WebSocket updates
- ✅ User positions

## Troubleshooting

### Trading Not Working
1. Ensure wallet is connected (Privy)
2. Check you have USDC balance
3. Check you have POL for gas fees
4. Verify you're on Polygon network
5. Check browser console for contract errors

### Order Placement Issues
- **Direct trading**: Check wallet connection and balance
- **CLOB orders**: Verify CLOB API key is set and valid

### API Key Not Working
1. Verify CLOB API key is correctly generated from wallet
2. Check key is prefixed with `NEXT_PUBLIC_` for client-side access
3. Restart dev server after adding environment variables
4. Check browser console for authentication errors

## Summary

**TL;DR**: 
- ✅ **Trading works with just a connected wallet** - no API keys needed!
- ⚠️ **CLOB API key is optional** - only needed for order book features
- ✅ **Gamma API works automatically** - no configuration needed
- ⚠️ **Data-API and Subgraph are optional** - for advanced features

**Start trading immediately by just connecting your wallet!** 🚀

## Documentation

- [Polymarket Official Documentation](https://docs.polymarket.com/)
- [Gamma API Documentation](https://docs.polymarket.com/developers/gamma-api)
- [CLOB API Documentation](https://docs.polymarket.com/developers/clob-api)
- [Data-API Documentation](https://docs.polymarket.com/developers/data-api)
- [Polymarket Smart Contracts](https://docs.polymarket.com/developers/smart-contracts)
- [Polymarket Discord Community](https://discord.gg/)
