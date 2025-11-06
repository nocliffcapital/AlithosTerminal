'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Github } from 'lucide-react';
import Link from 'next/link';
import { XLogo } from './XLogo';

export function Footer() {
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    // Check API status on mount
    checkApiStatus();

    // Check every 30 seconds
    const interval = setInterval(checkApiStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkApiStatus = async () => {
    try {
      // Check Polymarket API status using The Graph subgraph (no CORS issues)
      // Using the main Polymarket subgraph which is publicly accessible
      const SUBGRAPH_API_KEY = process.env.NEXT_PUBLIC_POLYMARKET_SUBGRAPH_API_KEY;
      const SUBGRAPH_ID_MAIN = '81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC'; // Main Polymarket subgraph
      
      let subgraphUrl: string;
      if (SUBGRAPH_API_KEY) {
        // Use The Graph Gateway if API key is available
        subgraphUrl = `https://gateway.thegraph.com/api/${SUBGRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID_MAIN}`;
      } else {
        // Use public endpoint (may have rate limits but works without API key)
        subgraphUrl = `https://api.studio.thegraph.com/query/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC/polymarket/version/latest`;
      }
      
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query { _meta { block { number } } }`,
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check if response is valid (no errors)
        if (data && !data.errors && data.data) {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      } else {
        setApiStatus('offline');
      }
    } catch (error) {
      // If we can't reach the Polymarket API or it times out, mark as offline
      setApiStatus('offline');
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 border-t border-border bg-background/95 backdrop-blur-sm z-40 flex items-center justify-between px-4">
      {/* Left: API Status */}
      <div className="flex items-center gap-2">
        {apiStatus === 'online' ? (
          <>
            <div className="relative">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <div className="absolute inset-0 animate-ping">
                <CheckCircle2 className="h-4 w-4 text-status-success opacity-75" />
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-medium">API Live</span>
          </>
        ) : apiStatus === 'offline' ? (
          <>
            <div className="relative">
              <AlertCircle className="h-4 w-4 text-status-warning animate-pulse" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">API Offline</span>
          </>
        ) : (
          <>
            <div className="relative">
              <AlertCircle className="h-4 w-4 text-muted-foreground animate-pulse" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Checking...</span>
          </>
        )}
      </div>

      {/* Middle: Logo */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <img 
          src="https://turquoise-keen-koi-739.mypinata.cloud/ipfs/bafkreicizxxhlc64ifefhkv52bjbjjwgeuyt6qvrqlpg6f3gzofeayah6q"
          alt="Alithos Terminal"
          className="h-4 sm:h-5 w-auto select-none"
          style={{ objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', WebkitUserDrag: 'none', userDrag: 'none', pointerEvents: 'auto' }}
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>

      {/* Right: Social Links */}
      <div className="flex items-center gap-3">
        <Link
          href="https://x.com/alithosterminal"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Follow us on X"
        >
          <XLogo className="h-4 w-4" />
        </Link>
        <Link
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="View on GitHub"
        >
          <Github className="h-4 w-4" />
        </Link>
      </div>
    </footer>
  );
}

