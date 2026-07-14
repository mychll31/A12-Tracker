"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. 0 keeps the toast until it is closed. */
  duration?: number;
}

export interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider>.");
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "text-muted-strong",
  success: "text-emerald-500 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  danger: "text-rose-500 dark:text-rose-400",
};

const VARIANT_ICONS: Record<ToastVariant, ComponentType<{ className?: string }>> =
  {
    default: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
  };

const DEFAULT_DURATION = 4500;

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = DEFAULT_DURATION,
    }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [
        ...current,
        { id, title, description, variant, duration },
      ]);

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  // A timer outliving its provider would setState on an unmounted tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // polite, not assertive: a save confirmation must never interrupt what a
        // screen-reader user is already in the middle of hearing.
        aria-live="polite"
        aria-atomic="false"
        className={cn(
          "pointer-events-none fixed z-[60] flex flex-col gap-2",
          "inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80",
        )}
      >
        {toasts.map((item) => {
          const Icon = VARIANT_ICONS[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "animate-slide-up card-shadow pointer-events-auto flex items-start gap-3",
                "rounded-card border border-border bg-surface-raised p-3.5",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  VARIANT_STYLES[item.variant],
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium leading-snug text-foreground">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="text-xs leading-relaxed text-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className={cn(
                  "-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                  "text-muted transition-colors hover:bg-surface-sunken hover:text-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
