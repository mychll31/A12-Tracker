"use client";

import { cloneElement, isValidElement, useId } from "react";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* Shared control chrome, so Input, Textarea and Select read as one family. */
export const controlBase = cn(
  "w-full rounded-xl border bg-surface-raised text-foreground",
  "placeholder:text-muted",
  "transition-colors duration-150 ease-out",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-50",
);

export const controlBorder =
  "border-border hover:border-border-strong aria-[invalid=true]:border-rose-500 aria-[invalid=true]:hover:border-rose-500";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlBorder, "h-10 px-3 text-sm", className)}
      {...props}
    />
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({
  className,
  invalid,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        controlBorder,
        "scroll-thin resize-y px-3 py-2 text-sm leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-muted-strong",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-rose-500" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export interface FormFieldProps {
  label: string;
  /** A single control. FormField injects id/aria-* into it, so it must accept them. */
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Override the generated id when the caller already owns one. */
  id?: string;
}

type InjectableProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  invalid?: boolean;
};

export function FormField({
  label,
  children,
  hint,
  error,
  required,
  className,
  id,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  // An error supersedes the hint in the accessible description: a screen reader
  // should announce what is wrong, not what was merely suggested.
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  const control = isValidElement<InjectableProps>(children)
    ? cloneElement(children as ReactElement<InjectableProps>, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        invalid: error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={controlId} required={required}>
        {label}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-rose-500 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
