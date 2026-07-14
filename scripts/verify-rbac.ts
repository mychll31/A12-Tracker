/**
 * Permission tests, over real HTTP.
 *
 * The RBAC rules live behind `server-only` modules that throw under plain Node,
 * so they cannot be unit-called from a script. Driving the running app through
 * its own API is the honest test anyway: it proves the boundary a real request
 * crosses, not a function in isolation.
 *
 *   npm run dev          # in another terminal
 *   npx tsx scripts/verify-rbac.ts
 */
import "dotenv/config";
import { SignJWT } from "jose";

import { db } from "../src/lib/db";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(
    `${pass ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

/** Mint the same session cookie src/lib/auth.ts issues on sign-in. */
async function sessionFor(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return `ah_session=${token}`;
}

async function get(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const body = await res.text();

  let json: unknown = null;
  try {
    json = JSON.parse(body);
  } catch {
    // Non-JSON (e.g. an HTML redirect). The status is what matters.
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nAbundance Hub — permission checks against ${BASE}\n`);

  const mentee = await sessionFor("jonah@abundancehub.io"); // Maychell's Circle
  const coach = await sessionFor("diana@abundancehub.io");
  const admin = await sessionFor("admin@abundancehub.io");

  // --- unauthenticated -------------------------------------------------------
  const anon = await get("/api/me");
  check(
    "anonymous request to /api/me is rejected",
    anon.status === 401,
    `${anon.status}`,
  );

  // --- a mentee is fenced into their own group -------------------------------
  const orgBoard = await get("/api/leaderboards?board=ORGANIZATION", mentee);
  check(
    "mentee CANNOT read the organization leaderboard",
    orgBoard.status === 403,
    `${orgBoard.status}`,
  );

  const coachBoard = await get("/api/leaderboards?board=COACH", mentee);
  check(
    "mentee CANNOT read the coach leaderboard",
    coachBoard.status === 403,
    `${coachBoard.status}`,
  );

  // Another coach's group, asked for directly by id.
  const otherGroup = await db.coachGroup.findFirstOrThrow({
    where: { coach: { email: "raviel@abundancehub.io" } },
    select: { id: true },
  });
  const foreignBoard = await get(
    `/api/leaderboards?board=GROUP&scope=${otherGroup.id}`,
    mentee,
  );
  check(
    "mentee CANNOT read another group's leaderboard",
    foreignBoard.status === 403,
    `${foreignBoard.status}`,
  );

  const ownBoard = await get("/api/leaderboards?board=GROUP", mentee);
  check(
    "mentee CAN read their own group's leaderboard",
    ownBoard.status === 200,
    `${ownBoard.status}`,
  );

  // A mentee belonging to another coach.
  const foreignMentee = await db.user.findUniqueOrThrow({
    where: { email: "samuel@abundancehub.io" }, // Raviel's Circle
    select: { id: true },
  });

  const foreignProfile = await get(`/api/mentees/${foreignMentee.id}`, mentee);
  check(
    "mentee CANNOT open a mentee from another group",
    foreignProfile.status === 403,
    `${foreignProfile.status}`,
  );

  const menteeList = await get("/api/mentees", mentee);
  const listed =
    (menteeList.json as { mentees?: { id: string; firstName: string }[] } | null)
      ?.mentees ?? [];
  check(
    "mentee's member list contains only their own group",
    menteeList.status === 200 &&
      listed.length > 0 &&
      !listed.some((m) => m.id === foreignMentee.id),
    `sees ${listed.map((m) => m.firstName).join(", ")}`,
  );

  // --- a coach reads across groups, but cannot edit outside their own ---------
  const coachOrgBoard = await get("/api/leaderboards?board=ORGANIZATION", coach);
  check(
    "coach CAN read the organization leaderboard",
    coachOrgBoard.status === 200,
    `${coachOrgBoard.status}`,
  );

  const coachForeign = await get(`/api/mentees/${foreignMentee.id}`, coach);
  check(
    "coach CAN view another coach's mentee",
    coachForeign.status === 200,
    `${coachForeign.status}`,
  );

  const foreign = coachForeign.json as {
    profile?: { canEdit?: boolean };
  } | null;
  check(
    "coach CANNOT edit another coach's mentee",
    coachForeign.status === 200 && foreign?.profile?.canEdit === false,
    "canEdit false — no delegation",
  );

  const ownMentee = await db.user.findUniqueOrThrow({
    where: { email: "elena@abundancehub.io" }, // Diana's Circle
    select: { id: true },
  });
  const coachOwn = await get(`/api/mentees/${ownMentee.id}`, coach);
  const own = coachOwn.json as { profile?: { canEdit?: boolean } } | null;
  check(
    "coach CAN edit their own mentee",
    own?.profile?.canEdit === true,
    "canEdit true",
  );

  // --- the delegation path: the "unless explicitly authorized" escape hatch ----
  const grant = await db.coachDelegation.findFirst({
    where: { permission: "EDIT", menteeId: { not: null } },
    select: {
      menteeId: true,
      grantee: { select: { email: true, firstName: true } },
      mentee: { select: { firstName: true } },
    },
  });

  if (grant?.menteeId) {
    const grantee = await sessionFor(grant.grantee.email);
    const delegated = await get(`/api/mentees/${grant.menteeId}`, grantee);
    const payload = delegated.json as {
      profile?: { canEdit?: boolean };
    } | null;
    check(
      "a delegated coach CAN edit another coach's mentee",
      payload?.profile?.canEdit === true,
      `${grant.grantee.firstName} → ${grant.mentee?.firstName}`,
    );
  }

  // --- admin is unrestricted --------------------------------------------------
  const adminBoard = await get("/api/leaderboards?board=ORGANIZATION", admin);
  check(
    "admin CAN read the organization leaderboard",
    adminBoard.status === 200,
    `${adminBoard.status}`,
  );

  console.log(
    failures === 0
      ? "\nAll permission checks passed.\n"
      : `\n${failures} permission check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
