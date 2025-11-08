'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Copy, TrendingUp, TrendingDown, ArrowLeft, ArrowDownCircle, ArrowUpCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { polymarketClient } from '@/lib/api/polymarket';
import { useQuery } from '@tanstack/react-query';
import { LightweightChartCard, SeriesData } from '@/components/charts/LightweightChartCard';
import { convertHistoricalPricesToLightweight } from '@/lib/charts/utils';
import { createPublicClient, http, formatUnits, Address } from 'viem';
import { polygon } from 'viem/chains';
import { getEffectiveAddress } from '@/lib/web3/proxy-wallet';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { useRouter } from 'next/navigation';

// Minimal ERC20 ABI (just balanceOf function)
const erc20ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address; // USDC on Polygon

export default function ProfilePage() {
  const { user } = usePrivy();
  const router = useRouter();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const { dbUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '1d' | '1w' | '1m' | 'max'>('max');
  const [activeTab, setActiveTab] = useState<'positions' | 'closed' | 'activity'>('positions');

  // Get wallet address
  const walletAddress = useMemo(() => {
    if (user?.wallet?.address) return user.wallet.address;
    if (user?.linkedAccounts) {
      const wallet = user.linkedAccounts.find((acc: any) => acc.type === 'wallet');
      if (wallet && 'address' in wallet) return wallet.address;
    }
    if (dbUser?.walletAddress) return dbUser.walletAddress;
    return null;
  }, [user, dbUser]);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Fetch PnL data
  const { data: pnlData = [] } = useQuery({
    queryKey: ['pnl', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      return await polymarketClient.getPnLData(walletAddress);
    },
    enabled: !!walletAddress,
    staleTime: 60000, // 1 minute
  });

  // Calculate metrics from PnL data
  const accountMetrics = useMemo(() => {
    if (!pnlData || pnlData.length === 0) {
      return {
        holdings: 'Loading...',
        usdc: '$0.00',
        pnl: 'Loading...',
        volume: 'Loading...',
        marketsTraded: '0',
      };
    }

    const totalHoldings = pnlData.reduce((sum: number, pos: any) => 
      sum + (parseFloat(pos.currentValue || '0')), 0
    );
    
    const totalPnL = pnlData.reduce((sum: number, pos: any) => 
      sum + (parseFloat(pos.realizedPnL || '0') + parseFloat(pos.unrealizedPnL || '0')), 0
    );

    const uniqueMarkets = new Set(pnlData.map((pos: any) => pos.marketId)).size;

    // TODO: Fetch actual volume from trades/subgraph
    const volume = 0;

    return {
      holdings: totalHoldings > 0 ? `$${totalHoldings.toFixed(2)}` : '$0.00',
      usdc: '$0.00', // Will be updated from BalanceBar
      pnl: totalPnL > 0 ? `$${totalPnL.toFixed(2)}` : totalPnL < 0 ? `-$${Math.abs(totalPnL).toFixed(2)}` : '$0.00',
      volume: volume > 0 ? `$${volume.toFixed(2)}` : 'Loading...',
      marketsTraded: uniqueMarkets.toString(),
    };
  }, [pnlData]);

  // Fetch USDC balance
  const { data: usdcBalance = '$0.00' } = useQuery({
    queryKey: ['usdc-balance', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return '$0.00';
      
      try {
        const publicClient = createPublicClient({
          chain: polygon,
          transport: http('https://polygon-rpc.com'),
        });

        const eoaAddress = walletAddress as Address;
        const effectiveAddress = await getEffectiveAddress(eoaAddress);
        
        // Fetch USDC balance from proxy wallet if it exists, otherwise from EOA
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
        
        // Use the larger balance
        const usdcBalance = usdcBalanceProxy > usdcBalanceEOA ? usdcBalanceProxy : usdcBalanceEOA;
        const formatted = formatUnits(usdcBalance, 6);
        
        return `$${parseFloat(formatted).toFixed(2)}`;
      } catch (error) {
        console.error('Error fetching USDC balance:', error);
        return '$0.00';
      }
    },
    enabled: !!walletAddress,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  const allTimePnL = accountMetrics.pnl;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-8 w-8 hover:bg-accent hover:border-border"
            title="Back to workspace"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Account Profile</h1>
            {walletAddress && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyAddress}
                  className="h-6 w-6 p-0 hover:bg-accent"
                  title={copied ? 'Copied!' : 'Copy address'}
                >
                  <Copy className={`h-3 w-3 ${copied ? 'text-status-success' : 'text-muted-foreground'}`} />
                </Button>
                <a
                  href={`https://polygonscan.com/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-accent rounded transition-colors"
                  title="View on PolygonScan"
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDepositModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deposit</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setWithdrawModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Withdraw</span>
            </Button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1.5">Holdings</div>
            <div className="text-base sm:text-lg font-mono font-semibold">{accountMetrics.holdings}</div>
          </div>
          <div className="bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center overflow-hidden rounded-full">
                <img
                  src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreierhlpqt7bqs7h6473wumrgxlgvei37fldrjal5ndvpoo74hjzbbe"
                  alt="USDC"
                  className="h-3 w-3"
                  style={{ objectFit: 'contain' }}
                />
              </div>
              <div className="text-[8px] text-muted-foreground">USDC Balance</div>
            </div>
            <div className="text-base sm:text-lg font-mono font-semibold">{usdcBalance}</div>
          </div>
          <div className="bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1.5">
              {parseFloat(accountMetrics.pnl.replace(/[$,]/g, '')) >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-status-error" />
              )}
              <div className="text-xs text-muted-foreground">Total P&L</div>
            </div>
            <div className={`text-base sm:text-lg font-mono font-semibold ${
              parseFloat(accountMetrics.pnl.replace(/[$,]/g, '')) >= 0 ? 'text-status-success' : 'text-status-error'
            }`}>
              {accountMetrics.pnl}
            </div>
          </div>
          <div className="bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1.5">Volume</div>
            <div className="text-base sm:text-lg font-mono font-semibold">{accountMetrics.volume}</div>
          </div>
          <div className="bg-card border border-border shadow-card hover:shadow-card-hover transition-all duration-300 p-3 sm:p-4">
            <div className="text-xs text-muted-foreground mb-1.5">Markets Traded</div>
            <div className="text-base sm:text-lg font-mono font-semibold">{accountMetrics.marketsTraded}</div>
          </div>
        </div>
      </div>

      {/* PnL History */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
        <div className="bg-card border border-border shadow-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">PnL History</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex gap-1 flex-wrap">
                {(['1h', '6h', '1d', '1w', '1m', 'max'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={selectedTimeRange === range ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelectedTimeRange(range)}
                  >
                    {range.toUpperCase()}
                  </Button>
                ))}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                All Time: <span className={`font-mono font-semibold ${
                  parseFloat(allTimePnL.replace(/[$,]/g, '')) >= 0 ? 'text-status-success' : 'text-status-error'
                }`}>{allTimePnL}</span>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="h-64 sm:h-80">
            {pnlData && pnlData.length > 0 ? (
              (() => {
                // Convert PnL data to Lightweight Charts format
                // Assuming pnlData has structure: [{ timestamp: number, pnl: number }]
                const pnlSeries: SeriesData[] = [
                  {
                    data: convertHistoricalPricesToLightweight(
                      pnlData.map((item: any) => ({
                        timestamp: item.timestamp || Date.now(),
                        price: 0, // Not used for PnL
                        probability: item.pnl || 0, // Use pnl as value
                      }))
                    ),
                    color: 'hsl(var(--primary))',
                    label: 'PnL',
                  },
                ];
                
                return (
                  <LightweightChartCard
                    series={pnlSeries}
                    showLabels={false}
                  />
                );
              })()
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div className="text-xs text-muted-foreground">Loading PnL chart...</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
        <div className="bg-card border border-border shadow-card">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border bg-accent/20 px-2 sm:px-4">
            {(['positions', 'closed', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'positions' ? 'Positions' : tab === 'closed' ? 'Closed Positions' : 'Activity'}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="h-96 overflow-auto">
            {activeTab === 'positions' && (
              <div className="p-3 sm:p-4">
                {pnlData && pnlData.length > 0 ? (
                  <div className="space-y-2">
                    {pnlData.filter((pos: any) => parseFloat(pos.currentValue || '0') > 0).map((pos: any) => (
                      <div 
                        key={pos.id} 
                        className="p-3 bg-accent/20 border border-border hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs sm:text-sm font-semibold font-mono truncate max-w-[200px] sm:max-w-none">
                            {pos.marketId.slice(0, 16)}...
                          </div>
                          <div className={`text-xs sm:text-sm font-mono font-semibold flex items-center gap-1 ${
                            parseFloat(pos.unrealizedPnL || '0') >= 0 ? 'text-status-success' : 'text-status-error'
                          }`}>
                            {parseFloat(pos.unrealizedPnL || '0') >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {parseFloat(pos.unrealizedPnL || '0') >= 0 ? '+' : ''}
                            ${parseFloat(pos.unrealizedPnL || '0').toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Outcome: {pos.outcome}</span>
                          <span className="font-mono">Value: ${parseFloat(pos.currentValue || '0').toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <div className="text-xs text-muted-foreground">Loading positions...</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'closed' && (
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs text-muted-foreground">No closed positions found</div>
                    <div className="text-xs text-muted-foreground/70">Closed positions will appear here</div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'activity' && (
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs text-muted-foreground">No activity found</div>
                    <div className="text-xs text-muted-foreground/70">Trading activity will appear here</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
      <WithdrawModal 
        open={withdrawModalOpen} 
        onOpenChange={setWithdrawModalOpen}
        currentBalance={usdcBalance.replace('$', '')}
      />
    </div>
  );
}

