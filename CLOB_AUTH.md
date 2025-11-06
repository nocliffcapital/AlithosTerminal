# CLOB API Authentication Guide

Based on [Polymarket CLOB Authentication Documentation](https://docs.polymarket.com/developers/CLOB/authentication).

## Overview

Polymarket's CLOB API supports **two levels of authentication**:

1. **L1: Private Key Authentication** (Preferred) ✅
   - Uses wallet signature directly
   - **No API key needed!**
   - Required for: Placing orders, creating/revoking API keys

2. **L2: API Key Authentication** (Optional)
   - Uses API key, secret, and passphrase
   - Created via `POST /auth/api-key` using L1 authentication
   - Convenience method for frequent API calls

## L1 Authentication (Recommended) ✅

### Why Use L1?

- ✅ **No API key needed** - uses your wallet directly
- ✅ **Non-custodial** - your funds stay in your wallet
- ✅ **Simpler setup** - just sign a message with your wallet
- ✅ **More secure** - private key never leaves your wallet

### How It Works

1. User connects wallet (via Privy)
2. Generate EIP-712 signature using wallet
3. Include signature in request headers

### Headers Required

| Header          | Required? | Description            |
| --------------- | --------- | ---------------------- |
| POLY_ADDRESS   | yes       | Polygon address        |
| POLY_SIGNATURE | yes       | CLOB EIP 712 signature |
| POLY_TIMESTAMP | yes       | Current UNIX timestamp |
| POLY_NONCE     | yes       | Nonce. Default 0       |

### EIP-712 Message Structure

```typescript
domain = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137, // Polygon Chain ID
}

types = {
  ClobAuth: [
    { name: "address", type: "address" },
    { name: "timestamp", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "message", type: "string" },
  ]
}

value = {
  address: signingAddress,
  timestamp: currentUnixTimestamp,
  nonce: nonce,
  message: "This message attests that I control the given wallet",
}
```

### Usage in Code

```typescript
import { generateL1AuthHeaders } from '@/lib/api/clob-auth';
import { useTrading } from '@/lib/web3/trading';

const { getWalletClient } = useTrading();
const walletClient = await getWalletClient();
const address = user.wallet.address;

// Generate L1 auth headers
const headers = await generateL1AuthHeaders(address, walletClient);

// Use headers in CLOB API requests
const response = await fetch('https://clob.polymarket.com/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  body: JSON.stringify(orderData),
});
```

### Implementation Status

✅ **Fully implemented** in `apps/web/lib/api/clob-auth.ts`:
- `generateL1AuthHeaders()` - generates L1 auth headers
- Uses viem's `signTypedData()` for EIP-712 signing
- Integrated into `polymarketClient.getOrderBook()` and `placeLimitOrder()`

## L2 Authentication (Optional)

### Why Use L2?

- Convenience for frequent API calls
- Avoids repeated wallet signatures
- Useful for server-side applications

### How It Works

1. Create API key using L1 authentication:
   ```typescript
   POST /auth/api-key
   Headers: L1 authentication headers
   ```
2. Server returns: `{ key, secret, passphrase }`
3. Use API key + secret for subsequent requests

### Headers Required

| Header           | Required? | Description                   |
| ---------------- | --------- | ----------------------------- |
| POLY_ADDRESS    | yes       | Polygon address               |
| POLY_SIGNATURE  | yes       | HMAC signature for request   |
| POLY_TIMESTAMP  | yes       | Current UNIX timestamp        |
| POLY_API_KEY    | yes       | Polymarket API key            |
| POLY_PASSPHRASE | yes       | Polymarket API key passphrase |

### HMAC Signature

The `POLY_SIGNATURE` is an HMAC-SHA256 signature of:
```
timestamp + METHOD + path + body
```

Example:
```
timestamp: 1234567890
METHOD: POST
path: /orders
body: {"token_id":"...","side":"buy","size":"100","price":"0.5"}

message = "1234567890POST/orders{\"token_id\":\"...\",\"side\":\"buy\",\"size\":\"100\",\"price\":\"0.5\"}"
signature = HMAC-SHA256(secret, message)
```

### Implementation Status

⚠️ **Partially implemented** in `apps/web/lib/api/clob-auth.ts`:
- `generateL2AuthHeaders()` - generates L2 auth headers with HMAC
- Uses Web Crypto API for HMAC-SHA256 signing
- ⚠️ **Note**: API secret should be stored securely (server-side preferred)

## API Key Operations

### Create API Key

**Endpoint**: `POST /auth/api-key`  
**Auth**: L1 (wallet signature)

```typescript
import { createClobApiKey } from '@/lib/api/clob-auth';

const { key, secret, passphrase } = await createClobApiKey(address, walletClient);
```

### Derive API Key

**Endpoint**: `GET /auth/derive-api-key`  
**Auth**: L1 (wallet signature)

```typescript
import { deriveClobApiKey } from '@/lib/api/clob-auth';

const { key, secret, passphrase } = await deriveClobApiKey(address, walletClient, nonce);
```

### Get API Keys

**Endpoint**: `GET /auth/api-keys`  
**Auth**: L2 (API key)

### Delete API Key

**Endpoint**: `DELETE /auth/api-key`  
**Auth**: L2 (API key)

## Current Implementation

### What's Working ✅

- ✅ L1 authentication (wallet signature)
- ✅ EIP-712 signing with viem
- ✅ `generateL1AuthHeaders()` function
- ✅ Integration with `polymarketClient`
- ✅ `getOrderBook()` with L1 auth
- ✅ `placeLimitOrder()` with L1 auth

### What's Optional ⚠️

- ⚠️ L2 authentication (HMAC signing) - implemented but requires secure secret storage
- ⚠️ API key creation/management - functions available but not yet used in UI

## Recommendations

### For Client-Side Apps (This Project)

**Use L1 Authentication** ✅

1. ✅ No API key needed
2. ✅ Non-custodial
3. ✅ Simpler security model
4. ✅ Works directly with Privy wallets

### For Server-Side Apps

**Use L2 Authentication** ⚠️

1. API key can be stored securely on server
2. Avoids repeated wallet signatures
3. Better for high-frequency API calls

## Usage Examples

### Order Book (L1 Auth)

```typescript
import { polymarketClient } from '@/lib/api/polymarket';
import { useTrading } from '@/lib/web3/trading';

const { getWalletClient } = useTrading();
const walletClient = await getWalletClient();
const address = user.wallet.address;

const orderBook = await polymarketClient.getOrderBook(
  marketId,
  'YES',
  true, // useL1Auth
  address,
  walletClient
);
```

### Place Order (L1 Auth)

```typescript
const result = await polymarketClient.placeLimitOrder(
  {
    marketId,
    outcome: 'YES',
    side: 'buy',
    amount: '100',
    price: 0.5,
  },
  true, // useL1Auth
  address,
  walletClient
);
```

## References

- [Polymarket CLOB Authentication Docs](https://docs.polymarket.com/developers/CLOB/authentication)
- [EIP-712 Sign Typed Data](https://eips.ethereum.org/EIPS/eip-712)
- [Viem Sign Typed Data](https://viem.sh/docs/actions/wallet/signTypedData)

