import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ah_session";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * An optimistic gate, not the security boundary.
 *
 * This checks only that a session cookie is *present*, so an unauthenticated
 * visitor is bounced without paying for a database round-trip. The signature is
 * never verified here and roles are never read here — every page and action
 * independently calls requireUser()/requireCoach()/requireAdmin(), which verify
 * the JWT and re-read roles from the database. Forging this cookie buys an
 * attacker nothing but a redirect to a page that then rejects them.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Send them back where they were headed once they sign in.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets, and /api — API routes
    // authorize themselves and must answer 401 JSON, not redirect to HTML.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
