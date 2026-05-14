import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

type ThemeState = {
  theme: Theme;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("light", next === "light");
        set({ theme: next });
      },
    }),
    {
      name: "ussd-theme",
      onRehydrateStorage: () => (state) => {
        if (state?.theme === "light") {
          document.documentElement.classList.add("light");
        } else {
          document.documentElement.classList.remove("light");
        }
      },
    },
  ),
);
