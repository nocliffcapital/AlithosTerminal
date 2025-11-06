// Trading hook wrapper for easier component usage
'use client';

import { useTrading as useTradingInternal } from '@/lib/web3/trading';

export function useTrading() {
  // Re-export the trading hook
  return useTradingInternal();
}

