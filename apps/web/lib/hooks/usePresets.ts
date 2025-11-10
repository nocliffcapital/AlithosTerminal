'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const DEFAULT_BUY_PRESET = 10;
const DEFAULT_SELL_PRESET = 25;
const DEFAULT_SLIPPAGE_PRESET = 1.0;

const PRESETS_STORAGE_KEY = 'trading-presets';
const PRESETS_CHANGE_EVENT = 'presets-changed';

interface Presets {
  buyPreset: number;
  sellPreset: number;
  slippagePreset: number;
}

// Helper function to load presets from localStorage
const loadPresetsFromStorage = (): Presets => {
  if (typeof window === 'undefined') {
    return {
      buyPreset: DEFAULT_BUY_PRESET,
      sellPreset: DEFAULT_SELL_PRESET,
      slippagePreset: DEFAULT_SLIPPAGE_PRESET,
    };
  }
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle migration from old array format to new single value format
      if (Array.isArray(parsed.buyPresets)) {
        // Old format - use first value
        return {
          buyPreset: parsed.buyPresets[0] || DEFAULT_BUY_PRESET,
          sellPreset: parsed.sellPresets[0] || DEFAULT_SELL_PRESET,
          slippagePreset: parsed.slippagePreset || DEFAULT_SLIPPAGE_PRESET,
        };
      }
      // New format
      return {
        buyPreset: parsed.buyPreset || DEFAULT_BUY_PRESET,
        sellPreset: parsed.sellPreset || DEFAULT_SELL_PRESET,
        slippagePreset: parsed.slippagePreset || DEFAULT_SLIPPAGE_PRESET,
      };
    }
  } catch (error) {
    console.error('Failed to load presets:', error);
  }
  return {
    buyPreset: DEFAULT_BUY_PRESET,
    sellPreset: DEFAULT_SELL_PRESET,
    slippagePreset: DEFAULT_SLIPPAGE_PRESET,
  };
};

export function usePresets() {
  const { dbUser } = useAuth();
  const [presets, setPresets] = useState<Presets>({
    buyPreset: DEFAULT_BUY_PRESET,
    sellPreset: DEFAULT_SELL_PRESET,
    slippagePreset: DEFAULT_SLIPPAGE_PRESET,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load presets from localStorage on mount and when they change
  useEffect(() => {
    // Load initial presets
    const loadedPresets = loadPresetsFromStorage();
    console.log('[usePresets] Initial load from localStorage:', loadedPresets);
    setPresets(loadedPresets);
    setIsLoading(false);

    // Listen for preset changes from other components
    const handlePresetsChange = () => {
      console.log('[usePresets] Presets changed event received, reloading from localStorage');
      const updatedPresets = loadPresetsFromStorage();
      console.log('[usePresets] Reloaded presets:', updatedPresets);
      setPresets(updatedPresets);
    };

    // Listen for custom event when presets are saved
    window.addEventListener(PRESETS_CHANGE_EVENT, handlePresetsChange);
    console.log('[usePresets] Added event listener for', PRESETS_CHANGE_EVENT);
    
    // Also listen for storage events (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PRESETS_STORAGE_KEY) {
        console.log('[usePresets] Storage event received, reloading presets');
        handlePresetsChange();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(PRESETS_CHANGE_EVENT, handlePresetsChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const savePresets = (buyPreset: number, sellPreset: number, slippagePreset: number) => {
    const newPresets = { buyPreset, sellPreset, slippagePreset };
    console.log('[usePresets] Saving presets to localStorage:', newPresets);
    
    // Update state immediately
    setPresets(newPresets);
    
    try {
      const serialized = JSON.stringify(newPresets);
      localStorage.setItem(PRESETS_STORAGE_KEY, serialized);
      console.log('[usePresets] Saved to localStorage:', serialized);
      
      // Verify it was saved
      const verify = localStorage.getItem(PRESETS_STORAGE_KEY);
      console.log('[usePresets] Verified localStorage:', verify);
      
      // Parse and verify the data
      if (verify) {
        const parsed = JSON.parse(verify);
        console.log('[usePresets] Parsed from localStorage:', parsed);
        console.log('[usePresets] Buy preset matches:', parsed.buyPreset === buyPreset);
        console.log('[usePresets] Sell preset matches:', parsed.sellPreset === sellPreset);
        console.log('[usePresets] Slippage preset matches:', parsed.slippagePreset === slippagePreset);
      }
      
      // Dispatch custom event to notify other components
      // Use setTimeout to ensure state update happens first
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(PRESETS_CHANGE_EVENT));
        console.log('[usePresets] Dispatched presets-changed event');
      }, 0);
    } catch (error) {
      console.error('[usePresets] Failed to save presets:', error);
    }
  };

  return {
    presets,
    isLoading,
    savePresets,
  };
}

