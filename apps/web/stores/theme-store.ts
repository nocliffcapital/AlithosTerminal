import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemePreset = 'bloomberg-dark' | 'minimal' | 'high-contrast' | 'custom';

export interface ThemeConfig {
  name: string;
  preset: ThemePreset;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    muted: string;
    accent: string;
    border: string;
    card: string;
  };
  fonts: {
    body: string;
    mono: string;
  };
  spacing: {
    base: number;
    card: number;
  };
  borderRadius: number;
}

const defaultTheme: ThemeConfig = {
  name: 'Bloomberg Dark',
  preset: 'bloomberg-dark',
  colors: {
    background: 'hsl(222.2, 84%, 4.9%)',
    foreground: 'hsl(210, 40%, 98%)',
    primary: 'hsl(210, 40%, 98%)',
    secondary: 'hsl(217.2, 32.6%, 17.5%)',
    muted: 'hsl(217.2, 32.6%, 17.5%)',
    accent: 'hsl(217.2, 32.6%, 17.5%)',
    border: 'hsl(217.2, 32.6%, 17.5%)',
    card: 'hsl(222.2, 84%, 4.9%)',
  },
  fonts: {
    body: 'Inter, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  spacing: {
    base: 8,
    card: 12,
  },
  borderRadius: 0.5,
};

interface ThemeState {
  currentTheme: ThemeConfig;
  customThemes: ThemeConfig[];
  setTheme: (theme: ThemeConfig) => void;
  addCustomTheme: (theme: ThemeConfig) => void;
  deleteCustomTheme: (name: string) => void;
  exportTheme: () => string;
  importTheme: (json: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: defaultTheme,
      customThemes: [],
      setTheme: (theme) => set({ currentTheme: theme }),
      addCustomTheme: (theme) =>
        set((state) => ({
          customThemes: [...state.customThemes, theme],
        })),
      deleteCustomTheme: (name) =>
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.name !== name),
        })),
      exportTheme: (): string => {
        const currentState = get();
        return JSON.stringify(currentState.currentTheme, null, 2);
      },
      importTheme: (json: string) => {
        try {
          const theme = JSON.parse(json) as ThemeConfig;
          set({ currentTheme: theme });
        } catch (error) {
          console.error('Failed to import theme:', error);
        }
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTheme: state.currentTheme,
        customThemes: state.customThemes,
      }),
    }
  )
);

