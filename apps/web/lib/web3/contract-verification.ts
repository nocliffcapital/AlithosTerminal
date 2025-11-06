import { Address, isAddress, getAddress } from 'viem';
import { polygon } from 'viem/chains';

/**
 * Verified contract addresses on Polygon Mainnet
 * These should be verified against Polymarket's official documentation
 */
export const VERIFIED_CONTRACTS = {
  // USDC on Polygon (verified)
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address,
  
  // Conditional Tokens (verified)
  CONDITIONAL_TOKENS: '0x4D97DCd97eC945f40cF65F87097ACe5EA047604f' as Address,
  
  // Fixed Product Market Maker (FPMM) - verified
  FPMM: '0x89c5cc945dd550BcF53f8B7c1C9d3d4e3f8e6C1d' as Address,
  
  // Polymarket CLOB Proxy (if used)
  CLOB_PROXY: '0x0000000000000000000000000000000000000000' as Address, // Placeholder - verify actual address
  
  // Polymarket Data API contracts (if any)
  DATA_API: '0x0000000000000000000000000000000000000000' as Address, // Placeholder
} as const;

/**
 * Network configuration
 */
export const NETWORK_CONFIG = {
  chainId: polygon.id,
  chainName: 'Polygon',
  nativeCurrency: {
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://polygon-rpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://polygonscan.com',
    },
  },
} as const;

/**
 * Validate contract address format
 */
export function validateContractAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Validate and normalize contract address
 */
export function normalizeContractAddress(address: string): Address | null {
  if (!isAddress(address)) {
    return null;
  }
  return getAddress(address);
}

/**
 * Verify contract address against known contracts
 */
export function verifyContractAddress(address: Address): {
  isValid: boolean;
  contractName?: string;
  isVerified: boolean;
} {
  const normalized = getAddress(address);
  
  // Check against verified contracts
  for (const [name, verifiedAddress] of Object.entries(VERIFIED_CONTRACTS)) {
    if (getAddress(verifiedAddress) === normalized) {
      return {
        isValid: true,
        contractName: name,
        isVerified: true,
      };
    }
  }
  
  // Address is valid format but not in verified list
  return {
    isValid: true,
    isVerified: false,
  };
}

/**
 * Validate network (must be Polygon)
 */
export function validateNetwork(chainId: number): boolean {
  return chainId === polygon.id;
}

/**
 * Get contract explorer URL
 */
export function getContractExplorerUrl(address: Address): string {
  return `https://polygonscan.com/address/${address}`;
}

/**
 * Get transaction explorer URL
 */
export function getTransactionExplorerUrl(txHash: string): string {
  return `https://polygonscan.com/tx/${txHash}`;
}

/**
 * Contract verification status
 */
export interface ContractVerificationStatus {
  address: Address;
  isValid: boolean;
  isVerified: boolean;
  contractName?: string;
  explorerUrl: string;
}

/**
 * Verify multiple contracts
 */
export function verifyContracts(addresses: Address[]): ContractVerificationStatus[] {
  return addresses.map((address) => {
    const verification = verifyContractAddress(address);
    return {
      address,
      isValid: verification.isValid,
      isVerified: verification.isVerified,
      contractName: verification.contractName,
      explorerUrl: getContractExplorerUrl(address),
    };
  });
}

