"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui";

/**
 * Every ForbiddenError in this app carries a message written for a person —
 * "That member is outside your coaching group", not a stack trace — so showing
 * `error.message` is the friendliest thing we can do, and the most honest.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span
            className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-500/10"
            aria-hidden="true"
          >
            <AlertTriangle className="size-5 text-amber-500 dark:text-amber-400" />
          </span>

          {/* A page owns its <h1>; CardTitle only goes down to h2. */}
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Something interrupted that
          </h1>
          <CardDescription>
            {error.message || "The page could not be loaded."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={reset}>Try again</Button>

          {/* A link, not a Button — an <a> inside a <button> is invalid. */}
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-strong transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to dashboard
          </Link>
        </CardContent>

        {error.digest ? (
          <p className="px-5 pb-5 text-xs text-muted sm:px-6 sm:pb-6">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
