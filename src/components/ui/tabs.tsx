"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  register: (value: string, el: HTMLButtonElement | null) => void;
  focusRelative: (from: string, delta: number | "first" | "last") => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  return ctx;
}

export interface TabsProps {
  /** Uncontrolled starting tab. Ignored when `value` is supplied. */
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue = "",
  value: controlled,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const baseId = useId();

  // Insertion order of the triggers — the order arrow keys must walk.
  const order = useRef<string[]>([]);
  const nodes = useRef(new Map<string, HTMLButtonElement>());

  const value = controlled ?? uncontrolled;

  const setValue = useCallback(
    (next: string) => {
      if (controlled === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((tab: string, el: HTMLButtonElement | null) => {
    if (el) {
      nodes.current.set(tab, el);
      if (!order.current.includes(tab)) order.current.push(tab);
    } else {
      nodes.current.delete(tab);
      order.current = order.current.filter((t) => t !== tab);
    }
  }, []);

  const focusRelative = useCallback(
    (from: string, delta: number | "first" | "last") => {
      const tabs = order.current;
      if (tabs.length === 0) return;

      let index: number;
      if (delta === "first") {
        index = 0;
      } else if (delta === "last") {
        index = tabs.length - 1;
      } else {
        const current = tabs.indexOf(from);
        index = (current + delta + tabs.length) % tabs.length;
      }

      const next = tabs[index];
      // Selection follows focus — the expected pattern when panels are cheap
      // to render, and it saves keyboard users an extra keystroke per tab.
      setValue(next);
      nodes.current.get(next)?.focus();
    },
    [setValue],
  );

  const ctx = useMemo(
    () => ({ value, setValue, baseId, register, focusRelative }),
    [value, setValue, baseId, register, focusRelative],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
}

export function TabsList({
  children,
  "aria-label": ariaLabel,
  className,
}: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "scroll-thin flex items-center gap-1 overflow-x-auto",
        "rounded-xl border border-border bg-surface-sunken p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({
  value,
  children,
  disabled,
  className,
}: TabsTriggerProps) {
  const {
    value: active,
    setValue,
    baseId,
    register,
    focusRelative,
  } = useTabs("TabsTrigger");
  const selected = active === value;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number | "first" | "last"> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: "first",
      End: "last",
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    focusRelative(value, move);
  }

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={selected}
      // Roving tabindex: only the active tab sits in the page tab order, so Tab
      // steps past the whole tablist instead of through every trigger.
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      ref={(el) => register(value, el)}
      onClick={() => setValue(value)}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3",
        "text-xs font-medium transition-colors duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        selected
          ? "card-shadow bg-surface-raised text-foreground"
          : "text-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: active, baseId } = useTabs("TabsContent");
  if (active !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn("animate-fade-in focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
