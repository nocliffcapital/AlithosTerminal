'use client';

import { useEffect, useState } from 'react';
// @ts-expect-error - tinykeys doesn't have proper TypeScript exports
import tinykeys from 'tinykeys';
import { useLayoutStore } from '@/stores/layout-store';

interface Hotkey {
  keys: string;
  action: () => void;
  description: string;
  context?: string; // Only active in certain contexts
}

const globalHotkeys: Hotkey[] = [
  {
    keys: '$mod+k',
    action: () => {
      // Command palette handled separately
    },
    description: 'Open command palette',
  },
];

const tradingHotkeys: Hotkey[] = [
  {
    keys: 'b',
    action: () => {
      console.log('Buy');
    },
    description: 'Buy',
    context: 'trading',
  },
  {
    keys: 's',
    action: () => {
      console.log('Sell');
    },
    description: 'Sell',
    context: 'trading',
  },
  {
    keys: 'f',
    action: () => {
      console.log('Flatten');
    },
    description: 'Flatten position',
    context: 'trading',
  },
  {
    keys: 'ArrowUp',
    action: () => {
      console.log('Nudge price up 0.1%');
    },
    description: 'Nudge price up 0.1%',
    context: 'order-entry',
  },
  {
    keys: 'ArrowDown',
    action: () => {
      console.log('Nudge price down 0.1%');
    },
    description: 'Nudge price down 0.1%',
    context: 'order-entry',
  },
  {
    keys: 'Shift+ArrowUp',
    action: () => {
      console.log('Nudge price up 1%');
    },
    description: 'Nudge price up 1%',
    context: 'order-entry',
  },
  {
    keys: 'Shift+ArrowDown',
    action: () => {
      console.log('Nudge price down 1%');
    },
    description: 'Nudge price down 1%',
    context: 'order-entry',
  },
  {
    keys: '$mod+ArrowUp',
    action: () => {
      console.log('Nudge price up 5%');
    },
    description: 'Nudge price up 5%',
    context: 'order-entry',
  },
  {
    keys: '$mod+ArrowDown',
    action: () => {
      console.log('Nudge price down 5%');
    },
    description: 'Nudge price down 5%',
    context: 'order-entry',
  },
];

export function HotkeyManager() {
  const [context] = useState<string>('global');

  useEffect(() => {
    // Determine current context based on active card
    // This is simplified - in production, you'd track which card has focus
    const activeContext = context || 'global';

    const allHotkeys: Hotkey[] = [...globalHotkeys];
    if (activeContext === 'trading' || activeContext === 'order-entry') {
      allHotkeys.push(...tradingHotkeys.filter((h) => h.context === activeContext || !h.context));
    }

    const keyMap: Record<string, (event: KeyboardEvent) => void> = {};
    allHotkeys.forEach((h) => {
      keyMap[h.keys] = (event) => {
        event.preventDefault();
        h.action();
      };
    });

    const unsubscribe = tinykeys(window, keyMap);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [context]);

  return null; // This is a provider component, no UI
}
