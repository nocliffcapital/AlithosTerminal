'use client';

import { useEffect, useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, formatUnits, Address, http } from 'viem';
import { polygon } from 'viem/chains';
import { erc20ABI, USDC_ADDRESS } from '@/lib/web3/polymarket-contracts';
import { getEffectiveAddress } from '@/lib/web3/proxy-wallet';
import { Loader2 } from 'lucide-react';

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

// POL Logo - Official Polygon logo
const POL_ICON_URL = 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreifes2q3lvsf5e5ifumgisgwq2vmx756imjifmo7fa5n6uavyzgcg4';

function POLLogo({ className }: { className?: string }) {
  return (
    <img
      src={POL_ICON_URL}
      alt="POL"
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

// USDC Logo - Official Circle USD Coin logo
const USDC_ICON_URL = 'https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreierhlpqt7bqs7h6473wumrgxlgvei37fldrjal5ndvpoo74hjzbbe';

function USDCLogo({ className }: { className?: string }) {
  return (
    <img
      src={USDC_ICON_URL}
      alt="USDC"
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

export function BalanceBar() {
  const { user, authenticated } = usePrivy();
  const [balances, setBalances] = useState<{ usdc: TokenBalance | null; pol: TokenBalance | null }>({
    usdc: null,
    pol: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!authenticated || !user?.wallet?.address) {
      setBalances({ usdc: null, pol: null });
      isInitialLoadRef.current = true;
      setIsLoading(false);
      return;
    }

    // Reset initial load state when wallet changes
    isInitialLoadRef.current = true;

    const fetchBalances = async () => {
      // Only show loading state on initial load
      if (isInitialLoadRef.current) {
        setIsLoading(true);
      }
      try {
        // Use public RPC endpoint for Polygon
        const publicClient = createPublicClient({
          chain: polygon,
          transport: http('https://polygon-rpc.com'),
        });

        const eoaAddress = user.wallet?.address as Address;
        if (!eoaAddress) return;
        
        // Check for proxy wallet (Polymarket users have a proxy wallet that holds positions/USDC)
        const effectiveAddress = await getEffectiveAddress(eoaAddress);
        
        // Fetch USDC balance from proxy wallet if it exists, otherwise from EOA
        // Note: For trading, we still need USDC in EOA to pay for trades
        // But proxy wallet holds positions accumulated via Polymarket.com
        const usdcBalanceProxy = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [effectiveAddress],
        }).catch(() => 0n);
        
        const usdcBalanceEOA = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [eoaAddress],
        }).catch(() => 0n);
        
        // Use the larger balance (proxy wallet typically has more for Polymarket users)
        const usdcBalance = usdcBalanceProxy > usdcBalanceEOA ? usdcBalanceProxy : usdcBalanceEOA;

        // Fetch POL balance (native MATIC/POL on Polygon) - need POL in EOA for gas
        const polBalance = await publicClient.getBalance({
          address: eoaAddress,
        }).catch(() => {
          // If balance fetch fails, return 0
          return 0n;
        });

        setBalances({
          usdc: {
            symbol: 'USDC',
            balance: formatUnits(usdcBalance, 6), // USDC has 6 decimals
            decimals: 6,
          },
          pol: {
            symbol: 'POL',
            balance: formatUnits(polBalance, 18), // MATIC/POL has 18 decimals
            decimals: 18,
          },
        });
        // Mark initial load as complete after first successful fetch
        isInitialLoadRef.current = false;
      } catch (error) {
        console.error('Error fetching balances:', error);
        // Only set balances to 0 on error if we don't have existing balances
        setBalances((prev) => {
          if (!prev.usdc && !prev.pol) {
            return {
              usdc: { symbol: 'USDC', balance: '0', decimals: 6 },
              pol: { symbol: 'POL', balance: '0', decimals: 18 },
            };
          }
          return prev; // Keep existing balances on error
        });
        // Mark initial load as complete even on error so we don't keep showing loading
        isInitialLoadRef.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();

    // Refresh balances every 30 seconds (reduced frequency)
    const interval = setInterval(fetchBalances, 30000);

    return () => clearInterval(interval);
  }, [user?.wallet?.address, authenticated]);

  if (!authenticated || !user?.wallet?.address) {
    return null;
  }

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    // Both POL and USDC show 2 decimal places
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex items-center border border-border bg-card overflow-hidden h-9 shadow-sm hover:shadow-md transition-shadow duration-200">
      {isLoading ? (
        <div className="flex items-center justify-center px-4 w-full h-full">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* POL Section */}
          <div className="flex items-center gap-2.5 px-3.5 h-full flex-1 min-w-0 hover:bg-accent/10 transition-colors duration-150 cursor-default">
            <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center overflow-hidden rounded-full">
              <POLLogo className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-[8px] font-medium text-muted-foreground leading-tight uppercase tracking-wide">POL</span>
              {balances.pol ? (
                <span className="text-xs font-semibold leading-tight truncate">
                  {formatBalance(balances.pol.balance)}
                </span>
              ) : (
                <span className="text-xs font-semibold leading-tight">0.00</span>
              )}
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-full bg-border/50 flex-shrink-0" />

          {/* USDC Section */}
          <div className="flex items-center gap-2.5 px-3.5 h-full flex-1 min-w-0 hover:bg-accent/10 transition-colors duration-150 cursor-default">
            <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center overflow-hidden rounded-full">
              <USDCLogo className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-[8px] font-medium text-muted-foreground leading-tight uppercase tracking-wide">USDC</span>
              {balances.usdc ? (
                <span className="text-xs font-semibold leading-tight truncate">
                  {formatBalance(balances.usdc.balance)}
                </span>
              ) : (
                <span className="text-xs font-semibold leading-tight">0.00</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
