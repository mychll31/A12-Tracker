"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

/** Shared with the pre-paint script in layout.tsx — both must read the same key. */
export const THEME_STORAGE_KEY = "ah-theme";

const ORDER: Theme[] = ["light", "dark", "system"];

const OPTIONS: Record<
  Theme,
  { icon: ComponentType<{ className?: string }>; label: string }
> = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  system: { icon: Monitor, label: "System" },
};

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/*
 * localStorage is an external system, so the theme is read through
 * useSyncExternalStore rather than mirrored into state inside an effect. That
 * keeps the server snapshot ("system") matching first paint, lets React swap in
 * the stored value on hydration, and avoids a cascading re-render.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires in *other* tabs, keeping the theme in sync across them.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : "system";
}

/** The server cannot know the preference; the pre-paint script covers the gap. */
function getServerSnapshot(): Theme {
  return "system";
}

function persistTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  listeners.forEach((notify) => notify());
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the <html> class in step with the stored preference. No setState here,
  // so this synchronises the DOM without triggering another render.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // On "system", keep following the OS if the user flips it mid-session.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const cycle = useCallback(() => {
    persistTheme(ORDER[(ORDER.indexOf(getSnapshot()) + 1) % ORDER.length]);
  }, []);

  const active = OPTIONS[theme];
  const Icon = active.icon;
  const next = OPTIONS[ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${active.label}. Switch to ${next.label}.`}
      title={`Theme: ${active.label}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg",
        "border border-border bg-surface-raised text-muted-strong",
        "transition-colors hover:border-border-strong hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
