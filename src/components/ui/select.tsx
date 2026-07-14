"use client";

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlBase, controlBorder } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  /** Rendered as a disabled first option so the field can start empty. */
  placeholder?: string;
  invalid?: boolean;
}

/**
 * A native <select>. A custom listbox would buy styling freedom at the cost of
 * mobile pickers, form autofill and screen-reader behaviour the browser gives
 * us for free, so we style the native control instead.
 */
export function Select({
  options,
  placeholder,
  invalid,
  className,
  defaultValue,
  value,
  ...props
}: SelectProps) {
  const startsEmpty =
    placeholder !== undefined &&
    value === undefined &&
    defaultValue === undefined;

  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        value={value}
        defaultValue={startsEmpty ? "" : defaultValue}
        className={cn(
          controlBase,
          controlBorder,
          "h-10 cursor-pointer appearance-none py-0 pl-3 pr-9 text-sm",
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
