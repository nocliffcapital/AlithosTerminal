import { create } from 'zustand';
import type { AnomalyEvent } from '@/lib/anomaly-detection';

interface AnomalyState {
  selectedAnomaly: AnomalyEvent | null;
  setSelectedAnomaly: (anomaly: AnomalyEvent | null) => void;
}

export const useAnomalyStore = create<AnomalyState>((set) => ({
  selectedAnomaly: null,
  setSelectedAnomaly: (anomaly) => set({ selectedAnomaly: anomaly }),
}));

