'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const DEFAULT_BUY_PRESETS = [10, 50, 100];
const DEFAULT_SELL_PRESETS = [25, 50, 100];

const PRESETS_STORAGE_KEY = 'trading-presets';

interface Presets {
  buyPresets: number[];
  sellPresets: number[];
}

export function usePresets() {
  const { dbUser } = useAuth();
  const [presets, setPresets] = useState<Presets>({
    buyPresets: DEFAULT_BUY_PRESETS,
    sellPresets: DEFAULT_SELL_PRESETS,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPresets({
          buyPresets: parsed.buyPresets || DEFAULT_BUY_PRESETS,
          sellPresets: parsed.sellPresets || DEFAULT_SELL_PRESETS,
        });
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const savePresets = (buyPresets: number[], sellPresets: number[]) => {
    const newPresets = { buyPresets, sellPresets };
    setPresets(newPresets);
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(newPresets));
    } catch (error) {
      console.error('Failed to save presets:', error);
    }
  };

  return {
    presets,
    isLoading,
    savePresets,
  };
}

