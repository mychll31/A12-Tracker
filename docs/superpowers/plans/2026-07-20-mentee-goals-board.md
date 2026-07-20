# Mentee Goals Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a coach one page at `/coach/goals` that lists every mentee's goals grouped by mentee, so they no longer open each profile one at a time.

**Architecture:** A read-only Next.js **server component** page backed by one new server function `listMenteeGoals`. Scope (my councils / all mentees) is a `?scope=` URL param rendered as two links; each mentee section is a native `<details>` element — so the whole page ships zero client JavaScript. All editing stays on the existing goal/profile pages the rows link to.

**Tech Stack:** Next.js 16 (App Router, server components), Prisma 7, TypeScript, Tailwind, the in-repo `@/components/ui` barrel.

## Global Constraints

- **Modified Next.js** — per `AGENTS.md`, this is not stock Next. Server-component pages receive `searchParams` as a **Promise** that must be `await`ed (see `src/app/(app)/coach/mentees/page.tsx:148-154`). Read `node_modules/next/dist/docs/` before using any unfamiliar Next API.
- **No unit-test runner exists.** `src/server/*` modules import `"server-only"` and throw under plain Node, so they cannot be called from a script (see the note at the top of `scripts/verify.ts`). Verification in this repo = `npm run typecheck`, `npm run lint`, and the HTTP content checks in `scripts/verify-pages.ts` run against a live dev server + seeded DB. This plan uses those, not a test framework.
- **UI imports** come from the `@/components/ui` barrel; category labels from `src/app/(app)/goals/categories.ts`; the goal score chip from `src/app/(app)/goals/goal-score-badge.tsx`.
- **Coach-only** page, guarded by `requireCoach()` from `@/lib/auth`.
- **Category keys** are exactly `["PERSONAL", "PROFESSIONAL", "CONTRIBUTION"]` (`GOAL_CATEGORY_KEYS` in `src/lib/domain.ts`). All three are required; an empty one scores 0.

---

## File Structure

- `src/server/goals.ts` — **modify**: add `listMenteeGoals` + `MenteeGoalsGroup` type. Reuses the file's existing private `toSummary`, `categorySelect`, and imported `scoreCategories` / `weightGoalScore` / `asGoalStatus` / `asGoalCategoryKey` / `GOAL_CATEGORY_KEYS`.
- `src/app/(app)/coach/goals/page.tsx` — **create**: the Goals Board page (server component).
- `src/components/app-shell/nav-config.ts` — **modify**: add the "Goals" nav item.
- `src/components/app-shell/sidebar.tsx` — **modify**: register the `goal` icon.
- `scripts/verify-pages.ts` — **modify**: assert the new page renders seeded data in both scopes.

---

## Task 1: `listMenteeGoals` server function

**Files:**
- Modify: `src/server/goals.ts`

**Interfaces:**
- Consumes (already in `src/server/goals.ts` or importable):
  - `toSummary(goal): GoalSummary` — private helper, same module.
  - `categorySelect` — private const, same module.
  - `scoreCategories(goals): CategoryScores`, `weightGoalScore(categories): number` — already imported from `@/lib/scoring`.
  - `asGoalStatus`, `asGoalCategoryKey`, `GOAL_CATEGORY_KEYS`, `GoalCategoryKey` — already imported from `@/lib/domain`.
  - `coachMenteeIds(coachId): Promise<string[]>`, `visibleUserIds(actor): Promise<string[] | null>` — from `@/lib/rbac` (must be **added** to the existing rbac import).
  - `db` from `@/lib/db`, `SessionUser` from `@/lib/auth` — already imported.
- Produces (Task 2 relies on these exact names/types):
  ```ts
  export type MenteeGoalsGroup = {
    mentee: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    goalTotalScore: number;
    goals: GoalSummary[];
    missingCategories: GoalCategoryKey[];
  };

  listMenteeGoals(
    actor: SessionUser,
    opts: { scope: "councils" | "all" },
  ): Promise<MenteeGoalsGroup[]>
  ```

- [ ] **Step 1: Extend the rbac import**

In `src/server/goals.ts`, the existing import is:

```ts
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
} from "@/lib/rbac";
```

Change it to add the two membership helpers:

```ts
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
  coachMenteeIds,
  visibleUserIds,
} from "@/lib/rbac";
```

- [ ] **Step 2: Add the type and function**

Append to `src/server/goals.ts` (anywhere after `toSummary` and the `Reads` section; end of file is fine):

