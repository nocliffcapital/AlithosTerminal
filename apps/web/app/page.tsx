'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { WorkspaceGrid } from '@/components/layout/WorkspaceGrid';
import { Card } from '@/components/layout/Card';
import { PresetsDialog } from '@/components/PresetsDialog';
import { usePresets } from '@/lib/hooks/usePresets';
import { HotkeyManager } from '@/components/HotkeyManager';
import { AddCardButton } from '@/components/AddCardButton';
import { WorkspaceSelector } from '@/components/WorkspaceSelector';
import { WorkspaceTabs } from '@/components/WorkspaceTabs';
import { Footer } from '@/components/Footer';
import { BalanceBar } from '@/components/BalanceBar';
import { LinkSelectionToolbar } from '@/components/cards/LinkManager';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { WebSocketConnectionIndicator } from '@/components/WebSocketConnectionIndicator';
import { NetworkValidationBanner } from '@/components/NetworkValidationBanner';
import { AllowanceManager } from '@/components/trading/AllowanceManager';
import { RiskWarning } from '@/components/ui/RiskWarning';
import { useLayoutStore } from '@/stores/layout-store';
import { useWorkspaces, useCreateWorkspace } from '@/lib/hooks/useWorkspace';
import { useAuth } from '@/lib/hooks/useAuth';
import { useClobAuth } from '@/lib/hooks/useClobAuth';
import { useWebSocketConnection, useMarkets } from '@/lib/hooks/usePolymarketData';
import { useRealtimeConnection } from '@/lib/hooks/useRealtimeConnection';
import { useMarketStore } from '@/stores/market-store';
import { User, LogOut, Settings, ArrowDownCircle, ArrowUpCircle, TrendingUp, BarChart3, Zap, Shield, Activity, LineChart, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function Home() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { dbUser, isLoading: authLoading, error: authError } = useAuth();
  const router = useRouter();
  // Initialize CLOB auth - this will automatically prompt for signature on wallet connect
  useClobAuth();
  const [presetsDialogOpen, setPresetsDialogOpen] = useState(false);
  const { presets, savePresets } = usePresets();
  const [initTimeout, setInitTimeout] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const { currentLayout, setCurrentWorkspace, setUserId, currentWorkspaceId, linkSelectionMode } = useLayoutStore();

  // Set userId in layout store when user is available
  useEffect(() => {
    if (dbUser?.id) {
      setUserId(dbUser.id);
    }
  }, [dbUser?.id, setUserId]);
  const { data: userWorkspaces, isLoading: workspacesLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const { setMarkets } = useMarketStore();
  const { data: marketsData } = useMarkets({ active: true, limit: 100 });
  // WebSocket connection - automatically enabled when API key is configured
  useWebSocketConnection();
  // Real-time data client connection for comments and enhanced data streams
  // TEMPORARILY DISABLED - investigating error loop
  // useRealtimeConnection();

  // Add timeout for Privy initialization
  useEffect(() => {
    // Log when Privy starts initializing
    if (!ready) {
      console.log('[Privy] Waiting for initialization...');
    }
    
    const timer = setTimeout(() => {
      if (!ready) {
        console.warn('[Privy] Initialization timeout - taking longer than 10 seconds');
        console.warn('[Privy] Check browser console for network errors');
        console.warn('[Privy] Check if Privy scripts are being blocked');
        setInitTimeout(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [ready]);

  // Log when Privy becomes ready
  useEffect(() => {
    if (ready) {
      console.log('[Privy] Initialization complete');
    }
  }, [ready]);

  // Load markets into store
  useEffect(() => {
    if (marketsData && marketsData.length > 0) {
      setMarkets(marketsData);
    }
  }, [marketsData, setMarkets]);

  // Initialize workspace on load - only run once when workspaces are first loaded
  useEffect(() => {
    if (userWorkspaces && userWorkspaces.length > 0 && !currentLayout) {
      // Use first workspace
      const firstWorkspace = userWorkspaces[0];
      
      // Load the first layout for this workspace if it exists
      if (firstWorkspace.layouts && firstWorkspace.layouts.length > 0) {
        const firstLayout = firstWorkspace.layouts[0];
        if (firstLayout) {
          // Load layout into store
          useLayoutStore.getState().loadLayout(firstLayout.id);
        }
      }
      setCurrentWorkspace(firstWorkspace.id).catch((err) => {
        console.error('Failed to set workspace:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWorkspaces]); // Only depend on userWorkspaces, not currentLayout

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <div className="text-muted-foreground mb-4">Initializing Privy...</div>
          {initTimeout && (
            <div className="text-sm text-yellow-500 max-w-md p-4 border border-yellow-500 rounded-md mx-auto">
              <p className="font-medium mb-2">Initialization is taking longer than expected</p>
              <p className="text-xs mb-2">This might be due to:</p>
              <ul className="text-xs list-disc list-inside space-y-1 mb-3 text-left">
                <li>Network connectivity issues</li>
                <li>Browser extensions blocking Privy</li>
                <li>Firewall/proxy blocking Privy API</li>
                <li>Ad blockers or privacy extensions</li>
              </ul>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Retry
                </Button>
                <Button
                  onClick={() => {
                    // Try to bypass Privy and show login button
                    window.location.hash = 'skip-privy';
                    window.location.reload();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Skip Check
                </Button>
              </div>
            </div>
          )}
          {!initTimeout && (
            <p className="text-xs text-muted-foreground mt-4">
              If this takes more than 10 seconds, troubleshooting options will appear
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show error if auth fails
  if (authenticated && authError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-bold mb-4 text-destructive">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">
            {authError instanceof Error ? authError.message : 'Failed to sync user to database'}
          </p>
          <p className="text-sm text-muted-foreground">
            Check the server console for details. Make sure DATABASE_URL is set correctly.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (authLoading && authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Syncing user...</div>
      </div>
    );
  }

  // Show landing page with navbar for unauthenticated users
  if (!authenticated) {
    return (
      <main className="flex min-h-screen flex-col bg-background relative overflow-hidden">
        {/* Header - Always visible at top */}
        <header className="border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-shrink-0">
            <img 
              src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreicizxxhlc64ifefhkv52bjbjjwgeuyt6qvrqlpg6f3gzofeayah6q"
              alt="Alithos Terminal"
              className="h-6 sm:h-8 w-auto select-none"
              style={{ objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' } as React.CSSProperties}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              onClick={() => login()}
              className="px-4 py-1.5 text-sm font-medium h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200"
            >
              Get started
            </Button>
          </div>
        </header>

        {/* Hero Section - Two Column Layout */}
        <div className="flex-1 flex items-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-24 py-12 sm:py-16 md:py-20 lg:py-24 relative z-10">
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">
            {/* Left Column - Text Content */}
            <div className="flex flex-col gap-6 lg:gap-8">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                <span className="text-foreground">Professional trading terminal for</span>
                <span className="text-foreground"> prediction markets</span>
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-xl">
                Modular interface with real-time market data, advanced analytics, and institutional-grade execution. Trade smarter with multi-outcome analysis, correlation matrices, and AI-powered market research.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Button
                  onClick={() => login()}
                  size="lg"
                  className="px-8 py-6 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  Start trading
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-base font-semibold flex items-center gap-2"
                >
                  Explore docs
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right Column - Trading Terminal Preview */}
            <div className="relative lg:min-h-[500px] flex items-center justify-center">
              <div className="w-full bg-card border border-border rounded-lg shadow-2xl p-6 lg:p-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Markets</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-muted-foreground">Live</span>
                    </div>
                  </div>
                  <div className="flex gap-2 border-b border-border pb-2">
                    <button className="px-3 py-1.5 text-sm font-medium text-foreground border-b-2 border-primary">Watchlist</button>
                    <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">Active</button>
                    <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">Trending</button>
                  </div>
                  <div className="space-y-3 mt-4">
                    {/* Market Preview Cards */}
                    <div className="bg-accent/20 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground mb-1">Will Bitcoin reach $100k by 2025?</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Yes: 68%</span>
                            <span className="text-foreground">•</span>
                            <span>No: 32%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-500">$0.68</div>
                          <div className="text-xs text-muted-foreground">+2.4%</div>
                        </div>
                      </div>
                      <div className="h-1 bg-background rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '68%' }}></div>
                      </div>
                    </div>
                    <div className="bg-accent/20 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground mb-1">US Presidential Election 2024</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Democrat: 52%</span>
                            <span className="text-foreground">•</span>
                            <span>Republican: 48%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-blue-500">$0.52</div>
                          <div className="text-xs text-muted-foreground">-1.2%</div>
                        </div>
                      </div>
                      <div className="h-1 bg-background rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '52%' }}></div>
                      </div>
                    </div>
                    <div className="bg-accent/20 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground mb-1">AI achieves AGI by 2026?</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Yes: 45%</span>
                            <span className="text-foreground">•</span>
                            <span>No: 55%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-orange-500">$0.45</div>
                          <div className="text-xs text-muted-foreground">+5.8%</div>
                        </div>
                      </div>
                      <div className="h-1 bg-background rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                    <div className="bg-accent/20 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-foreground mb-1">Ethereum ETF approval</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Yes: 78%</span>
                            <span className="text-foreground">•</span>
                            <span>No: 22%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-500">$0.78</div>
                          <div className="text-xs text-muted-foreground">+0.9%</div>
                        </div>
                      </div>
                      <div className="h-1 bg-background rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '78%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <HotkeyManager />
      
      <div className="h-screen flex flex-col pb-8">
        {/* Network Validation Banner */}
        <NetworkValidationBanner />
        
        {/* Risk Warning Banner */}
        {authenticated && (
          <RiskWarning variant="banner" dismissible={true} />
        )}
        
        {/* Link Selection Toolbar (replaces navbar when active) */}
        {linkSelectionMode ? (
          <LinkSelectionToolbar />
        ) : (
          <>
            {/* Header */}
            <header className="border-b border-border bg-background/95 backdrop-blur-sm px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between sticky z-30" style={{ top: 'var(--network-banner-height, 0px)' }}>
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <img 
                src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreicizxxhlc64ifefhkv52bjbjjwgeuyt6qvrqlpg6f3gzofeayah6q"
                alt="Alithos Terminal"
                className="h-6 sm:h-8 w-auto select-none"
                style={{ objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' } as React.CSSProperties}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <WorkspaceSelector />
              <AddCardButton />
            </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                <WebSocketConnectionIndicator />
                <BalanceBar />
                <button
              onClick={() => setDepositModalOpen(true)}
              className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-accent hover:border-border/80 transition-all duration-200 font-medium h-8 shadow-sm hover:shadow-md flex items-center gap-1.5"
              title="Deposit"
              aria-label="Deposit"
            >
              <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Deposit</span>
            </button>
            <button
              onClick={() => setWithdrawModalOpen(true)}
              className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-accent hover:border-border/80 transition-all duration-200 font-medium h-8 shadow-sm hover:shadow-md flex items-center gap-1.5"
              title="Withdraw"
              aria-label="Withdraw"
            >
              <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Withdraw</span>
            </button>
            <button
              onClick={() => setPresetsDialogOpen(true)}
              className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-accent hover:border-border/80 transition-all duration-200 font-medium h-8 shadow-sm hover:shadow-md flex items-center gap-1.5"
              title="Edit presets"
              aria-label="Edit presets"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Presets</span>
            </button>
            {!authenticated && (
              <Button
                onClick={() => login()}
                className="px-4 py-1.5 text-xs font-medium h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200"
                title="Get started"
                aria-label="Get started"
              >
                Get started
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="px-3 py-1.5 border border-border bg-card hover:bg-accent hover:border-border/80 transition-all duration-200 flex items-center justify-center h-8 min-w-[32px] shadow-sm hover:shadow-md"
                  aria-label="User menu"
                >
                  <User className="text-muted-foreground h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 shadow-lg border-border">
                {/* Email (if exists) */}
                {user?.email?.address && (
                  <div className="px-3 py-2.5 text-sm text-foreground border-b border-border break-all">
                    <div className="text-xs text-muted-foreground mb-1">Email</div>
                    <div className="font-medium">{user.email.address}</div>
                  </div>
                )}
                {!user?.email?.address && (
                  <div className="px-3 py-2.5 text-sm text-muted-foreground border-b border-border">
                    User
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/profile')}
                  className="cursor-pointer py-2.5 px-3 text-sm"
                >
                  <User className="h-4 w-4 mr-2.5" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/settings')}
                  className="cursor-pointer py-2.5 px-3 text-sm"
                >
                  <Settings className="h-4 w-4 mr-2.5" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="cursor-pointer text-destructive focus:text-destructive py-2.5 px-3 text-sm"
                >
                  <LogOut className="h-4 w-4 mr-2.5" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
          </>
        )}

        {/* Workspace Tabs (hidden when selection mode is active) */}
        {!linkSelectionMode && <WorkspaceTabs />}

        {/* Workspace */}
        <div className="flex-1 overflow-hidden">
          {workspacesLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-muted-foreground text-sm">Loading workspaces...</div>
            </div>
          ) : currentWorkspaceId ? (
            currentLayout ? (
              <>
                <WorkspaceGrid />
                {/* Render maximized cards outside the grid, at page level for fullscreen */}
                {currentLayout.cards
                  .filter((card) => card.isMaximized)
                  .map((card) => (
                    <Card key={card.id} card={card} />
                  ))}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading workspace...</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">No workspace selected</p>
                <button
                  onClick={async () => {
                    try {
                      const result = await createWorkspace.mutateAsync({
                        name: 'Default Workspace',
                        type: 'CUSTOM',
                      });
                      if (result?.workspace) {
                        await setCurrentWorkspace(result.workspace.id);
                      }
                    } catch (error) {
                      console.error('Failed to create workspace:', error);
                    }
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={createWorkspace.isPending}
                >
                  {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>

      {/* Modals */}
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
      <WithdrawModal open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen} />
      <PresetsDialog
        open={presetsDialogOpen}
        onOpenChange={setPresetsDialogOpen}
        buyPreset={presets.buyPreset}
        sellPreset={presets.sellPreset}
        slippagePreset={presets.slippagePreset}
        onSave={savePresets}
      />
    </main>
  );
}
