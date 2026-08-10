import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

type ThemeState = {
  theme: Theme;
  toggle: () => void;
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: "ussd-theme",
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme === "light" ? "light" : "dark");
      },
    },
  ),
);
