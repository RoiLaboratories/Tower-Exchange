"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark";

// const STORAGE_KEY = "tower-theme";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light mode is temporarily disabled — always apply dark.
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    // const stored = window.localStorage.getItem(STORAGE_KEY);
    // const nextTheme: ThemeMode = stored === "light" ? "light" : "dark";
    const nextTheme: ThemeMode = "dark";
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    // Light mode is temporarily disabled.
    // setThemeState((current) => {
    //   const nextTheme: ThemeMode = current === "dark" ? "light" : "dark";
    //   applyTheme(nextTheme);
    //   window.localStorage.setItem(STORAGE_KEY, nextTheme);
    //   return nextTheme;
    // });
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    // Light mode is temporarily disabled.
    // applyTheme(nextTheme);
    // window.localStorage.setItem(STORAGE_KEY, nextTheme);
    // setThemeState(nextTheme);
    applyTheme("dark");
    setThemeState("dark");
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