```ts
// ---------------------------------------------------------------------------
// Coach Goals Board — every mentee's goals in one bounded read
// ---------------------------------------------------------------------------

export type MenteeGoalsGroup = {
  mentee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  /** The mentee's Goal Total Score (the three categories combined), 0-100. */
  goalTotalScore: number;
  /** Overdue first, then at-risk, then soonest due. */
  goals: GoalSummary[];
  /** Required categories this mentee holds no (non-abandoned) goal in. */
  missingCategories: GoalCategoryKey[];
};

/**
 * The Goals Board's single read: every mentee in scope with their goals, Goal
 * Total Score and required-category gaps.
 *
 * Bounded queries regardless of roster size — no per-mentee loop. One query to
 * resolve the id set, then identities and every goal for the set in parallel;
 * grouping and scoring happen in memory, mirroring cardsForUserIds in
 * src/server/mentees.ts. Scores come from the same engine the leaderboards use,
 * so the number here can never diverge from a mentee's ranked score.
 */
export async function listMenteeGoals(
  actor: SessionUser,
  opts: { scope: "councils" | "all" },
): Promise<MenteeGoalsGroup[]> {
  // 1. Resolve the mentee id set for the chosen scope.
  let menteeIds: string[];
  if (opts.scope === "councils") {
    menteeIds = await coachMenteeIds(actor.id);
  } else {
    // "All" = every mentee the coach may view. visibleUserIds returns null for a
    // coach ("whole org"), so fall back to an org-wide MENTEE query, exactly as
    // listMentees does.
    const allowed = await visibleUserIds(actor);
    const rows = await db.user.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        roles: { some: { role: { key: "MENTEE" } } },
        ...(allowed === null ? {} : { id: { in: allowed } }),
      },
      select: { id: true },
    });
    menteeIds = rows.map((r) => r.id);
  }

  if (menteeIds.length === 0) return [];

  // 2 & 3. Identities and all their goals, in two queries.
  const [users, goals] = await Promise.all([
    db.user.findMany({
      where: { id: { in: menteeIds }, isActive: true },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.goal.findMany({
      where: { userId: { in: menteeIds } },
      orderBy: [{ targetDate: "asc" }, { createdAt: "desc" }],
      include: {
        category: categorySelect,
        tasks: { select: { status: true } },
      },
    }),
  ]);

  // Group the raw goal rows by owner (rows still carry task statuses, which the
  // category scorer needs for MILESTONE goals).
  const rowsByUser = new Map<string, typeof goals>();
  for (const goal of goals) {
    const list = rowsByUser.get(goal.userId);
    if (list) list.push(goal);
    else rowsByUser.set(goal.userId, [goal]);
  }

  // Overdue first, then AT_RISK, then soonest due.
  const rank = (g: GoalSummary) =>
    g.isOverdue ? 0 : g.status === "AT_RISK" ? 1 : 2;

  return users.map((user) => {
    const rows = rowsByUser.get(user.id) ?? [];

    const summaries = rows
      .map(toSummary)
      .sort((a, b) => rank(a) - rank(b) || a.daysUntilDue - b.daysUntilDue);

    const goalTotalScore = weightGoalScore(
      scoreCategories(
        rows.map((g) => ({
          status: g.status,
          progress: g.progress,
          categoryKey: g.category.key,
          goalType: g.goalType,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
          tasks: g.tasks,
        })),
      ),
    );

    // An abandoned goal doesn't count as "holding" a category — matches
    // requiredGoalGaps.
    const held = new Set(
      rows
        .filter((g) => asGoalStatus(g.status) !== "ABANDONED")
        .map((g) => asGoalCategoryKey(g.category.key)),
    );
    const missingCategories = GOAL_CATEGORY_KEYS.filter((k) => !held.has(k));

    return {
      mentee: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      goalTotalScore,
      goals: summaries,
      missingCategories,
    };
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). If `coachMenteeIds`/`visibleUserIds` are reported unused, you skipped a call site — recheck Step 2.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/goals.ts
git commit -m "feat: listMenteeGoals server read for the coach goals board"
```

---

## Task 2: Goals Board page

**Files:**
- Create: `src/app/(app)/coach/goals/page.tsx`

**Interfaces:**
- Consumes: `listMenteeGoals(actor, { scope }): Promise<MenteeGoalsGroup[]>` and `MenteeGoalsGroup` from Task 1; `requireCoach()` from `@/lib/auth`; `GOAL_CATEGORY_LABELS` from `../../goals/categories`; `GoalScoreBadge` from `../../goals/goal-score-badge`; `Avatar, Badge, EmptyState, ProgressBar, StatusBadge` from `@/components/ui`; `formatDate` from `@/lib/dates`; `cn, formatScore` from `@/lib/utils`.
- Produces: the `/coach/goals` route.

