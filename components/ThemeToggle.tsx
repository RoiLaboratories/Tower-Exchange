"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/components/providers/ThemeProvider";

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> =
    [
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
    ];

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border bg-secondary/80 p-1 ${
        compact ? "h-9" : "h-10"
      }`}
      role="tablist"
      aria-label="Theme"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;

        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${label} mode`}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center rounded-full transition-all ${
              compact ? "h-7 w-9" : "h-8 w-10"
            } ${
              active
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
