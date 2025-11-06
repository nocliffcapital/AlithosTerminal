// Polymarket Proxy Wallet Support
// When users trade on Polymarket.com, they create a 1-of-1 multisig (proxy wallet)
// All positions and USDC are held in this proxy wallet, not the EOA
// See: https://docs.polymarket.com/

import { Address, createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { parseAbi } from 'viem';

// Proxy wallet factory addresses (Polygon)
export const GNOSIS_SAFE_FACTORY: Address = '0xaacfeea03eb1561c4e67d661e40682bd20e3541b';
export const POLYMARKET_PROXY_FACTORY: Address = '0xaB45c54AB0c941a2F231C04C3f49182e1A254052';

// Simplified factory ABI - just enough to check for deployed wallets
const factoryABI = parseAbi([
  'function getSafeAddress(address owner) external view returns (address)',
  'function getProxyAddress(address owner) external view returns (address)',
  'function isDeployed(address owner) external view returns (bool)',
]);

// Gnosis Safe ABI - to check if an address is a Safe and get owners
const gnosisSafeABI = parseAbi([
  'function getOwners() external view returns (address[])',
  'function isOwner(address owner) external view returns (bool)',
  'function getThreshold() external view returns (uint256)',
]);

/**
 * Find proxy wallet address for a given EOA
 * Tries both Gnosis Safe factory (MetaMask users) and Polymarket proxy factory (MagicLink users)
 */
export async function findProxyWallet(eoaAddress: Address): Promise<Address | null> {
  const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com'),
  });

  try {
    // Try Gnosis Safe factory first (MetaMask users)
    try {
      const safeAddress = await publicClient.readContract({
        address: GNOSIS_SAFE_FACTORY,
        abi: factoryABI,
        functionName: 'getSafeAddress',
        args: [eoaAddress],
      }).catch(() => null);

      if (safeAddress && safeAddress !== '0x0000000000000000000000000000000000000000') {
        // Verify it's actually deployed and owned by this EOA
        const isOwner = await publicClient.readContract({
          address: safeAddress as Address,
          abi: gnosisSafeABI,
          functionName: 'isOwner',
          args: [eoaAddress],
        }).catch(() => false);

        if (isOwner) {
          return safeAddress as Address;
        }
      }
    } catch (error) {
      console.warn('Error checking Gnosis Safe factory:', error);
    }

    // Try Polymarket proxy factory (MagicLink users)
    try {
      const proxyAddress = await publicClient.readContract({
        address: POLYMARKET_PROXY_FACTORY,
        abi: factoryABI,
        functionName: 'getProxyAddress',
        args: [eoaAddress],
      }).catch(() => null);

      if (proxyAddress && proxyAddress !== '0x0000000000000000000000000000000000000000') {
        // Verify it's deployed (check if it has code)
        const code = await publicClient.getBytecode({ address: proxyAddress as Address });
        if (code && code !== '0x') {
          return proxyAddress as Address;
        }
      }
    } catch (error) {
      console.warn('Error checking Polymarket proxy factory:', error);
    }

    return null;
  } catch (error) {
    console.error('Error finding proxy wallet:', error);
    return null;
  }
}

/**
 * Get the effective address to check balances/positions for
 * Returns proxy wallet if it exists, otherwise returns EOA
 */
export async function getEffectiveAddress(eoaAddress: Address): Promise<Address> {
  const proxyWallet = await findProxyWallet(eoaAddress);
  return proxyWallet || eoaAddress;
}

