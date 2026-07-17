"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn, type AuthState } from "../actions";

const initialState: AuthState = { error: null };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to pick up your goals and today&apos;s core tasks.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <FormField label="Email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@abundancehub.io"
            required
          />
        </FormField>

        <FormField label="Password" required>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            placeholder="••••••••••"
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
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>

      {/* <div className="mt-8 rounded-card border border-border bg-surface-sunken p-4">
        <p className="text-xs font-medium">Demo accounts</p>
        <dl className="mt-2 space-y-1 text-xs text-muted">
          <div className="flex justify-between gap-4">
            <dt>Coach &amp; mentee</dt>
            <dd className="font-mono">maychell@abundancehub.io</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Coach</dt>
            <dd className="font-mono">diana@abundancehub.io</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Admin</dt>
            <dd className="font-mono">admin@abundancehub.io</dd>
          </div>
          <div className="flex justify-between gap-4 pt-1">
            <dt>Password</dt>
            <dd className="font-mono">Abundance123!</dd>
          </div>
        </dl>
      </div> */}
    </div>
  );
}
