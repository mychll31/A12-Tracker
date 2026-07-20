# Mentee Goals Board — Design

**Date:** 2026-07-20
**Status:** Approved, pending implementation plan

## Problem

A coach who wants to review their mentees' goals must open each mentee's
profile (`/coach/mentees/[id]`) and click the Goals tab, one mentee at a time.
For a coach with a full roster this is a lot of clicking. They want a single
page that shows every mentee's goals at once.

## Solution

A new read-only **Goals Board** at `/coach/goals` that lists the goals of all
the coach's mentees on one page, grouped by mentee.

### Route & navigation

- New route: `/coach/goals`.
- Coach-only. Guarded by `requireCoach()`, matching the other coach pages.
- Added to the **Coaching** section of `src/components/app-shell/nav-config.ts`,
  placed between "Mentees" and "Councils". Label: "Goals". Icon: `goal`.

### Scope toggle

- A segmented control / tabs at the top with two options:
  - **My councils** (default) — mentees in the coaching groups this coach leads.
  - **All mentees** — every mentee the coach can view (the same set as the
    current Mentees list, via `visibleUserIds`).
- Backed by a `?scope=` search param (`councils` default, `all`) so the view is
  linkable and refresh-safe.

### Layout — grouped by mentee

- Each mentee renders as a collapsible section:
  - Header: avatar + name (links to `/coach/mentees/[id]`), and the mentee's
    **Goal Total Score** on the right.
  - Body: one compact row per goal:
    - status dot,
    - title (links to `/goals/[id]`),
    - category name,
    - progress bar + score,
    - due date, shown in red when overdue.
- Goals within a mentee are ordered overdue/at-risk first, then by ascending
  due date.
- A mentee with no goals shows a slim "No goals set yet" line rather than an
  empty block.

### Missing-category flag

Because an empty required category scores zero in this app, each mentee section
surfaces a subtle flag for any required category they have no goal in
(e.g. "⚠ No Contribution goal"). This is the exact gap the score penalizes and
is computed for free from the goals already loaded.

## Data

A new server function in `src/server/goals.ts`:

```ts
listMenteeGoals(actor: SessionUser, opts: { scope: "councils" | "all" }):
  Promise<MenteeGoalsGroup[]>
```

where each `MenteeGoalsGroup` carries the mentee's display identity, their
Goal Total Score, their `GoalSummary[]`, and their missing required categories.

Efficiency requirement: the function must run in a bounded number of queries
regardless of mentee count — **no per-mentee query loop**. Approach:

1. Resolve the mentee id set for the scope:
   - `councils` → members of groups where `coachId === actor.id`.
   - `all` → `visibleUserIds(actor)`.
2. Fetch mentee identities (id, name, avatar) in one `findMany`.
3. Fetch **all** their goals in a single `where: { userId: { in: ids } }` query,
   including `category` and `tasks` (same include shape `listGoals` uses).
4. Group goals by `userId` in memory and map each through the existing
   `toSummary` helper.
5. Compute each mentee's category scores and Goal Total Score in memory with the
   existing `scoreCategories` / `weightGoalScore` helpers — no extra queries.
6. Derive missing required categories from the grouped goals.

This mirrors how `cardsForUserIds` in `src/server/mentees.ts` already batches
scoring for a whole list in a fixed number of queries.

## Access & security

- The page requires a coach session.
- Scope resolution reuses the existing RBAC helpers (`visibleUserIds`,
  coach-group membership), so a coach never sees a mentee they aren't permitted
  to view. No new access surface is introduced — the board only aggregates data
  the coach can already reach one profile at a time.
- Read-only. All editing continues to happen on the existing goal and profile
  pages the rows link to.

## Out of scope (v1)

- Category/status filters and search. The scope toggle plus collapsible sections
  cover the stated need; filters can be added later if rosters grow large.
- Any write/edit actions on this page.

## Files touched

- `src/app/(app)/coach/goals/page.tsx` — new page (server component).
- Small client component(s) for the scope toggle and/or collapsible sections as
  needed, following existing patterns in the coach area.
- `src/server/goals.ts` — new `listMenteeGoals` function and its return type.
- `src/components/app-shell/nav-config.ts` — new nav item.

## Update 2026-07-20: Filters & back navigation

Follow-up on the shipped board. Two additions.

### Filters

The `My councils / All mentees` toggle is replaced by a **filter bar** — a GET
form whose state lives entirely in the URL (shareable, refresh-safe), matching
the Mentees page pattern. Filters:

1. **Council** — one dropdown: *All mentees* (default; `council` unset or
   `council=all`) · *All my councils* (`council=`, empty string) · each council
   the coach leads (by id). A bare `/coach/goals` from the nav lands on all
   mentees.
2. **Mentee** — `search` text, matched against first/last name.
3. **Category** — All · Personal · Professional · Contribution (`category`).
4. **Score condition** — an operator `op` (`gte` ≥ · `gt` > · `eq` = · `lt` <)
   plus a `score` percentage. "Any" (unset) means no score filter.

A single Category selector serves both the category filter and the score
condition's category — so "personal goal at 100%" is Category *Personal* +
`op=gte` + `score=100`. One condition at a time.

Combination rules:
- **Council + Mentee** choose the set of mentees.
- **Category + Score** filter each mentee's displayed goal rows.
- When a goal-level filter (category or score) is active, mentees with no
  matching goal drop out of the list. Otherwise every mentee shows, as before.
- A mentee's **Goal Total Score** and missing-category flags are still computed
  from *all* their goals — filtering is a display lens, never a recomputation.
- A score condition excludes abandoned goals (score `null`).

`listMenteeGoals(actor, filter)` takes the filter object; council resolution
reuses `coachMenteeIds` (all my councils), `groupMemberIds` (a specific council
the coach leads), and the org-wide MENTEE query (all mentees).

### Back navigation

Board rows carry `?from=<board-url-with-filters>` when they link to a goal
(`/goals/[id]`) or a mentee (`/coach/mentees/[id]`). Those two pages read
`from`; when it is a `/coach/goals` path (validated by prefix, so it cannot be
abused as an open redirect) the top link becomes **"← Back to Goals"** and
returns to the board with filters intact. With no valid `from`, the existing
links ("Back to my goals" / "← All mentees") are unchanged.

### Additional files touched

- `src/app/(app)/goals/[id]/page.tsx` — read `from`, context-aware back link.
- `src/app/(app)/coach/mentees/[id]/page.tsx` — read `from`, context-aware back
  link.
