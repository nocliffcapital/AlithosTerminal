// Network validation utilities

export interface NetworkValidationResult {
  isValid: boolean;
  chainId: number;
  chainName: string;
  isPolygon: boolean;
  error?: string;
}

/**
 * Validate that the user is on the Polygon network
 */
export async function validateNetwork(): Promise<NetworkValidationResult> {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        isValid: false,
        chainId: 0,
        chainName: 'Unknown',
        isPolygon: false,
        error: 'Not in browser environment',
      };
    }

    // Check if wallet is connected
    if (!window.ethereum) {
      return {
        isValid: false,
        chainId: 0,
        chainName: 'No wallet',
        isPolygon: false,
        error: 'No wallet detected',
      };
    }

    // Get current chain ID
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const chainIdNumber = parseInt(chainId as string, 16);

    // Polygon Mainnet chain ID is 137
    const POLYGON_CHAIN_ID = 137;
    const isPolygon = chainIdNumber === POLYGON_CHAIN_ID;

    const chainName = chainIdNumber === POLYGON_CHAIN_ID ? 'Polygon' : `Chain ${chainIdNumber}`;

    return {
      isValid: isPolygon,
      chainId: chainIdNumber,
      chainName,
      isPolygon,
      error: isPolygon ? undefined : `Please switch to Polygon network (Chain ID: ${POLYGON_CHAIN_ID})`,
    };
  } catch (error) {
    console.error('Network validation error:', error);
    return {
      isValid: false,
      chainId: 0,
      chainName: 'Unknown',
      isPolygon: false,
      error: error instanceof Error ? error.message : 'Failed to validate network',
    };
  }
}

/**
 * Switch to Polygon network if user is on wrong network
 */
export async function switchToPolygon(): Promise<boolean> {
  try {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    const POLYGON_CHAIN_ID = 137;
    const POLYGON_CHAIN_ID_HEX = `0x${POLYGON_CHAIN_ID.toString(16)}`;

    try {
      // Try to switch to Polygon
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // If the chain doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: POLYGON_CHAIN_ID_HEX,
                chainName: 'Polygon Mainnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://polygon-rpc.com'],
                blockExplorerUrls: ['https://polygonscan.com'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Polygon network:', addError);
          return false;
        }
      }
      throw switchError;
    }
  } catch (error) {
    console.error('Failed to switch to Polygon:', error);
    return false;
  }
}

// Hook moved to components/NetworkValidationBanner.tsx to avoid React dependency in utility file

