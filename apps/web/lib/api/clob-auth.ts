// CLOB API Authentication
// Based on: https://docs.polymarket.com/developers/CLOB/authentication
// Supports both L1 (Private Key) and L2 (API Key) authentication

import { Address } from 'viem';
import { polygon } from 'viem/chains';

/**
 * L1 Authentication: Private Key Authentication
 * Uses wallet signature directly - no API key needed!
 * Required for: Placing orders, creating/revoking API keys
 * 
 * Headers:
 * - POLY_ADDRESS: Polygon address
 * - POLY_SIGNATURE: CLOB EIP-712 signature
 * - POLY_TIMESTAMP: Current UNIX timestamp
 * - POLY_NONCE: Nonce (default 0)
 */
export interface L1AuthHeaders {
  'POLY_ADDRESS': string;
  'POLY_SIGNATURE': string;
  'POLY_TIMESTAMP': string;
  'POLY_NONCE': string;
}

/**
 * L2 Authentication: API Key Authentication
 * Uses API key, secret, and passphrase
 * Created via POST /auth/api-key using L1 authentication
 * 
 * Headers:
 * - POLY_ADDRESS: Polygon address
 * - POLY_SIGNATURE: HMAC signature for request
 * - POLY_TIMESTAMP: Current UNIX timestamp
 * - POLY_API_KEY: Polymarket API key
 * - POLY_PASSPHRASE: Polymarket API key passphrase
 */
export interface L2AuthHeaders {
  'POLY_ADDRESS': string;
  'POLY_SIGNATURE': string; // HMAC signature
  'POLY_TIMESTAMP': string;
  'POLY_API_KEY': string;
  'POLY_PASSPHRASE': string;
}

/**
 * Generate L1 authentication headers using wallet signature
 * This is the PRIMARY method - uses the wallet directly, no API key needed!
 * 
 * See: https://docs.polymarket.com/developers/CLOB/authentication#l1-private-key-authentication
 * 
 * @param address - User's Polygon address
 * @param walletClient - Viem wallet client (from useTrading hook)
 * @param nonce - Nonce (default: '0')
 * @returns L1 authentication headers
 */
export async function generateL1AuthHeaders(
  address: Address,
  walletClient: any,
  nonce: string = '0'
): Promise<L1AuthHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Get the current chain ID from the wallet to ensure it matches
  let chainId: number;
  try {
    chainId = await walletClient.getChainId();
    console.log('Wallet chain ID:', chainId);
  } catch (error) {
    console.warn('Failed to get chain ID from wallet, defaulting to Polygon:', error);
    chainId = polygon.id; // Fallback to Polygon
  }

  // EIP-712 domain for CLOB authentication
  // As per Polymarket docs: https://docs.polymarket.com/developers/CLOB/authentication#signing-example
  const domain = {
    name: 'ClobAuthDomain',
    version: '1',
    chainId: chainId, // Use wallet's current chain ID
  };

  // EIP-712 types
  const types = {
    ClobAuth: [
      { name: 'address', type: 'address' },
      { name: 'timestamp', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
  };

  // EIP-712 value
  const value = {
    address: address.toLowerCase(),
    timestamp: timestamp,
    nonce: BigInt(nonce), // Convert to BigInt for uint256
    message: 'This message attests that I control the given wallet',
  };

  try {
    console.log('Generating L1 auth headers, about to request signature...', {
      address,
      domain,
      types,
      value,
    });

    // Get the account from the wallet client
    const accounts = await walletClient.getAddresses();
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available for signing');
    }
    const accountAddress = accounts[0];
    console.log('Using account for signing:', accountAddress);

    // Sign typed data using wallet client
    // walletClient should be from viem's createWalletClient
    // THIS CALL TRIGGERS THE WALLET POPUP - the user will see their wallet extension popup
    console.log('Calling walletClient.signTypedData() - this should trigger wallet popup...');
    const signature = await walletClient.signTypedData({
      account: accountAddress,
      domain,
      types,
      primaryType: 'ClobAuth',
      message: value,
    });
    
    console.log('✅ Signature received:', signature);

    return {
      'POLY_ADDRESS': address,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': timestamp,
      'POLY_NONCE': nonce,
    };
  } catch (error) {
    console.error('Error generating L1 auth headers:', error);
    throw new Error('Failed to generate L1 authentication headers');
  }
}

/**
 * Generate L2 authentication headers using API key
 * Requires: API key, secret, passphrase (created via /auth/api-key)
 * 
 * NOTE: L2 authentication requires HMAC signing which should be done server-side
 * or using Web Crypto API. This is a placeholder implementation.
 * 
 * For client-side apps, prefer L1 authentication (wallet signature) instead!
 * 
 * See: https://docs.polymarket.com/developers/CLOB/authentication#l2-api-key-authentication
 */
export async function generateL2AuthHeaders(
  address: Address,
  apiKey: string,
  secret: string,
  passphrase: string,
  method: string,
  path: string,
  body?: string
): Promise<L2AuthHeaders> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Create HMAC signature for the request
  // Format: timestamp + method + path + body
  const message = timestamp + method.toUpperCase() + path + (body || '');
  
  // Generate HMAC-SHA256 signature using Web Crypto API
  // Note: This requires the secret to be available (should be stored securely)
  let signature = '';
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureArrayBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureArrayBuffer));
    // Convert to base64 (browser-compatible)
    signature = btoa(String.fromCharCode(...signatureArray));
  } catch (error) {
    console.error('Error generating HMAC signature:', error);
    throw new Error('Failed to generate L2 authentication signature');
  }

  return {
    'POLY_ADDRESS': address,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp,
    'POLY_API_KEY': apiKey,
    'POLY_PASSPHRASE': passphrase,
  };
}

/**
 * Create CLOB API key using L1 authentication
 * This generates an API key that can be used for L2 authentication
 */
export async function createClobApiKey(
  address: Address,
  walletClient: any
): Promise<{ key: string; secret: string; passphrase: string }> {
  const l1Headers = await generateL1AuthHeaders(address, walletClient);

  try {
    const response = await fetch('https://clob.polymarket.com/auth/api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...l1Headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create API key: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      key: data.key,
      secret: data.secret,
      passphrase: data.passphrase,
    };
  } catch (error) {
    console.error('Error creating CLOB API key:', error);
    throw error;
  }
}

/**
 * Derive existing API key using L1 authentication
 */
export async function deriveClobApiKey(
  address: Address,
  walletClient: any,
  nonce: string = '0'
): Promise<{ key: string; secret: string; passphrase: string }> {
  const l1Headers = await generateL1AuthHeaders(address, walletClient, nonce);

  try {
    const response = await fetch(
      `https://clob.polymarket.com/auth/derive-api-key?nonce=${nonce}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...l1Headers,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to derive API key: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      key: data.key,
      secret: data.secret,
      passphrase: data.passphrase,
    };
  } catch (error) {
    console.error('Error deriving CLOB API key:', error);
    throw error;
  }
}

