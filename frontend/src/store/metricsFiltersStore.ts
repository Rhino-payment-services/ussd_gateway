import { create } from "zustand";

export type RangePreset = "today" | "24h" | "7d" | "30d" | "custom";

type TableStatus = "all" | "active" | "completed" | "failed";

type MetricsFiltersState = {
  preset: RangePreset;
  customFrom: string;
  customTo: string;
  provider: string;
  tableStatus: TableStatus;
  setPreset: (p: RangePreset) => void;
  setCustomFrom: (s: string) => void;
  setCustomTo: (s: string) => void;
  setProvider: (s: string) => void;
  setTableStatus: (s: TableStatus) => void;
};

export const useMetricsFilters = create<MetricsFiltersState>((set) => ({
  preset: "7d",
  customFrom: "",
  customTo: "",
  provider: "",
  tableStatus: "all",
  setPreset: (preset) => set({ preset }),
  setCustomFrom: (customFrom) => set({ customFrom }),
  setCustomTo: (customTo) => set({ customTo }),
  setProvider: (provider) => set({ provider }),
  setTableStatus: (tableStatus) => set({ tableStatus }),
}));