- [ ] **Step 1: Create the page**

Create `src/app/(app)/coach/goals/page.tsx` with exactly:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Target } from "lucide-react";

import { requireCoach } from "@/lib/auth";
import { listMenteeGoals } from "@/server/goals";
import { formatDate } from "@/lib/dates";
import { cn, formatScore } from "@/lib/utils";
import {
  Avatar,
  Badge,
  EmptyState,
  ProgressBar,
  StatusBadge,
} from "@/components/ui";

import { GOAL_CATEGORY_LABELS } from "../../goals/categories";
import { GoalScoreBadge } from "../../goals/goal-score-badge";

export const metadata: Metadata = { title: "Goals" };

/**
 * Every mentee's goals on one page, grouped by mentee. Read-only: rows link out
 * to the existing goal and profile pages. Scope lives in the URL, and each
 * mentee is a native <details> block, so the page ships no client JavaScript.
 */

type SearchParams = Promise<{ scope?: string }>;

const asScope = (value: string | undefined): "councils" | "all" =>
  value === "all" ? "all" : "councils";

export default async function CoachGoalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireCoach();
  const { scope: scopeParam } = await searchParams;
  const scope = asScope(scopeParam);

  const groups = await listMenteeGoals(user, { scope });

  const scopes = [
    { key: "councils" as const, label: "My councils", href: "/coach/goals" },
    {
      key: "all" as const,
      label: "All mentees",
      href: "/coach/goals?scope=all",
    },
  ];

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Goals
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every mentee&rsquo;s goals on one page. Open a goal or a profile to
            make changes.
          </p>
        </div>

        <div
          className="inline-flex w-fit rounded-lg border border-border bg-surface-sunken p-1 text-sm"
          role="tablist"
          aria-label="Which mentees to show"
        >
          {scopes.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              role="tab"
              aria-selected={scope === s.key}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                scope === s.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            scope === "councils"
              ? "No mentees in your councils yet"
              : "No mentees to show"
          }
          description={
            scope === "councils"
              ? "Once mentees are placed in a council you lead, their goals gather here."
              : "No mentee in the organization is visible to you yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <details
              key={group.mentee.id}
              open
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                <Avatar
                  src={group.mentee.avatarUrl}
                  firstName={group.mentee.firstName}
                  lastName={group.mentee.lastName}
                  size="sm"
                />
                <Link
                  href={`/coach/mentees/${group.mentee.id}`}
                  className="font-semibold text-foreground hover:text-primary"
                >
                  {group.mentee.firstName} {group.mentee.lastName}
                </Link>

                {group.missingCategories.map((key) => (
                  <Badge key={key} variant="danger" size="sm">
                    <AlertTriangle aria-hidden="true" />
                    No {GOAL_CATEGORY_LABELS[key]} goal
                  </Badge>
                ))}

                <span className="ml-auto text-sm text-muted">
                  Goal Score{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatScore(group.goalTotalScore)}
                  </span>
                </span>
              </summary>

              <div className="border-t border-border">
                {group.goals.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">
                    No goals set yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {group.goals.map((goal) => (
                      <li key={goal.id}>
                        <Link
                          href={`/goals/${goal.id}`}
                          className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-4"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <StatusBadge status={goal.status} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {goal.title}
                              </span>
                              <span className="text-xs text-muted">
                                {goal.category.name}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 sm:w-72 sm:shrink-0">
                            <div className="flex-1">
                              <ProgressBar
                                value={goal.progress}
                                showValue={false}
                              />
                            </div>
                            <GoalScoreBadge score={goal.score} />
                          </div>

                          <span
                            className={cn(
                              "text-xs sm:w-28 sm:shrink-0 sm:text-right",
                              goal.isOverdue
                                ? "font-medium text-rose-500 dark:text-rose-400"
                                : "text-muted",
                            )}
                          >
                            {goal.isOverdue ? "Overdue · " : "Due "}
                            {formatDate(goal.targetDate)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `ProgressBar` rejects `showValue`, confirm the prop name against `src/components/ui/progress.tsx` — the mentee drilldown uses `<ProgressBar value={...} showValue={false} />`, so it exists.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/coach/goals/page.tsx"
git commit -m "feat: coach goals board page grouped by mentee"
```

---

## Task 3: Navigation entry + icon

**Files:**
- Modify: `src/components/app-shell/nav-config.ts`
- Modify: `src/components/app-shell/sidebar.tsx`

**Interfaces:**
- Consumes: the `/coach/goals` route from Task 2; the `NavItem` shape and the `ICONS` map already in these files.
- Produces: a "Goals" link in the Coaching sidebar section.

- [ ] **Step 1: Add the nav item**

In `src/components/app-shell/nav-config.ts`, inside the `user.isCoach` section, insert the Goals item between "Mentees" and "Councils":

```ts
        { href: "/coach/mentees", label: "Mentees", icon: "users" },
        { href: "/coach/goals", label: "Goals", icon: "goal" },
        {
          href: "/coach/groups",
          label: "Councils",
          icon: "users-round",
```

- [ ] **Step 2: Register the `goal` icon**

In `src/components/app-shell/sidebar.tsx`, add `Goal` to the lucide import (keep the list alphabetical — it goes just before `LayoutDashboard`):

```ts
  FileText,
  Goal,
  LayoutDashboard,
```

Then add the map entry in `ICONS` (between `"file-text"` and `"layout-dashboard"`):

```ts
  "file-text": FileText,
  goal: Goal,
  "layout-dashboard": LayoutDashboard,
```

> If `npm run typecheck` reports that `Goal` is not exported by the installed `lucide-react`, fall back to the already-imported `Target`: map `goal: Target` and remove the `Goal` import line. The label still reads "Goals".

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell/nav-config.ts src/components/app-shell/sidebar.tsx
git commit -m "feat: add Goals to the coaching sidebar nav"
```

---

## Task 4: Page content verification

**Files:**
- Modify: `scripts/verify-pages.ts`

**Interfaces:**
- Consumes: the running app + seeded DB; the `expectOnPage(path, cookie, must)` helper and the `dual` session already defined in the file. The `dual` account (`maychell@abundancehub.io`) coaches "Maychell's Circle", which contains Jonah — a mentee with seeded goals — so councils scope must render "Jonah".
- Produces: two assertions guarding the new route.

- [ ] **Step 1: Add the assertions**

In `scripts/verify-pages.ts`, in the `--- coach + mentee (one account, both surfaces) ---` block, after the existing `await expectOnPage("/coach/mentees", dual, ["Priya", "Samuel"]);` line, add:

```ts
  await expectOnPage("/coach/goals", dual, ["Jonah", "Goal Score"]);
  await expectOnPage("/coach/goals?scope=all", dual, ["Goal Score"]);
```

- [ ] **Step 2: Start the dev server (separate terminal)**

Run: `npm run dev`
Wait for "Ready".

- [ ] **Step 3: Run the page checks**

Run: `npx tsx scripts/verify-pages.ts`
Expected: every line prints `ok`, including the two new `/coach/goals` lines, and the script exits 0 ("Every page rendered real seeded data."). If the `/coach/goals` line reports `missing: Jonah`, the seed's council membership differs — open `/coach/goals` in the browser as maychell, note a mentee name actually shown, and use that name in the assertion instead.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-pages.ts
git commit -m "test: verify the coach goals board renders seeded data"
```

---

## Self-Review

**Spec coverage:**
- Route `/coach/goals`, coach-only → Task 2 (`requireCoach`). ✓
- Nav item in Coaching section, icon `goal`, between Mentees and Councils → Task 3. ✓
- Scope toggle (councils default / all), `?scope=` param → Task 2 (`asScope`, two links) + Task 1 (scope resolution). ✓
- Grouped by mentee, collapsible, avatar + name link + Goal Total Score → Task 2 (`<details>` + summary). ✓
- Compact goal rows: status, title→`/goals/[id]`, category, progress+score, overdue-red due date → Task 2. ✓
- Overdue/at-risk-first ordering → Task 1 (`rank`). ✓
- "No goals set yet" slim line → Task 2. ✓
- Missing-category flag (all three required, abandoned excluded) → Task 1 (`missingCategories`) + Task 2 (badges). ✓
- Bounded queries, reuse `toSummary`/`scoreCategories`/`weightGoalScore` → Task 1. ✓
- Access via existing RBAC helpers, no new surface → Task 1 (`coachMenteeIds`/`visibleUserIds`). ✓
- Read-only → no server actions added anywhere. ✓
- Out of scope (filters/search) → not built. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `MenteeGoalsGroup` fields (`mentee`, `goalTotalScore`, `goals`, `missingCategories`) defined in Task 1 are the exact fields read in Task 2. `listMenteeGoals(actor, { scope })` signature matches its call site. `scope` union `"councils" | "all"` consistent across Task 1 and `asScope` in Task 2. ✓
