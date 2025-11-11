'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  BookOpen, 
  TrendingUp, 
  ShoppingCart, 
  Wallet, 
  FileText,
  Search,
  Layers,
  Activity,
  Target,
  Calculator,
  MessageSquare,
  BookMarked,
  Newspaper,
  Zap,
  Settings,
  Keyboard,
  Command,
  AlertTriangle,
  Grid3x3,
  Link as LinkIcon,
  Palette,
  Star,
  Lock,
  Unlock,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Home
} from 'lucide-react';
import { cardCategories, getCardDescription } from '@/lib/card-categories';
import { cn } from '@/lib/utils';

export default function DocsPage() {
  const [tradingTab, setTradingTab] = useState('overview');
  const [workspaceTab, setWorkspaceTab] = useState('overview');
  const [activeSection, setActiveSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['trading-interface', 'custom-workspace']));
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Scroll spy for active section highlighting
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        'getting-started',
        'trading-interface',
        'custom-workspace',
        'keyboard-shortcuts',
        'command-palette',
        'web3-features',
        'alerts-automation',
        'settings'
      ];

      const scrollPosition = window.scrollY + 150; // Offset for header

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const element = sectionRefs.current[section];
        if (element) {
          const offsetTop = element.offsetTop;
          if (scrollPosition >= offsetTop) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      const offset = 100; // Account for any fixed headers
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setSidebarOpen(false); // Close mobile sidebar after navigation
    }
  };

  const tocItems = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      icon: BookOpen,
      children: []
    },
    {
      id: 'trading-interface',
      label: 'Trading Interface',
      icon: BarChart3,
      children: [
        { id: 'trading-overview', label: 'Overview' },
        { id: 'trading-market-selection', label: 'Market Selection' },
        { id: 'trading-chart', label: 'Chart' },
        { id: 'trading-orderbook', label: 'Orderbook' },
        { id: 'trading-order-forms', label: 'Order Forms' },
        { id: 'trading-positions', label: 'Positions' },
        { id: 'trading-market-info', label: 'Market Info' }
      ]
    },
    {
      id: 'custom-workspace',
      label: 'Custom Workspace',
      icon: Grid3x3,
      children: [
        { id: 'workspace-overview', label: 'Overview' },
        { id: 'workspace-trading-cards', label: 'Trading Cards' },
        { id: 'workspace-analysis-cards', label: 'Analysis Cards' },
        { id: 'workspace-research-cards', label: 'Research Cards' },
        { id: 'workspace-risk-cards', label: 'Risk Management' },
        { id: 'workspace-utilities-cards', label: 'Utilities' }
      ]
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      icon: Keyboard,
      children: []
    },
    {
      id: 'command-palette',
      label: 'Command Palette',
      icon: Command,
      children: []
    },
    {
      id: 'web3-features',
      label: 'Web3 Features',
      icon: Wallet,
      children: []
    },
    {
      id: 'alerts-automation',
      label: 'Alerts & Automation',
      icon: AlertTriangle,
      children: []
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      children: []
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-card border border-border rounded-lg text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar Table of Contents */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 h-screen w-64 lg:w-72 bg-card border-r border-border overflow-y-auto z-40 transition-transform duration-300 flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="p-6 flex-1 overflow-y-auto">
            {/* Logo */}
            <div className="mb-6 pt-12 lg:pt-6">
              <Link href="/" className="block">
                <img 
                  src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreicizxxhlc64ifefhkv52bjbjjwgeuyt6qvrqlpg6f3gzofeayah6q"
                  alt="Alithos Terminal"
                  className="h-9 sm:h-12 w-auto select-none"
                  style={{ objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' } as React.CSSProperties}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
              </Link>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Table of Contents</h2>
            </div>
            <nav className="space-y-1">
              {tocItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const isExpanded = expandedSections.has(item.id);
                const hasChildren = item.children.length > 0;

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          toggleSection(item.id);
                        }
                        scrollToSection(item.id);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left",
                        isActive
                          ? "bg-primary/10 text-foreground border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {hasChildren && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )
                      )}
                    </button>
                    {hasChildren && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              // Map child IDs to tab values
                              if (item.id === 'trading-interface') {
                                const tabMap: { [key: string]: string } = {
                                  'trading-overview': 'overview',
                                  'trading-market-selection': 'market-selection',
                                  'trading-chart': 'chart',
                                  'trading-orderbook': 'orderbook',
                                  'trading-order-forms': 'order-forms',
                                  'trading-positions': 'positions',
                                  'trading-market-info': 'market-info'
                                };
                                setTradingTab(tabMap[child.id] || 'overview');
                              } else if (item.id === 'custom-workspace') {
                                const tabMap: { [key: string]: string } = {
                                  'workspace-overview': 'overview',
                                  'workspace-trading-cards': 'trading-cards',
                                  'workspace-analysis-cards': 'analysis-cards',
                                  'workspace-research-cards': 'research-cards',
                                  'workspace-risk-cards': 'risk-cards',
                                  'workspace-utilities-cards': 'utilities-cards'
                                };
                                setWorkspaceTab(tabMap[child.id] || 'overview');
                              }
                              scrollToSection(item.id);
                            }}
                            className={cn(
                              "w-full px-3 py-1.5 text-xs rounded-md transition-colors text-left",
                              "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                            )}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
          
          {/* Home Button - Bottom */}
          <div className="p-6 border-t border-border">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            {/* Header */}
            <div className="mb-8 sm:mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
                Documentation
              </h1>
              <p className="text-lg text-muted-foreground max-w-3xl">
                Comprehensive guide to all features in Alithos Terminal. Learn how to use the trading interface, 
                customize your workspace, and leverage advanced tools for prediction market trading.
              </p>
            </div>

            {/* Getting Started */}
            <section 
              id="getting-started" 
              ref={(el) => { sectionRefs.current['getting-started'] = el; }}
              className="mb-12 scroll-mt-24"
            >
              <h2 className="text-3xl font-bold mb-6 text-foreground">Getting Started</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-muted-foreground mb-4">
              Alithos Terminal provides two main workspace types: the <strong>Trading Interface</strong> for focused execution 
              and the <strong>Custom Workspace</strong> for modular analysis. When you first log in, you'll automatically 
              get a Trading workspace and a Custom workspace with a starter template.
            </p>
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-3 text-foreground">Quick Start Steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Connect your wallet using Privy authentication (wallet or email)</li>
                <li>Deposit USDC to your account for trading</li>
                <li>Approve USDC spending for Polymarket contracts</li>
                <li>Select a market from the Trading Interface or Market Discovery card</li>
                <li>Place your first trade using the order forms</li>
                <li>Customize your workspace by adding cards and arranging layouts</li>
              </ol>
            </div>
          </div>
        </section>

            {/* Trading Interface */}
            <section 
              id="trading-interface" 
              ref={(el) => { sectionRefs.current['trading-interface'] = el; }}
              className="mb-12 scroll-mt-24"
            >
              <h2 className="text-3xl font-bold mb-6 text-foreground">Trading Interface</h2>
              <p className="text-muted-foreground mb-6">
                The Trading Interface provides a fixed, optimized layout for active trading with real-time market data, 
                order entry, and position management. It features a three-column design with chart, orderbook, and order forms.
              </p>

              <Tabs value={tradingTab} onValueChange={setTradingTab} className="w-full">
                <TabsList className="flex w-full border-b border-border bg-transparent p-0 mb-6 overflow-x-auto">
                  <TabsTrigger 
                    value="overview"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="market-selection"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Market Selection
                  </TabsTrigger>
                  <TabsTrigger 
                    value="chart"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Chart
                  </TabsTrigger>
                  <TabsTrigger 
                    value="orderbook"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Orderbook
                  </TabsTrigger>
                  <TabsTrigger 
                    value="order-forms"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Order Forms
                  </TabsTrigger>
                  <TabsTrigger 
                    value="positions"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Positions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="market-info"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Market Info
                  </TabsTrigger>
                </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Layout Overview
                </h3>
                <p className="text-muted-foreground mb-4">
                  The Trading Interface uses a fixed three-column layout optimized for rapid decision-making:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-foreground min-w-[120px]">Left Column (60-70%):</span>
                    <span>Real-time price chart with TradingView integration, time range selection (1H, 6H, 1D, 1W, 1M, ALL), 
                    and outcome filtering (YES, NO, or both).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-foreground min-w-[120px]">Middle Column (20-25%):</span>
                    <span>Order book visualization with bid/ask levels, depth charts, and real-time trade feed with wallet tags.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-foreground min-w-[120px]">Right Column (20-25%):</span>
                    <span>Order entry forms with market orders, limit orders, and advanced options including take profit and stop loss.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-semibold text-foreground min-w-[120px]">Bottom Panel:</span>
                    <span>Positions management, open orders, order history, and trade history with real-time P&L tracking.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Key Features
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Real-time price updates via WebSocket connection</li>
                  <li>• Probability-native order entry with impact estimation</li>
                  <li>• Slippage protection and gas optimization settings</li>
                  <li>• USDC approval flow with allowance management</li>
                  <li>• Transaction confirmation and status tracking</li>
                  <li>• Market selector with search, filters, and sorting</li>
                  <li>• 24-hour change and volume metrics in header</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="market-selection" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Market Selector
                </h3>
                <p className="text-muted-foreground mb-4">
                  The market selector appears at the top of the Trading Interface, allowing you to search, filter, and select markets.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Search & Filter</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Search by market question, slug, or market ID</li>
                      <li>• Filter by category (Crypto, Sports, Politics, Tech, etc.)</li>
                      <li>• Sort by 24hr Volume, Liquidity, New, or Ending Soon</li>
                      <li>• View watchlist markets separately</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Market Display</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Shows current YES/NO prices and probabilities</li>
                      <li>• Displays 24-hour volume and price change</li>
                      <li>• Market images and event grouping</li>
                      <li>• Quick actions: add to watchlist, create cards</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chart" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Trading Chart
                </h3>
                <p className="text-muted-foreground mb-4">
                  The chart displays real-time price movements with historical data visualization using TradingView's lightweight charts.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Time Range Selection</h4>
                    <p className="text-muted-foreground text-sm mb-2">
                      Select from predefined time ranges: 1H, 6H, 1D, 1W, 1M, or ALL (full history).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Outcome Filtering</h4>
                    <p className="text-muted-foreground text-sm mb-2">
                      View YES, NO, or both outcomes simultaneously. The chart automatically selects the winning outcome 
                      (higher price) when a market is first loaded.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Real-time Updates</h4>
                    <p className="text-muted-foreground text-sm mb-2">
                      Chart updates in real-time via WebSocket connection, showing the latest price movements as they occur.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Chart Features</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Candlestick and line chart options</li>
                      <li>• Zoom and pan functionality</li>
                      <li>• Price tooltips on hover</li>
                      <li>• Volume indicators</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orderbook" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Order Book & Trades
                </h3>
                <p className="text-muted-foreground mb-4">
                  The orderbook panel shows current bid/ask levels and recent trades for the selected market and outcome.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Order Book Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Bid and ask levels with price, size, and dollar amounts</li>
                      <li>• Depth visualization showing market liquidity</li>
                      <li>• Real-time updates as orders are placed and filled</li>
                      <li>• Outcome selection (YES or NO)</li>
                      <li>• Requires CLOB API authentication for full data</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Trades Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Recent trades with price, amount, and timestamp</li>
                      <li>• Wallet tags for known traders</li>
                      <li>• Color-coded buy/sell indicators</li>
                      <li>• Real-time trade feed updates</li>
                      <li>• Transaction hash links for on-chain verification</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="order-forms" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Order Entry System
                </h3>
                <p className="text-muted-foreground mb-4">
                  The order forms provide probability-native order entry with advanced features for risk management and execution control.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Market Orders</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Instant execution at current market price</li>
                      <li>• Probability or dollar amount input</li>
                      <li>• Impact estimator shows expected price movement</li>
                      <li>• Slippage protection with configurable tolerance</li>
                      <li>• Real-time balance and position checks</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Limit Orders</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Set target price for execution</li>
                      <li>• Order remains open until filled or cancelled</li>
                      <li>• View open limit orders in positions panel</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Advanced Options</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Take Profit: Automatically sell when target price reached</li>
                      <li>• Stop Loss: Automatically sell to limit losses</li>
                      <li>• Gas settings: Choose between slow, standard, or fast execution</li>
                      <li>• Slippage tolerance: Set maximum acceptable price deviation</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">USDC Management</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• USDC balance display and allowance management</li>
                      <li>• One-click approval for Polymarket contracts</li>
                      <li>• Transaction confirmation modal with full details</li>
                      <li>• Real-time transaction status tracking</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="positions" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Positions & History
                </h3>
                <p className="text-muted-foreground mb-4">
                  The bottom panel provides comprehensive position management and trading history.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Positions Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Real-time P&L calculation (unrealized and realized)</li>
                      <li>• Position details: market, outcome, amount, entry price</li>
                      <li>• Current value and cost basis</li>
                      <li>• Close position or partial close functionality</li>
                      <li>• Total portfolio P&L summary</li>
                      <li>• Sorted by P&L for quick identification of winners/losers</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Open Orders Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• View all open limit orders</li>
                      <li>• Order status tracking (pending, open, filled, cancelled)</li>
                      <li>• Cancel orders directly from the panel</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Order History Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Complete history of all orders</li>
                      <li>• Filter by status and date range</li>
                      <li>• Order details and execution information</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Trade History Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• On-chain transaction history</li>
                      <li>• Transaction hashes for blockchain verification</li>
                      <li>• Buy and sell transactions with amounts and prices</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="market-info" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Market Information Panel
                </h3>
                <p className="text-muted-foreground mb-4">
                  The market information panel provides comprehensive details about the selected market, including 
                  resolution criteria, related news, and community comments.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Resolution Criteria Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Detailed resolution criteria and conditions</li>
                      <li>• Risk scoring for resolution clarity</li>
                      <li>• Market end date and resolution timeline</li>
                      <li>• Outcome definitions and conditions</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">News Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Adjacent news detection for related events</li>
                      <li>• News articles from the past 7 days</li>
                      <li>• External article links</li>
                      <li>• News relevance scoring</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Comments Tab</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Community discussions about the market</li>
                      <li>• User profiles and reactions</li>
                      <li>• Post and reply to comments</li>
                      <li>• Real-time comment updates</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
              </Tabs>
            </section>

            {/* Custom Workspace */}
            <section 
              id="custom-workspace" 
              ref={(el) => { sectionRefs.current['custom-workspace'] = el; }}
              className="mb-12 scroll-mt-24"
            >
              <h2 className="text-3xl font-bold mb-6 text-foreground">Custom Workspace</h2>
              <p className="text-muted-foreground mb-6">
                Custom Workspaces provide a modular grid layout where you can add, arrange, and link cards to create 
                personalized trading and analysis environments. Workspaces support drag-and-drop layout management, 
                templates, and card linking for synchronized market selection.
              </p>

              <Tabs value={workspaceTab} onValueChange={setWorkspaceTab} className="w-full">
                <TabsList className="flex w-full border-b border-border bg-transparent p-0 mb-6 overflow-x-auto">
                  <TabsTrigger 
                    value="overview"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="trading-cards"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Trading
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analysis-cards"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Analysis
                  </TabsTrigger>
                  <TabsTrigger 
                    value="research-cards"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Research
                  </TabsTrigger>
                  <TabsTrigger 
                    value="risk-cards"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Risk Mgmt
                  </TabsTrigger>
                  <TabsTrigger 
                    value="utilities-cards"
                    className="px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
                  >
                    Utilities
                  </TabsTrigger>
                </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Workspace System
                </h3>
                <p className="text-muted-foreground mb-4">
                  Custom Workspaces use a responsive grid layout system powered by React Grid Layout, allowing you to 
                  create unlimited personalized trading environments.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Workspace Types</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• <strong>SCALPING:</strong> Optimized for fast trading with watchlist, tape, order book, and quick ticket</li>
                      <li>• <strong>EVENT_DAY:</strong> Perfect for event-driven trading with market discovery, news, and research</li>
                      <li>• <strong>ARB_DESK:</strong> Designed for arbitrage with correlation matrix, exposure tree, and activity scanner</li>
                      <li>• <strong>RESEARCH:</strong> Focused on market research with discovery, info, research, news, and journal</li>
                      <li>• <strong>CUSTOM:</strong> Fully customizable workspace with any card combination</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Layout Management</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Drag and drop cards to reposition</li>
                      <li>• Resize cards by dragging corners</li>
                      <li>• Minimize cards to save space</li>
                      <li>• Maximize cards for full-screen view</li>
                      <li>• Save layouts automatically or manually</li>
                      <li>• Lock workspaces to prevent accidental changes</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Card Linking</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Link cards to synchronize market selection</li>
                      <li>• Select a market in one card to update all linked cards</li>
                      <li>• Visual indicators show linked cards</li>
                      <li>• Manage links via the link selection toolbar</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Templates</h4>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      <li>• Start with pre-built templates for common use cases</li>
                      <li>• Save your own workspace as a template</li>
                      <li>• Share templates with your team</li>
                      <li>• Default templates available for each workspace type</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trading-cards" className="space-y-6">
              <div className="space-y-4">
                {cardCategories.Trading.map((card) => (
                  <div key={card.type} className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{card.label}</h3>
                    <p className="text-muted-foreground mb-3">{getCardDescription(card.type)}</p>
                    {card.type === 'watchlist' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Virtualized list for performance with large watchlists</li>
                        <li>• Add/remove markets with one click</li>
                        <li>• Real-time price updates</li>
                        <li>• Event grouping for related markets</li>
                      </ul>
                    )}
                    {card.type === 'tape' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Real-time trade feed with wallet tags</li>
                        <li>• Filter by outcome (YES/NO)</li>
                        <li>• Color-coded buy/sell indicators</li>
                        <li>• Transaction hash links</li>
                      </ul>
                    )}
                    {card.type === 'quick-ticket' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Probability-native order entry</li>
                        <li>• Impact estimator for price movement</li>
                        <li>• Web3 trading execution</li>
                        <li>• Slippage and gas settings</li>
                      </ul>
                    )}
                    {card.type === 'order-creator' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Create and manage trading orders</li>
                        <li>• Market and limit order support</li>
                        <li>• Order modification and cancellation</li>
                      </ul>
                    )}
                    {card.type === 'orderbook' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Full order book visualization</li>
                        <li>• Bid/ask levels with depth</li>
                        <li>• Real-time updates</li>
                      </ul>
                    )}
                    {card.type === 'market-trade' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Trade a specific market</li>
                        <li>• Integrated order entry</li>
                        <li>• Market-specific trading interface</li>
                      </ul>
                    )}
                    {card.type === 'positions' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• View all positions with real-time P&L</li>
                        <li>• Filter by market or outcome</li>
                        <li>• Close positions directly</li>
                      </ul>
                    )}
                    {card.type === 'order-history' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Complete order history</li>
                        <li>• Filter by status and date</li>
                        <li>• Order details and execution info</li>
                      </ul>
                    )}
                    {card.type === 'transaction-history' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• On-chain transaction history</li>
                        <li>• Transaction hashes and details</li>
                        <li>• Filter by type and date</li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analysis-cards" className="space-y-6">
              <div className="space-y-4">
                {cardCategories.Analysis.map((card) => (
                  <div key={card.type} className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{card.label}</h3>
                    <p className="text-muted-foreground mb-3">{getCardDescription(card.type)}</p>
                    {card.type === 'chart' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Real-time probability charts with Recharts</li>
                        <li>• Time range selection</li>
                        <li>• Outcome filtering (YES/NO/both)</li>
                        <li>• Historical price data</li>
                      </ul>
                    )}
                    {card.type === 'tradingview-chart' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Advanced TradingView chart integration</li>
                        <li>• Professional technical analysis tools</li>
                        <li>• Multiple chart types and indicators</li>
                        <li>• Full TradingView feature set</li>
                      </ul>
                    )}
                    {card.type === 'depth' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Market depth visualization with Recharts</li>
                        <li>• Order book depth analysis</li>
                        <li>• Impact estimation</li>
                        <li>• Liquidity indicators</li>
                      </ul>
                    )}
                    {card.type === 'correlation-matrix' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Identify correlated markets for spread trading</li>
                        <li>• Correlation heatmap visualization</li>
                        <li>• Price correlation analysis</li>
                        <li>• Arbitrage opportunity detection</li>
                      </ul>
                    )}
                    {card.type === 'exposure-tree' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Event-level exposure roll-up</li>
                        <li>• Min/max P&L calculation</li>
                        <li>• Position aggregation by event</li>
                        <li>• Risk visualization</li>
                      </ul>
                    )}
                    {card.type === 'activity-scanner' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Unusual activity detection</li>
                        <li>• Volume spike identification</li>
                        <li>• Flow imbalance alerts</li>
                        <li>• Market opportunity scanning</li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="research-cards" className="space-y-6">
              <div className="space-y-4">
                {cardCategories.Research.map((card) => (
                  <div key={card.type} className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{card.label}</h3>
                    <p className="text-muted-foreground mb-3">{getCardDescription(card.type)}</p>
                    {card.type === 'market-discovery' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Discover and explore markets</li>
                        <li>• Search and filter by category</li>
                        <li>• Sort by volume, liquidity, or ending date</li>
                        <li>• Quick actions: add to watchlist, create cards</li>
                      </ul>
                    )}
                    {card.type === 'market-info' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Detailed market information</li>
                        <li>• Market statistics and metrics</li>
                        <li>• Event details and context</li>
                        <li>• Resolution information</li>
                      </ul>
                    )}
                    {card.type === 'market-research' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• AI-powered market research and analysis</li>
                        <li>• Multi-agent analysis with Grok (xAI) and OpenAI</li>
                        <li>• Research history and saved reports</li>
                        <li>• Comprehensive market insights</li>
                      </ul>
                    )}
                    {card.type === 'news' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• News and updates related to markets</li>
                        <li>• Adjacent news detection for related events</li>
                        <li>• News filtering and search</li>
                        <li>• External article links</li>
                      </ul>
                    )}
                    {card.type === 'resolution-criteria' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Market resolution intelligence</li>
                        <li>• Risk scoring for resolution clarity</li>
                        <li>• Resolution criteria details</li>
                        <li>• Resolution probability assessment</li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="risk-cards" className="space-y-6">
              <div className="space-y-4">
                {cardCategories['Risk Management'].map((card) => (
                  <div key={card.type} className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{card.label}</h3>
                    <p className="text-muted-foreground mb-3">{getCardDescription(card.type)}</p>
                    {card.type === 'kelly-calculator' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Kelly Criterion position sizing calculator</li>
                        <li>• Optimal bet size calculation</li>
                        <li>• Risk-adjusted position sizing</li>
                        <li>• Probability and edge inputs</li>
                      </ul>
                    )}
                    {card.type === 'position-sizing' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Calculate optimal position sizes</li>
                        <li>• Risk-based position sizing</li>
                        <li>• Portfolio allocation tools</li>
                        <li>• Multiple sizing strategies</li>
                      </ul>
                    )}
                    {card.type === 'scenario-builder' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Build and analyze trading scenarios</li>
                        <li>• Multi-market probability sliders</li>
                        <li>• P&L calculation for scenarios</li>
                        <li>• What-if analysis tools</li>
                      </ul>
                    )}
                    {card.type === 'price-converter' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Convert between price formats</li>
                        <li>• Probability to price conversion</li>
                        <li>• Odds and decimal conversions</li>
                        <li>• Quick price calculations</li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="utilities-cards" className="space-y-6">
              <div className="space-y-4">
                {cardCategories.Utilities.map((card) => (
                  <div key={card.type} className="bg-card border border-border rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{card.label}</h3>
                    <p className="text-muted-foreground mb-3">{getCardDescription(card.type)}</p>
                    {card.type === 'journal' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Trading journal and notes</li>
                        <li>• Market-specific journal entries</li>
                        <li>• Trade analysis and notes</li>
                        <li>• Performance tracking</li>
                      </ul>
                    )}
                    {card.type === 'comments' && (
                      <ul className="space-y-1 text-muted-foreground text-sm">
                        <li>• Comments and discussions about markets</li>
                        <li>• Market-specific comment threads</li>
                        <li>• User profiles and reactions</li>
                        <li>• Community engagement</li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
              </Tabs>
            </section>

            {/* Keyboard Shortcuts */}
            <section 
              id="keyboard-shortcuts" 
              ref={(el) => { sectionRefs.current['keyboard-shortcuts'] = el; }}
              className="mb-12 scroll-mt-24"
            >
          <h2 className="text-3xl font-bold mb-6 text-foreground">
            Keyboard Shortcuts
          </h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground mb-6">
              Alithos Terminal supports keyboard shortcuts for quick navigation and actions. Most shortcuts work globally 
              throughout the application.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">General</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Open Command Palette</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-black">⌘K</kbd>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Close Command Palette</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-black">ESC</kbd>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-3">Workspace</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">New Workspace</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-black">⌘N</kbd>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Save Layout</span>
                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-black">⌘S</kbd>
                  </li>
                </ul>
              </div>
            </div>
          </div>
            </section>

            {/* Command Palette */}
            <section 
              id="command-palette" 
              ref={(el) => { sectionRefs.current['command-palette'] = el; }}
              className="mb-12 scroll-mt-24"
            >
          <h2 className="text-3xl font-bold mb-6 text-foreground">
            Command Palette
          </h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground mb-4">
              The Command Palette (⌘K) provides quick access to all major actions and features. Search by command name, 
              description, or keywords to find what you need.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Usage</h3>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• Press ⌘K (or Ctrl+K on Windows/Linux) to open</li>
                  <li>• Type to search commands</li>
                  <li>• Use arrow keys to navigate</li>
                  <li>• Press Enter to execute</li>
                  <li>• Press ESC to close</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Command Categories</h3>
                <ul className="space-y-1 text-muted-foreground text-sm">
                  <li>• <strong>Workspace:</strong> Create, save, and manage workspaces</li>
                  <li>• <strong>General:</strong> Common actions and navigation</li>
                  <li>• Commands are organized by category for easy discovery</li>
                </ul>
              </div>
            </div>
          </div>
            </section>

            {/* Web3 Features */}
            <section 
              id="web3-features" 
              ref={(el) => { sectionRefs.current['web3-features'] = el; }}
              className="mb-12 scroll-mt-24"
            >
          <h2 className="text-3xl font-bold mb-6 text-foreground">
            Web3 Features
          </h2>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Wallet Connection</h3>
              <p className="text-muted-foreground mb-4">
                Alithos Terminal uses Privy for authentication, supporting both wallet-based and email/password login.
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• Connect via MetaMask, WalletConnect, or other supported wallets</li>
                <li>• Email/password authentication as alternative</li>
                <li>• Automatic wallet connection on login</li>
                <li>• Multi-wallet support</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">USDC Management</h3>
              <p className="text-muted-foreground mb-4">
                Manage your USDC balance for trading on Polymarket.
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• <strong>Deposit:</strong> Send USDC to your trading wallet</li>
                <li>• <strong>Withdraw:</strong> Transfer USDC out of your trading wallet</li>
                <li>• <strong>Balance Display:</strong> Real-time USDC balance in header</li>
                <li>• <strong>Allowance Management:</strong> Approve USDC spending for Polymarket contracts</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Transaction Management</h3>
              <p className="text-muted-foreground mb-4">
                Full transaction lifecycle management with confirmation and status tracking.
              </p>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• Transaction confirmation modal with full details</li>
                <li>• Gas estimation and optimization</li>
                <li>• Real-time transaction status tracking</li>
                <li>• Transaction history with on-chain verification</li>
                <li>• Error handling and retry options</li>
              </ul>
            </div>
          </div>
            </section>

            {/* Alerts & Automation */}
            <section 
              id="alerts-automation" 
              ref={(el) => { sectionRefs.current['alerts-automation'] = el; }}
              className="mb-12 scroll-mt-24"
            >
          <h2 className="text-3xl font-bold mb-6 text-foreground">
            Alerts & Automation
          </h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground mb-6">
              The alert system allows you to set up automated notifications and actions based on market conditions.
            </p>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Alert Conditions</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• <strong>Price:</strong> Alert when price crosses threshold (gt, lt, gte, lte, eq)</li>
                  <li>• <strong>Volume:</strong> Alert on volume spikes or unusual activity</li>
                  <li>• <strong>Depth:</strong> Alert when order book depth changes</li>
                  <li>• <strong>Flow:</strong> Alert on buy/sell flow imbalances</li>
                  <li>• <strong>Spread:</strong> Alert when bid-ask spread widens or narrows</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Alert Actions</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• <strong>Notify:</strong> Browser notifications, email, or Telegram</li>
                  <li>• <strong>Order:</strong> Automatically place buy/sell orders</li>
                  <li>• <strong>Webhook:</strong> Send HTTP POST to custom endpoint</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Alert Features</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>• Multi-signal alerts (combine multiple conditions)</li>
                  <li>• Cooldown periods to prevent alert spam</li>
                  <li>• Market-specific or global alerts</li>
                  <li>• Real-time monitoring every 5 seconds</li>
                  <li>• Alert history and status tracking</li>
                </ul>
              </div>
            </div>
          </div>
            </section>

            {/* Settings */}
            <section 
              id="settings" 
              ref={(el) => { sectionRefs.current['settings'] = el; }}
              className="mb-12 scroll-mt-24"
            >
          <h2 className="text-3xl font-bold mb-6 text-foreground">
            Settings
          </h2>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Trading Settings</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• <strong>Slippage Tolerance:</strong> Set maximum acceptable price deviation (default: 1%)</li>
                <li>• <strong>Gas Priority:</strong> Choose between slow, standard, or fast execution</li>
                <li>• <strong>Buy/Sell Presets:</strong> Save common order amounts for quick access</li>
                <li>• <strong>Default Outcomes:</strong> Set preferred YES/NO selection</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">Notification Preferences</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• <strong>Browser Notifications:</strong> Enable/disable desktop notifications</li>
                <li>• <strong>Email Notifications:</strong> Configure email alerts</li>
                <li>• <strong>Telegram Notifications:</strong> Set up Telegram bot integration</li>
                <li>• <strong>Webhook URLs:</strong> Configure custom webhook endpoints</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">User Preferences</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li>• <strong>Profile:</strong> Manage user profile and display settings</li>
                <li>• <strong>Theme:</strong> Customize workspace themes (import/export JSON)</li>
                <li>• <strong>Workspace Defaults:</strong> Set default workspace type and templates</li>
                <li>• <strong>Card Favorites:</strong> Mark frequently used cards as favorites</li>
              </ul>
            </div>
          </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

