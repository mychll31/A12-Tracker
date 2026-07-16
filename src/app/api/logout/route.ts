import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Clears the session cookie and sends the visitor on.
 *
 * A GET endpoint (unlike the `signOut` server action) so it can be reached by a
 * redirect. `requireUser` sends a stale session here — a cookie whose token is
 * valid but no longer resolves to a user (an expired session, or an account
 * that vanished since sign-in, e.g. after a local `db:reset`). Middleware treats
 * the mere presence of the cookie as "signed in" and bounces such a visitor from
 * /login to /dashboard, which bounces them back — an infinite redirect until the
 * cookie is actually removed, which only a route handler (or action) can do.
 *
 * `/api/*` is outside the middleware matcher, so this route is never bounced.
 */
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next");
  // Only ever honour a same-origin path, never an absolute or protocol-relative
  // URL, so this cannot be turned into an open redirect.
  const next =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/login";

  const url = request.nextUrl.clone();
  url.pathname = next;
  url.search = "";

  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
