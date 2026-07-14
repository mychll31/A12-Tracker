"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { signUp, type AuthState } from "../actions";

const initialState: AuthState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Start your growth
      </h1>
      <p className="mt-2 text-sm text-muted">
        Create your account. A coach will place you into a coaching group.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First name" required>
            <Input name="firstName" autoComplete="given-name" required />
          </FormField>
          <FormField label="Last name" required>
            <Input name="lastName" autoComplete="family-name" required />
          </FormField>
        </div>

        <FormField label="Email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@abundancehub.io"
            required
          />
        </FormField>

        <FormField
          label="Password"
          required
          hint="At least 10 characters, with an uppercase letter and a number."
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </FormField>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" isLoading={pending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
