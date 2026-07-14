# Architecture

How Abundance Hub is put together, and why.

## Stack

| Layer     | Choice                                   |
| --------- | ---------------------------------------- |
| Framework | Next.js 16 (App Router, React 19, RSC)   |
| Language  | TypeScript, strict                       |
| Database  | Prisma 7 + SQLite (Postgres-ready)       |
| Styling   | Tailwind v4, CSS-first tokens            |
| Auth      | bcrypt + HS256 JWT in an httpOnly cookie |
| Charts    | Recharts                                 |

## The shape of the code

```
src/
  lib/          pure domain logic — no HTTP, no React
    db.ts           Prisma singleton (swap the adapter to move to Postgres)
    domain.ts       every status/category/board code + the scoring weights
    dates.ts        the UTC day-bucket convention
    auth.ts         passwords, session cookie, getCurrentUser/requireUser
    rbac.ts         who may see what, who may change what
    scoring.ts      the scoring engine
  server/       data access — one module per feature, RBAC enforced at every entry
  components/   ui/ (primitives) · charts/ · app-shell/
  app/          routes: (auth) public · (app) authenticated · api/ REST
```

The dependency rule runs one way: `app → server → lib`. A page never touches
`db` directly, and `lib` never imports from `server` or `app`.

## Four decisions worth knowing

### 1. Scores are computed live; snapshots exist only for history

`src/lib/scoring.ts` has two halves. `compute*` derives every score from source
rows on read — so a mentee who ticks a task sees their score move immediately,
with no job to wait for and no cache to invalidate. `persist*` writes the
snapshot tables (`score_snapshots`, `coach_score_snapshots`, …) purely so the
trend charts have a yesterday to plot.

Nothing reads a snapshot for a *current* value. That split is what stops "my
score is wrong" from ever being a real bug.

Live computation costs queries, so `computeScoresForUsers` batches: a
leaderboard of sixty people is four queries, not sixty.

### 2. The scoring formula

Overall is the weighted sum of three components, each on 0–100:

```
overall = 0.5 × goals + 0.3 × coreTasks + 0.2 × consistency
```

- **Goals** — see below. The three categories, equally weighted, combine into the
  **Goal Total Score**.
- **Core tasks** — completed ÷ expected across a trailing 30 days, clamped so the
  window never predates the day the user joined.
- **Consistency** — 60% streak (saturating at 30 days), 40% check-in rate.

A day counts toward a streak if the user did *anything* — one core task, or a
check-in. The current streak may end today **or yesterday**; without that grace
every streak in the organization would reset at midnight UTC and claw its way
back as people got to their tasks. A streak should not break until a day has
actually been missed.

A coach's score is the average of their mentees' overall scores — a coach is
measured by the people they lift, not by their own task list.

### 2b. A goal is scored by the work inside it

Every goal owns a **task list** (`goal_tasks`) — its to-do list — and the goal's
score *is* the weighted share of those tasks that are done. `scoreGoal()` in
`src/lib/scoring.ts` is the only place that decides it:

```
goal score  =  Σ weight(done tasks) / Σ weight(all tasks)  × 100
```

`weight` defaults to 1, so an unweighted goal is simply "percent of tasks
complete"; a heavier task can be made to count for more.

Three rules sit on top:

- **COMPLETED → 100**, whatever the tasks say. Somebody who finishes the goal
  without ticking the last box has still finished the goal.
- **ABANDONED → withdrawn** from every average, not scored zero. If dropping a
  goal you have outgrown permanently damaged your score, nobody would ever drop
  one honestly.
- **Creating a goal requires at least one task** — enforced in `createGoal()`, so
  the API and the form obey the same rule. A goal with no tasks would have
  nothing to be scored from and would sit at zero forever.

`goals.progress` is a cached mirror of that score, so lists and charts can read
one column instead of joining the task list on every row. `deriveProgress()`
uses the identical weighting, which is what stops a progress bar and a score from
telling a user two different stories about the same goal.

