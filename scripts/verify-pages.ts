/**
 * Renders every screen as each role and asserts real seeded data reaches the
 * page — a 200 only proves the route did not throw, not that anything showed up.
 *
 *   npm run dev          # in another terminal
 *   npx tsx scripts/verify-pages.ts
 */
import "./env";
import { SignJWT } from "jose";

import { db } from "../src/lib/db";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;

async function sessionFor(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  return `ah_session=${token}`;
}

/**
 * React escapes text into entities (`Diana&#x27;s Circle`), so a naive tag-strip
 * would never match a name containing an apostrophe. Decode before asserting.
 */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Next renders a crashed route as a 200 carrying its error overlay, so status
 * alone proves nothing — that is exactly how a "use server" module that
 * illegally exported an object once passed this suite. Look for the wreckage.
 */
const RUNTIME_ERROR =
  /can only export async functions|is not defined|ReferenceError|__next_error__|Runtime Error|Unhandled Runtime|Internal Server Error|call-stack/i;

async function expectOnPage(path: string, cookie: string, must: string[]) {
  const res = await fetch(BASE + path, { headers: { cookie } });
  const html = await res.text();
  const crashed = RUNTIME_ERROR.test(html);
  const text = visibleText(html);
  const missing = must.filter((m) => !text.includes(m));
  const pass = res.status === 200 && !crashed && missing.length === 0;

  if (!pass) failures += 1;
  console.log(
    `${pass ? "  ok  " : " FAIL "} ${path.padEnd(26)} ${
      pass
        ? "renders seeded data"
        : crashed
          ? `${res.status} — RUNTIME ERROR on the page`
          : `${res.status} — missing: ${missing.join(", ")}`
    }`,
  );
}

async function main() {
  console.log(`\nAbundance Hub — page content checks against ${BASE}\n`);

  const mentee = await sessionFor("tomas@abundancehub.io"); // Maychell's Circle
  const dual = await sessionFor("maychell@abundancehub.io");
  const admin = await sessionFor("admin@abundancehub.io");

  console.log("--- mentee ---");
  await expectOnPage("/dashboard", mentee, [
    "Welcome back",
    "Goal Total Score",
  ]);
  await expectOnPage("/goals", mentee, [
    "Personal",
    "Professional",
    "Contribution",
  ]);
  await expectOnPage("/core-tasks", mentee, ["Meditation", "Kept", "Missed"]);
  await expectOnPage("/check-in", mentee, [
    "Wins",
    "Challenges",
    "Gratitude",
    "Tomorrow",
  ]);
  await expectOnPage("/leaderboards", mentee, ["Tomas"]);
  await expectOnPage("/achievements", mentee, ["unlocked"]);

  // The goal detail route — the one that shipped broken because a 200 was
  // mistaken for a working page. Assert the goal's own title reaches the DOM.
  const goal = await db.goal.findFirstOrThrow({
    where: { user: { email: "tomas@abundancehub.io" } },
    select: { id: true, title: true },
  });
  await expectOnPage(`/goals/${goal.id}`, mentee, [goal.title, "Tasks"]);

  console.log("\n--- coach + mentee (one account, both surfaces) ---");
  await expectOnPage("/dashboard", dual, ["Goal Total Score"]);
  await expectOnPage("/coach", dual, ["Coach Dashboard", "Total mentees"]);
  await expectOnPage("/coach/mentees", dual, ["Priya", "Grace"]);
  await expectOnPage("/coach/goals", dual, ["All my councils", "All mentees"]);
  await expectOnPage("/coach/goals?council=all", dual, ["Priya", "Goal Score"]);
  await expectOnPage("/coach/groups", dual, [
    "Maychell's Circle",
    "Thursday momentum",
  ]);
  await expectOnPage("/organization", dual, ["Diana", "Maychell"]);

  console.log("\n--- admin ---");
  await expectOnPage("/admin", admin, ["Recalculate"]);
  await expectOnPage("/admin/users", admin, ["maychell@abundancehub.io"]);
  await expectOnPage("/admin/groups", admin, ["Maychell's Circle"]);
  await expectOnPage("/admin/core-tasks", admin, [
    "Meditation",
    "Everyday Learning",
  ]);

  /**
   * Every remaining route whose page loads a `"use server"` module.
   *
   * A server-actions module that exports anything but an async function blows up
   * at module evaluation — and Next serves the wreckage with a 200, so only the
   * error-signature check above catches it. That has now happened twice; these
   * routes exist so it cannot happen a third time silently.
   */
  console.log("\n--- every action-backed route loads ---");
  const priya = await db.user.findUniqueOrThrow({
    where: { email: "priya@abundancehub.io" },
    select: { id: true },
  });

  await expectOnPage("/notes", mentee, []);
  await expectOnPage("/notifications", mentee, []);
  await expectOnPage("/profile", mentee, []);
  await expectOnPage("/coach/notes", dual, []);
  await expectOnPage(`/coach/mentees/${priya.id}`, dual, ["Priya"]);

  console.log(
    failures === 0
      ? "\nEvery page rendered real seeded data.\n"
      : `\n${failures} page(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
