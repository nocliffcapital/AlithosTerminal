# Quick Start Guide - What You Need

This guide tells you exactly what you need and where to get it.

## ✅ What You NEED (Required)

### 1. Connected Wallet
**Status**: Already set up via Privy
**What it does**: Allows you to trade directly on Polymarket smart contracts
**Where to get it**: 
- Connect your MetaMask, WalletConnect, or other wallet when prompted
- No setup needed - Privy handles this automatically

### 2. USDC and POL Balances
**What you need**: 
- **USDC** - For trading (collateral)
- **POL** (Polygon native token) - For gas fees
**Where to get it**:
- Get POL from any Polygon-compatible exchange (Coinbase, Binance, etc.)
- Bridge USDC to Polygon or get it directly on Polygon
- Or deposit USDC to Polymarket and they'll handle it

**That's it! You can start trading immediately with just a wallet and balances.**

---

## ⚠️ What's OPTIONAL (Enhanced Features)

### 1. Gamma API Access
**What it does**: Fetch market data (prices, volumes, metadata)
**Required**: ❌ NO - It's public and works automatically
**Where to get it**: Nowhere - it's free and public!
**Endpoint**: `https://gamma-api.polymarket.com` (already configured)

### 2. CLOB API Key (Optional)
**What it does**: 
- View order book depth
- Place limit orders on centralized book
- Real-time WebSocket updates

**Required**: ❌ NO - You can trade without it!
**Where to get it**: 
1. Sign in to Polymarket: https://polymarket.com
2. Go to Settings → API
3. Generate API key from your connected wallet
4. Copy the API key

**How to use it**:
Add to `apps/web/.env.local`:
```bash
NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY=your_api_key_here
```

**Note**: You only need this if you want to:
- View the order book in the Depth card
- Place limit orders (vs immediate market orders)
- See real-time WebSocket updates

### 3. Data-API Access (Optional)
**What it does**: 
- View your positions
- Trade history
- On-chain activity data

**Required**: ❌ NO - Some endpoints are public
**Where to get it**: Uses CLOB API key for authenticated endpoints
**Configuration**: Same CLOB API key from above

### 4. Subgraph API Key (Optional)
**What it does**: Historical price data for charts

**Required**: ❌ NO - Charts can use alternative data sources
**Where to get it**:
1. Visit The Graph: https://thegraph.com
2. Create account
3. Get API key from dashboard
4. Find Polymarket subgraph

**How to use it**:
Add to `apps/web/.env.local`:
```bash
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/polymarket/...
```

---

## 📋 Step-by-Step Setup

### Step 1: Environment Variables

Edit `apps/web/.env.local`:

```bash
# REQUIRED (Already set up)
DATABASE_URL="your-postgres-url"
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"

# OPTIONAL - Add these for enhanced features
# CLOB API Key (for order book, limit orders, WebSocket)
NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY=your_clob_api_key_here

# Subgraph (for historical charts)
NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/polymarket/...
```

### Step 2: Get CLOB API Key (Optional)

1. **Go to Polymarket**: https://polymarket.com
2. **Sign in** with your wallet
3. **Navigate to**: Settings → API (or Developer Settings)
4. **Generate API Key** from your connected wallet
5. **Copy the key**
6. **Add to `.env.local`**:
   ```bash
   NEXT_PUBLIC_POLYMARKET_CLOB_API_KEY=paste_your_key_here
   ```

### Step 3: Get Subgraph API Key (Optional - for charts)

1. **Go to The Graph**: https://thegraph.com
2. **Sign up** or sign in
3. **Go to**: Dashboard → API Keys
4. **Create API key**
5. **Find Polymarket subgraph**: Search for "polymarket" in subgraph explorer
6. **Copy subgraph URL** (should be like `https://api.thegraph.com/subgraphs/name/polymarket/...`)
7. **Add to `.env.local`**:
   ```bash
   NEXT_PUBLIC_POLYMARKET_SUBGRAPH_URL=paste_url_here
   ```

### Step 4: Restart Server

```bash
cd apps/web
npm run dev
```

---

## 🎯 What Works With What

### Minimum Setup (Just Wallet) ✅
Works:
- ✅ Watchlist (market data)
- ✅ Trading (buy/sell via contracts)
- ✅ Basic market information
- ✅ Quick Ticket card

Doesn't work:
- ❌ Order book depth view
- ❌ Limit orders
- ❌ Real-time WebSocket updates

### With CLOB API Key ✅✅
Everything above PLUS:
- ✅ Order book depth view
- ✅ Limit orders
- ✅ Real-time WebSocket updates
- ✅ User positions (if authenticated)

### With Subgraph ✅✅✅
Everything above PLUS:
- ✅ Historical price charts
- ✅ Historical data analysis

---

## 🔗 Where to Get Everything

### Free & Automatic (No Setup Needed)
- ✅ **Gamma API**: Already configured, works automatically
- ✅ **Wallet Connection**: Via Privy (automatic)

### Optional APIs (Need Sign-up)

#### CLOB API Key
- **Website**: https://polymarket.com
- **Path**: Settings → API → Generate Key
- **Cost**: Free
- **Time**: 2 minutes

#### Subgraph API Key
- **Website**: https://thegraph.com
- **Path**: Dashboard → API Keys → Create Key
- **Cost**: Free tier available
- **Time**: 5 minutes

#### Database (Already Set Up)
- **Provider**: Neon, Supabase, or your own PostgreSQL
- **Status**: ✅ Already configured

#### Privy (Already Set Up)
- **Provider**: Privy
- **Status**: ✅ Already configured

---

## ⚡ Quick Test

### Test Trading (No API Keys Needed)
1. Connect your wallet
2. Open Quick Ticket card
3. Select a market
4. Enter amount
5. Click Buy/Sell
6. Sign transaction in wallet
7. ✅ Trade executes!

### Test Order Book (Needs CLOB API Key)
1. Add CLOB API key to `.env.local`
2. Restart server
3. Open Depth card
4. Select a market
5. ✅ Order book appears!

---

## 🆘 Troubleshooting

### "I can't trade"
- Check wallet is connected
- Verify you have USDC balance
- Verify you have POL for gas
- Check browser console for errors

### "Order book not showing"
- Check CLOB API key is set in `.env.local`
- Restart dev server after adding key
- Check browser console for API errors

### "Charts not loading"
- Subgraph is optional
- Check if Subgraph URL is correct
- Or charts will use alternative data sources

---

## 📝 Summary

**Minimum Requirements:**
1. ✅ Wallet connected (automatic via Privy)
2. ✅ USDC and POL balances

**Optional Enhancements:**
1. ⚠️ CLOB API key (for order book)
2. ⚠️ Subgraph URL (for charts)

**You can start trading RIGHT NOW with just a wallet!** 🚀

All the API keys are just for enhanced features like order book view and historical charts.

