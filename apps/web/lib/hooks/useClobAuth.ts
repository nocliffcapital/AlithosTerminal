// Hook for CLOB API L1 authentication
// Handles wallet signature prompts for CLOB API access
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Address, createWalletClient, custom } from 'viem';
import { polygon } from 'viem/chains';
import { generateL1AuthHeaders } from '@/lib/api/clob-auth';

// Helper to check if user has an embedded wallet
function isEmbeddedWallet(provider: any): boolean {
  return provider?.isPrivy || provider?.isWalletConnect || false;
}

export interface ClobAuthState {
  isSigning: boolean;
  hasAuth: boolean;
  error: string | null;
}

// Store auth status in localStorage
const CLOB_AUTH_KEY = 'clob_auth_approved';
const CLOB_AUTH_ADDRESS_KEY = 'clob_auth_address';

/**
 * Hook to manage CLOB API L1 authentication
 * Automatically prompts user to sign message when wallet connects
 */
export function useClobAuth() {
  const { user, authenticated, sendTransaction } = usePrivy();
  
  // Get wallet client function - supports both external wallets and Privy embedded wallets
  const getWalletClient = async () => {
    // Wait for ethereum provider to be available (for embedded wallets)
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      // Check for window.ethereum (works for both external and embedded wallets)
      if (window.ethereum) {
        const provider = window.ethereum;
        
        // Check if it's a Privy embedded wallet provider
        // Privy injects window.ethereum for embedded wallets
        if (provider.isPrivy || (user?.wallet?.walletClientType === 'privy')) {
          console.log('[getWalletClient] Using Privy embedded wallet provider');
          return createWalletClient({
            chain: polygon,
            transport: custom(provider),
          });
        }
        
        // Standard external wallet (MetaMask, etc.)
        console.log('[getWalletClient] Using external wallet provider');
        return createWalletClient({
          chain: polygon,
          transport: custom(provider),
        });
      }
      
      // Wait a bit for embedded wallet provider to be injected
      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      } else {
        break;
      }
    }
    
    throw new Error('No wallet provider found. Please ensure Privy embedded wallet is initialized or connect an external wallet.');
  };
  
  const [authState, setAuthState] = useState<ClobAuthState>({
    isSigning: false,
    hasAuth: false,
    error: null,
  });

  // Use refs to track request state and prevent duplicate requests
  const isRequestingRef = useRef(false);
  const hasRequestedRef = useRef(false);
  const currentWalletRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false); // Add a processing flag to prevent concurrent runs

  // Check if user has already signed on this wallet address
  // Use walletAddress parameter instead of reading from user object to avoid dependency issues
  const checkExistingAuth = useCallback((walletAddress: string) => {
    if (typeof window === 'undefined' || !walletAddress) {
      return false;
    }
    
    const address = walletAddress.toLowerCase();
    
    // Check if user rejected in this session
    const rejectedThisSession = sessionStorage.getItem(`clob_auth_rejected_${address}`) === 'true';
    if (rejectedThisSession) {
      console.log('[checkExistingAuth] User rejected signature this session - not prompting again');
      return false; // Don't prompt again this session
    }
    
    const storedAddress = localStorage.getItem(CLOB_AUTH_ADDRESS_KEY);
    const isApproved = localStorage.getItem(CLOB_AUTH_KEY) === 'true';
    
    // If addresses don't match but there's an old approval, clear it (wallet changed)
    if (isApproved && storedAddress && storedAddress.toLowerCase() !== address) {
      console.log('[checkExistingAuth] ⚠️ Wallet address changed - clearing old approval. Old:', storedAddress, 'New:', address);
      localStorage.removeItem(CLOB_AUTH_KEY);
      localStorage.removeItem(CLOB_AUTH_ADDRESS_KEY);
      return false;
    }
    
    const matches = isApproved && storedAddress && storedAddress.toLowerCase() === address;
    
    if (matches) {
      console.log('[checkExistingAuth] ✅ Found existing approval for:', address);
    } else {
      console.log('[checkExistingAuth] No existing approval - stored:', storedAddress, 'current:', address, 'approved:', isApproved);
    }
    
    return matches;
  }, []); // Remove user dependency - pass address as parameter instead

  // Auto-request signature when wallet connects (if not already signed)
  // Only trigger once per wallet address - use a ref to track the current wallet
  useEffect(() => {
    // Skip if already processing to prevent concurrent runs
    if (isProcessingRef.current) {
      return;
    }

    // Skip if not authenticated
    if (!authenticated) {
      // Reset refs when not authenticated
      hasRequestedRef.current = false;
      isRequestingRef.current = false;
      currentWalletRef.current = null;
      isProcessingRef.current = false;
      return;
    }

    // Get wallet address from various sources (embedded wallet, linked accounts, etc.)
    let walletAddress: string | null = null;
    
    // Try to get wallet address from user.wallet (embedded wallet)
    if (user?.wallet?.address) {
      walletAddress = user.wallet.address.toLowerCase();
    }
    // Try to get from linked accounts (EOA wallets)
    else if (user?.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc: any) => acc.type === 'wallet' && 'address' in acc && acc.address
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        walletAddress = (walletAccount.address as string).toLowerCase();
      }
    }
    
    // If no wallet address found, skip
    if (!walletAddress) {
      console.log('[useClobAuth] No wallet address found - waiting for wallet to be available');
      console.log('[useClobAuth] User object:', { 
        hasWallet: !!user?.wallet, 
        walletAddress: user?.wallet?.address,
        hasLinkedAccounts: !!user?.linkedAccounts,
        linkedAccountTypes: user?.linkedAccounts?.map((acc: any) => acc.type)
      });
      // Don't reset refs - wallet might be loading
      // Wait a bit and retry - embedded wallets may take time to initialize
      setTimeout(() => {
        // Trigger re-check by updating a dependency
        if (authenticated && user) {
          // Force re-run by checking again
        }
      }, 2000); // Wait 2 seconds for embedded wallet to be ready
      return;
    }
    
    // If wallet address changed, reset flags
    if (currentWalletRef.current !== walletAddress) {
      console.log('[useClobAuth] Wallet address changed - resetting auth flags. Old:', currentWalletRef.current, 'New:', walletAddress);
      hasRequestedRef.current = false;
      isRequestingRef.current = false;
      currentWalletRef.current = walletAddress;
    }

    // First check localStorage - if already approved, don't prompt at all
    const alreadyApproved = checkExistingAuth(walletAddress);
    if (alreadyApproved) {
      // Already signed - just update state and mark as requested
      setAuthState({
        isSigning: false,
        hasAuth: true,
        error: null,
      });
      hasRequestedRef.current = true;
      isRequestingRef.current = false;
      isProcessingRef.current = false;
      return;
    }

    // Skip if we've already requested for this address (don't prompt again)
    if (hasRequestedRef.current) {
      console.log('[useClobAuth] Already requested for this wallet - skipping');
      isProcessingRef.current = false;
      return;
    }

    // Skip if already has auth or currently signing (check refs, not state)
    if (isRequestingRef.current) {
      console.log('[useClobAuth] Already requesting - skipping duplicate request');
      return;
    }

    // Mark that we're processing BEFORE any async operations
    isProcessingRef.current = true;
    isRequestingRef.current = true;
    hasRequestedRef.current = true;
    
    console.log('🔄 [useClobAuth] Wallet connected - requesting CLOB API signature for:', walletAddress);
    
    // Use setTimeout to ensure this runs after any state updates from previous renders
    setTimeout(() => {
      requestAuth()
        .then((result) => {
          console.log('✅ [useClobAuth] CLOB auth successful, result:', result ? 'headers received' : 'already approved');
          isRequestingRef.current = false;
          isProcessingRef.current = false;
          // Keep hasRequestedRef.current = true to prevent re-prompting
        })
        .catch(err => {
          console.error('❌ [useClobAuth] Auto-request auth failed:', err);
          isRequestingRef.current = false;
          isProcessingRef.current = false;
          
          // Check if user rejected - if so, keep hasRequested true so we don't ask again
          const isUserRejection = err?.message?.includes('rejected') || 
                                  err?.message?.includes('denied') ||
                                  err?.message?.includes('User rejected') ||
                                  err?.message?.includes('canceled') ||
                                  err?.message?.includes('cancelled');
          
          if (isUserRejection) {
            // User rejected - don't ask again this session
            console.log('🚫 [useClobAuth] User rejected signature - will not prompt again this session');
            // Keep hasRequestedRef.current = true so we don't prompt again
          } else {
            // Real error - reset so user can try again (but only after a delay)
            console.log('⚠️ [useClobAuth] Error occurred - will allow retry after delay');
            setTimeout(() => {
              hasRequestedRef.current = false;
            }, 5000); // Wait 5 seconds before allowing retry
          }
        });
    }, 100); // Small delay to ensure state is stable

    // Cleanup when wallet address changes
    return () => {
      // Don't reset refs here - let the effect handle it properly
    };
    // Depend on authenticated and user object - re-run when wallet becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user]);

  /**
   * Request authentication signature from user
   * This will trigger a wallet popup to sign the EIP-712 message
   * Called automatically on login or manually if needed
   */
  const requestAuth = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!authenticated) {
      setAuthState({
        isSigning: false,
        hasAuth: false,
        error: 'Not authenticated',
      });
      return null;
    }

    // Get wallet address from various sources
    let walletAddress: string | null = null;
    if (user?.wallet?.address) {
      walletAddress = user.wallet.address.toLowerCase();
    } else if (user?.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc: any) => acc.type === 'wallet' && 'address' in acc && acc.address
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        walletAddress = (walletAccount.address as string).toLowerCase();
      }
    }

    if (!walletAddress) {
      setAuthState({
        isSigning: false,
        hasAuth: false,
        error: 'Wallet not available. Embedded wallet may still be loading...',
      });
      return null;
    }

    // Check if already approved for this address - prevent duplicate requests
    // This check happens BEFORE setting isSigning state
    const alreadyApproved = checkExistingAuth(walletAddress);
    if (alreadyApproved) {
      console.log('✅ Already approved in localStorage - skipping signature request');
      setAuthState({
        isSigning: false,
        hasAuth: true,
        error: null,
      });
      isRequestingRef.current = false;
      isProcessingRef.current = false;
      return { approved: 'true' }; // Return dummy headers, we'll generate fresh ones per request
    }

    // Prevent multiple simultaneous signing attempts
    if (isRequestingRef.current) {
      console.log('Already requesting signature - skipping duplicate request');
      return null;
    }

    // Mark that we're requesting BEFORE setting state
    isRequestingRef.current = true;

    try {
      setAuthState({
        isSigning: true,
        hasAuth: false,
        error: null,
      });

      const walletClient = await getWalletClient();
      const address = walletAddress as Address;

      // Generate L1 auth headers - this will trigger wallet signature popup
      // This happens once when user logs in/connects wallet
      console.log('Requesting CLOB API signature from wallet...');
      const headers = await generateL1AuthHeaders(address, walletClient);

      // Store approval in localStorage IMMEDIATELY after successful signature
      // This must happen BEFORE state update to prevent re-triggering
      if (typeof window !== 'undefined') {
        localStorage.setItem(CLOB_AUTH_KEY, 'true');
        localStorage.setItem(CLOB_AUTH_ADDRESS_KEY, address.toLowerCase());
        // Also clear any rejection flags
        sessionStorage.removeItem(`clob_auth_rejected_${address.toLowerCase()}`);
        
        // Verify it was saved (critical for preventing loops)
        const saved = localStorage.getItem(CLOB_AUTH_KEY) === 'true' && 
                     localStorage.getItem(CLOB_AUTH_ADDRESS_KEY) === address.toLowerCase();
        console.log('✅ localStorage saved and verified:', saved);
        if (!saved) {
          console.error('⚠️ Failed to save localStorage - signature may loop!');
        }
      }

      // Mark request as complete BEFORE updating state (critical for preventing loops)
      isRequestingRef.current = false;
      isProcessingRef.current = false;
      hasRequestedRef.current = true; // Mark as requested to prevent re-prompting

      setAuthState({
        isSigning: false,
        hasAuth: true,
        error: null,
      });

      console.log('✅ CLOB API signature approved and stored');
      return {
        'POLY_ADDRESS': headers.POLY_ADDRESS,
        'POLY_SIGNATURE': headers.POLY_SIGNATURE,
        'POLY_TIMESTAMP': headers.POLY_TIMESTAMP,
        'POLY_NONCE': headers.POLY_NONCE,
      };
    } catch (error: any) {
      console.error('CLOB auth error:', error);
      
      // Don't show error if user rejected the signature
      const isUserRejection = error.message?.includes('rejected') || 
                              error.message?.includes('denied') ||
                              error.message?.includes('User rejected') ||
                              error.message?.includes('canceled') ||
                              error.message?.includes('cancelled');
      
      // Mark request as complete before updating state
      isRequestingRef.current = false;
      isProcessingRef.current = false;

      setAuthState({
        isSigning: false,
        hasAuth: false,
        error: isUserRejection ? null : (error.message || 'Failed to sign authentication message'),
      });
      
      // On user rejection, store that they rejected so we don't keep asking
      if (typeof window !== 'undefined' && isUserRejection && walletAddress) {
        // Store rejection temporarily (for this session only) to prevent spam
        sessionStorage.setItem(`clob_auth_rejected_${walletAddress}`, 'true');
      }
      
      // Clear localStorage on error (unless user rejection)
      if (typeof window !== 'undefined' && !isUserRejection) {
        localStorage.removeItem(CLOB_AUTH_KEY);
        localStorage.removeItem(CLOB_AUTH_ADDRESS_KEY);
      }
      
      return null;
    }
    // Removed authState.isSigning from dependencies to prevent callback recreation
    // We use isRequestingRef.current instead to track signing state
  }, [authenticated, user, checkExistingAuth]);

  /**
   * Get wallet client and address for passing to API methods
   */
  const getAuthParams = useCallback(async () => {
    if (!authenticated || !user) {
      return null;
    }

    // Get wallet address from various sources
    let walletAddress: string | null = null;
    if (user?.wallet?.address) {
      walletAddress = user.wallet.address.toLowerCase();
    } else if (user?.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        (acc: any) => acc.type === 'wallet' && 'address' in acc && acc.address
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        walletAddress = (walletAccount.address as string).toLowerCase();
      }
    }

    if (!walletAddress) {
      return null;
    }

    try {
      const walletClient = await getWalletClient();
      const address = walletAddress as Address;
      return { walletClient, address };
    } catch (error) {
      console.error('Error getting auth params:', error);
      return null;
    }
  }, [authenticated, user]);

  return {
    ...authState,
    authenticated,
    requestAuth,
    getAuthParams,
    isReady: authenticated && !!(user?.wallet?.address || (user?.linkedAccounts?.some((acc: any) => acc.type === 'wallet' && 'address' in acc && acc.address))),
  };
}

