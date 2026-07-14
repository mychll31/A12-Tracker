"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { Button, useToast } from "@/components/ui";
import type { ButtonSize, ButtonVariant } from "@/components/ui";

import { IDLE_ACTION_STATE } from "../_lib/form-state";
import type { AdminActionState as ActionState } from "../_lib/form-state";

type AdminAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * The one place an admin server action is wired to the UI.
 *
 * Every admin write returns the same `{ ok, message, error }` shape, so the
 * toast-on-success, inline-error and pending-button behaviour is written once
 * here instead of being re-derived in each of the eleven modals.
 */

export interface ActionFormProps {
  action: AdminAction;
  children?: ReactNode;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  /** Fires once per successful submit — used to close the modal that owns the form. */
  onSuccess?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
}

export function ActionForm({
  action,
  children,
  submitLabel,
  submitVariant = "primary",
  onSuccess,
  onCancel,
  cancelLabel = "Cancel",
  className,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_ACTION_STATE);
  const { toast } = useToast();

  // useActionState hands back a fresh object per submit, so object identity is
  // exactly "have I already reacted to this result?" — no flag to reset.
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;

    if (state.ok && state.message) {
      toast({ title: state.message, variant: "success" });
      onSuccess?.();
    }
  }, [state, toast, onSuccess]);

  return (
    <form action={formAction} className={className}>
      {children}

      {state.error ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" variant={submitVariant} isLoading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export interface InlineActionProps {
  action: AdminAction;
  /** Hidden inputs — the whole payload for a one-button action. */
  fields: Record<string, string>;
  label: string;
  /** Toast heading. The action's own message becomes the body. */
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Native confirm text. Destructive rows only. */
  confirm?: string;
}

/**
 * A row action with no form to fill in — deactivate, remove, revoke. Reports
 * through a toast either way, because the row it changed may vanish on refresh.
 */
export function InlineAction({
  action,
  fields,
  label,
  title,
  variant = "ghost",
  size = "sm",
  icon,
  confirm,
}: InlineActionProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_ACTION_STATE);
  const { toast } = useToast();
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;

    if (state.ok && state.message) {
      toast({ title, description: state.message, variant: "success" });
    } else if (state.error) {
      toast({ title, description: state.error, variant: "danger" });
    }
  }, [state, toast, title]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // preventDefault on a React form action cancels the action itself.
    if (confirm && !window.confirm(confirm)) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size={size}
        icon={icon}
        isLoading={pending}
      >
        {label}
      </Button>
    </form>
  );
}