**Category score** = the mean of that category's goal scores.
**Goal Total Score** = the three categories combined, equally weighted — the
number that carries 50% of the Overall Score.

All three categories are **required**, and a category holding no goal **scores
zero** rather than being skipped. That is deliberate and load-bearing: never
setting a contribution goal is precisely the gap the score exists to surface, so
the product names it (`missingCategories`, `requiredGoalGaps()`) instead of
quietly docking the number.

### 3. Read permission and write permission are different questions

`src/lib/rbac.ts` answers them separately, because the spec does:

- A **mentee** sees only their own coaching group — enforced by
  `visibleUserIds()`, which every list query scopes through. They are never
  offered the organization or coach leaderboards, and `getLeaderboard` throws even
  if one is requested directly. The menu and the door are locked independently.
- A **coach** *reads* every group, member and score in the organization —
  comparing yourself against another coach's group is the entire point of the
  coach leaderboard. But a coach *writes* only to their own mentees. Editing
  anyone else's requires a row in `coach_delegations`: explicit, auditable,
  expirable.
- Coaching notes are the deliberate exception — any coach may write a note about
  any mentee they can see. An observation is not an edit.
- **Admins** are unrestricted.

`src/middleware.ts` is *not* the security boundary. It only checks that a cookie
exists, so an anonymous visitor is bounced without a database hit. Every page and
action independently calls `requireUser()`, which verifies the JWT signature and
**re-reads roles from the database** — so revoking a role takes effect on the next
request rather than whenever the token happens to expire. Forging the cookie buys
an attacker a redirect to a page that then rejects them.

### 4. One account, many roles

The spec's headline requirement — Maychell coaches one group while being mentored
in another — falls out of the schema instead of being special-cased.
`users ↔ user_roles ↔ roles` is many-to-many, and `coach_groups.coachId` is
independent of `group_memberships.menteeId`. A user holding both roles simply gets
both navigation sections and both dashboards. There is no "switch account",
because there is only one account.

## Conventions

**Day buckets.** Every daily record — a core-task completion, a check-in, a
snapshot — is keyed to midnight UTC of its calendar day (`dayKey()` in
`src/lib/dates.ts`). Keying on UTC rather than local time keeps the
`@@unique([userId, date])` constraints and the streak arithmetic stable no matter
where the server runs.

**Missed days are absences.** Completing a core task inserts a row; un-ticking it
*deletes* the row. There are no `completed: false` tombstones — a day is missed
precisely because nothing is there. History queries re-expand the window with
`lastNDays()` so a gap renders as a gap rather than vanishing.

**Codes are TEXT, narrowed in one place.** SQLite has no enum type, so statuses
live as TEXT and `src/lib/domain.ts` narrows them back into union types on the way
out. It is also the only file to touch when adding a status.

**Note bodies are sanitized on write.** `sanitizeNoteHtml()` in
`src/server/notes.ts` is a strict allow-list: 13 tags, no attributes except a
scheme-checked `href`. Rendering can trust the database because writing already
did not.

## Moving to Postgres

1. `prisma/schema.prisma` — change the datasource provider to `postgresql`.
2. `src/lib/db.ts` — swap `PrismaBetterSqlite3` for `PrismaPg`.
3. `DATABASE_URL` — point it at the new database.

No model or query changes: the schema deliberately avoids SQLite-only constructs,
and nothing above `db.ts` knows which engine is underneath. Native `enum` types
become available at that point, but nothing requires them.

## The nightly job

`POST /api/cron/recalculate` runs three things per organization:

1. `persistSnapshots()` — freeze today's scores for tomorrow's charts.
2. `captureLeaderboards()` — freeze today's ranks, so "you climbed 3 places" has
   something to compare against.
3. `runNotificationSweep()` — missed tasks, goal deadlines, check-in reminders,
   leaderboard movement, newly unlocked achievements.

All three are idempotent (upserts keyed on the day bucket), so a failed run is
safe to retry. The endpoint is bearer-token protected via `CRON_SECRET`; with no
secret set, an authenticated admin may trigger it — which is what the button on
`/admin` does.
