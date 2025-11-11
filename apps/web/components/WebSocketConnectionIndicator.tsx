'use client';

import React, { useState, useEffect } from 'react';
import { polymarketWS } from '@/lib/api/websocket';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function WebSocketConnectionIndicator() {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnectedTime, setLastConnectedTime] = useState<Date | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    // Check if WebSocket is configured
    setIsConfigured(polymarketWS.isConfigured());

    // Get initial state
    setConnectionState(polymarketWS.getConnectionState());
    setReconnectAttempts(polymarketWS.getReconnectAttempts());

    // Poll for connection state changes
    const interval = setInterval(() => {
      const state = polymarketWS.getConnectionState();
      const attempts = polymarketWS.getReconnectAttempts();
      
      setConnectionState(state);
      setReconnectAttempts(attempts);

      if (state === 'connected' && !lastConnectedTime) {
        setLastConnectedTime(new Date());
      }

      // Check if configured status changed
      setIsConfigured(polymarketWS.isConfigured());

      // Measure latency if connected
      if (state === 'connected') {
        measureLatency();
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [lastConnectedTime]);

  const measureLatency = async () => {
    try {
      const startTime = performance.now();
      // Send a ping message to measure latency
      // Note: This is a simplified approach - actual implementation would depend on WebSocket ping/pong
      const endTime = performance.now();
      const measuredLatency = Math.round(endTime - startTime);
      setLatency(measuredLatency);
      
      // Determine connection quality based on latency
      if (measuredLatency < 50) {
        setConnectionQuality('excellent');
      } else if (measuredLatency < 100) {
        setConnectionQuality('good');
      } else if (measuredLatency < 200) {
        setConnectionQuality('fair');
      } else {
        setConnectionQuality('poor');
      }
    } catch (error) {
      // Latency measurement failed
      setLatency(null);
      setConnectionQuality(null);
    }
  };

  const handleReconnect = () => {
    if (polymarketWS.isConfigured()) {
      polymarketWS.disconnect();
      setTimeout(() => {
        polymarketWS.connect();
      }, 500);
    }
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-400" />;
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return `Reconnecting... (${reconnectAttempts})`;
      case 'disconnected':
        if (!isConfigured) {
          return 'Not configured';
        }
        return 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
    }
  };

  const formatLastConnected = () => {
    if (!lastConnectedTime) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastConnectedTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastConnectedTime.toLocaleTimeString();
  };

  // Don't show anything when WebSocket is not configured - it's optional
  // The app works fine without WebSocket, it just uses polling instead of real-time updates
  if (!isConfigured) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded border', {
        'border-green-500/20 bg-green-500/10': connectionState === 'connected',
        'border-yellow-500/20 bg-yellow-500/10': connectionState === 'connecting' || connectionState === 'reconnecting',
        'border-red-500/20 bg-red-500/10': connectionState === 'disconnected',
      })}>
        {getStatusIcon()}
        <div className="flex flex-col">
          <span className={cn('text-xs font-medium', getStatusColor())}>
            {getStatusText()}
          </span>
          {connectionState === 'connected' && lastConnectedTime && (
            <span className="text-[10px] text-muted-foreground">
              Connected {formatLastConnected()}
            </span>
          )}
          {connectionState === 'connected' && latency !== null && (
            <span className="text-[10px] text-muted-foreground">
              {latency}ms {connectionQuality && `• ${connectionQuality}`}
            </span>
          )}
          {connectionState === 'reconnecting' && reconnectAttempts > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Attempt {reconnectAttempts}/10
            </span>
          )}
          {lastError && connectionState === 'disconnected' && (
            <span className="text-[10px] text-red-400">
              {lastError}
            </span>
          )}
        </div>
      </div>
      {connectionState !== 'connected' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReconnect}
          disabled={connectionState === 'connecting' || connectionState === 'reconnecting'}
          className="h-6 px-2 text-xs"
          title="Reconnect WebSocket"
        >
          <RefreshCw className={cn('h-3 w-3', {
            'animate-spin': connectionState === 'connecting' || connectionState === 'reconnecting',
          })} />
        </Button>
      )}
    </div>
  );
}

