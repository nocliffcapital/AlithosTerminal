import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TradingSettings {
  slippageTolerance: number; // percentage (e.g., 0.5 for 0.5%)
  gasPriority: 'slow' | 'standard' | 'fast' | 'instant';
}

interface TradingSettingsState {
  settings: TradingSettings;
  setSlippageTolerance: (tolerance: number) => void;
  setGasPriority: (priority: 'slow' | 'standard' | 'fast' | 'instant') => void;
  resetSettings: () => void;
}

const defaultSettings: TradingSettings = {
  slippageTolerance: 1.0, // 1% default
  gasPriority: 'standard',
};

/**
 * Trading settings store with persistence
 */
export const useTradingSettingsStore = create<TradingSettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      
      setSlippageTolerance: (tolerance) => {
        set((state) => ({
          settings: {
            ...state.settings,
            slippageTolerance: tolerance,
          },
        }));
      },
      
      setGasPriority: (priority) => {
        set((state) => ({
          settings: {
            ...state.settings,
            gasPriority: priority,
          },
        }));
      },
      
      resetSettings: () => {
        set({
          settings: defaultSettings,
        });
      },
    }),
    {
      name: 'trading-settings', // localStorage key
    }
  )
);

