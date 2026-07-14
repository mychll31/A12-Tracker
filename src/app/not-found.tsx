import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Rendered outside the (app) shell — there is no sidebar here, because a 404 can
 * be reached while signed out.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <span
            className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-soft"
            aria-hidden="true"
          >
            <Compass className="size-5 text-primary" />
          </span>

          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            404
          </p>
          {/* A page owns its <h1>; CardTitle only goes down to h2. */}
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            That page isn&apos;t here
          </h1>
          <CardDescription>
            The link may be old, or the thing it pointed at may have been
            removed.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
