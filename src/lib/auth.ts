import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { db } from "@/lib/db";
import { asRoleKey, type RoleKey } from "@/lib/domain";

const SESSION_COOKIE = "ah_session";
const SESSION_DAYS = 7;
const BCRYPT_COST = 12;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// Session token
// ---------------------------------------------------------------------------

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. See .env.example.");
  }
  return new TextEncoder().encode(value);
}

/**
 * The token carries nothing but the user id. Roles and group membership are
 * always re-read from the database, so revoking a role takes effect on the very
 * next request instead of whenever the token happens to expire.
 */
async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = await signSession(userId);
  const jar = await cookies();

  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  organizationId: string;
  roles: RoleKey[];
  isAdmin: boolean;
  isCoach: boolean;
  isMentee: boolean;
  /** Groups this user coaches. */
  coachGroupIds: string[];
  /** The single group this user is mentored in, if any. */
  menteeGroupId: string | null;
  joinedAt: Date;
  /** True until the onboarding wizard has been completed. */
  needsOnboarding: boolean;
};

/**
 * Resolved once per request. Several server components on one page all call
 * this; React's cache collapses them into a single query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await readSessionToken(token);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      coachGroups: { where: { isActive: true }, select: { id: true } },
      memberships: {
        where: {
          isActive: true,
          group: { isActive: true, coach: { isActive: true } },
        },
        select: { groupId: true },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const roles = user.roles.map((r) => asRoleKey(r.role.key));

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    avatarUrl: user.avatarUrl,
    headline: user.headline,
    organizationId: user.organizationId,
    roles,
    isAdmin: roles.includes("ADMIN"),
    isCoach: roles.includes("COACH"),
    isMentee: roles.includes("MENTEE"),
    coachGroupIds: user.coachGroups.map((g) => g.id),
    menteeGroupId: user.memberships[0]?.groupId ?? null,
    joinedAt: user.joinedAt,
    needsOnboarding: user.onboardedAt === null,
  };
});

/** For pages and actions that must have an authenticated actor. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    // A cookie that no longer resolves to a user — an expired token, or an
    // account removed since sign-in (e.g. after a local `db:reset`) — has to be
    // cleared, or middleware keeps treating it as "signed in" and bounces the
    // visitor /login → /dashboard → here forever. Only a route handler can
    // delete a cookie, so hand off to one; a plain missing cookie just goes to
    // the sign-in form.
    const jar = await cookies();
    redirect(jar.has(SESSION_COOKIE) ? "/api/logout?next=/login" : "/login");
  }
  return user;
}

export async function requireCoach(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isCoach && !user.isAdmin) redirect("/dashboard");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

export type Credentials = { email: string; password: string };

export async function authenticate({
  email,
  password,
}: Credentials): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, passwordHash: true, isActive: true },
  });

  // Always run a comparison, even when the account is missing, so a wrong email
  // and a wrong password take the same time to reject.
  const hash =
    user?.passwordHash ??
    "$2a$12$invalidinvalidinvaliduO8YQZKrLZ0Zq0Zq0Zq0Zq0Zq0Zq0Zq";
  const matches = await verifyPassword(password, hash);

  if (!user || !matches) {
    return { ok: false, error: "Email or password is incorrect." };
  }
  if (!user.isActive) {
    return { ok: false, error: "This account has been deactivated." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  return { ok: true, userId: user.id };
}
