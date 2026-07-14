"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
}

const SIZES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* Hydration status read as an external store: false on the server, true once
   mounted — without the cascading re-render a setState-in-effect would cause. */
const NEVER_CHANGES = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  // A portal needs a DOM target, which does not exist during SSR.
  const mounted = useHydrated();

  const trapTab = useCallback((event: KeyboardEvent) => {
    const root = panel.current;
    if (!root) return;

    const items = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null);

    if (items.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreFocus.current = document.activeElement as HTMLElement | null;

    // The page behind a modal must not scroll away underneath it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        trapTab(event);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    // Focus the panel, not its first control, so a screen reader announces the
    // dialog's title before it announces a field label.
    const focusTimer = window.setTimeout(() => panel.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose, trapTab]);

  if (!open || !mounted) return null;

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center sm:p-6"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        className="animate-fade-in fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "animate-slide-up card-shadow relative z-10 flex w-full flex-col",
          "border border-border bg-surface-raised",
          "rounded-t-card max-h-[90dvh] sm:rounded-card",
          "focus-visible:outline-none",
          SIZES[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cn(
              "-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
              "text-muted transition-colors hover:bg-surface-sunken hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {children ? (
          <div className="scroll-thin flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
