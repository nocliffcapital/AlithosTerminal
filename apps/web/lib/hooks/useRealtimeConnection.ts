// Hook to initialize and manage Polymarket Real-Time Data Client connection
// This provides real-time updates for comments, orders, trades, and market data

import { useEffect, useState } from 'react';
import { realtimeClient } from '@/lib/api/realtime-client';
import { ConnectionStatus } from '@polymarket/real-time-data-client';

/**
 * Hook to establish real-time data client connection
 * Automatically connects when component mounts
 */
export function useRealtimeConnection() {
  useEffect(() => {
    // Add a small delay to ensure the page is fully loaded before connecting
    // This can help avoid connection issues in some browsers
    const connectTimeout = setTimeout(() => {
      // Connect to real-time data stream only once
      // Check if already connecting or connected to avoid multiple connection attempts
      const status = realtimeClient.getStatus();
      console.log('[useRealtimeConnection] 🔌 Initializing real-time connection, current status:', status);
      
      if (status === ConnectionStatus.DISCONNECTED) {
        realtimeClient.connect();
      } else {
        console.log('[useRealtimeConnection] ⏭️  Already connected or connecting');
      }
    }, 1000); // 1 second delay

    // Cleanup timeout on unmount
    return () => {
      clearTimeout(connectTimeout);
      // Don't disconnect on unmount - keep connection alive for other components
    };
  }, []);

  const connectionStatus = realtimeClient.getStatus();
  const isConnected = realtimeClient.isConnected();
  
  return {
    isConnected,
    status: connectionStatus,
  };
}

/**
 * Hook to subscribe to connection status changes
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(realtimeClient.getStatus());

  useEffect(() => {
    const unsubscribe = realtimeClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return status;
}

