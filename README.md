# Abundance Hub

A coaching, accountability and personal-growth platform. Mentees set goals across
three areas of life, complete four daily disciplines, and file a daily
reflection. Coaches see all of it. Everything rolls up into a score, and the
scores roll up into leaderboards.

## Run it

```bash
npm install
cp .env.example .env     # SQLite — no database server needed
npm run setup            # migrate + generate + seed 60 days of history
npm run dev
```

Open <http://localhost:3000>.

### Seeded accounts

Every account uses the password **`Abundance123!`**.

| Email                      | Roles              | Why it's interesting                                                |
| -------------------------- | ------------------ | ------------------------------------------------------------------- |
| `maychell@abundancehub.io` | Coach **+** Mentee | The dual-role case — coaches her own circle, is mentored in Diana's |
| `diana@abundancehub.io`    | Coach              | Coaches Maychell, so a peer coach appears as one of her mentees      |
| `raviel@abundancehub.io`   | Coach              | A third group, so the coach leaderboard means something              |
| `admin@abundancehub.io`    | Admin + Coach      | Unrestricted — user management, groups, core tasks                   |

Sign in as a mentee from any group to watch the containment rules bite: they see
their own group's leaderboard and nobody else's.

## What's in it

**Goals** — every mentee carries a Personal, a Professional and a Contribution
goal. Each has milestones, a progress ledger, proof attachments, and a coach
comment thread (comments can be marked coach-only). Progress derives from
milestones when a goal has them.

**Core tasks** — Meditation, Coaching Call, Exercise, Everyday Learning. Tick them
daily; miss a day and it shows. Streaks, completion history, per-task breakdowns,
and back-dating so a missed log can be filled in.

**Daily check-in** — wins, challenges, lessons, gratitude, tomorrow's focus, and a
mood. Coaches can review and reply.

**Scoring** — the centre of the product. Goal scores per category, a core-task
score, a consistency score, an overall score; coach scores averaged from their
mentees; an organization score from everyone. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the formula and why it is shaped
that way.

**Leaderboards** — six: group, coaches, organization, core tasks, goal completion,
consistency. Ranks are captured daily, so a board can tell you that you climbed
three places.

**Dashboards** — one for mentees, one for coaches (with a "needs attention" panel
that surfaces at-risk mentees first), one for the organization.

**Coaching notes** — rich text, private or shared, with action items and follow-up
dates.

**Notifications, achievements, analytics, admin** — the rest of the spec, all
wired to the same scoring engine.

## Commands

| Command             | Does                                  |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Development server                    |
| `npm run build`     | Production build                      |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm run db:seed`   | Re-seed (idempotent — safe to re-run) |
| `npm run db:reset`  | Drop, re-migrate and re-seed          |
| `npm run db:studio` | Browse the database                   |

## Verifying it works

Three checks, all read-only against the seeded database:

```bash
npm run verify         # scoring engine + data invariants (no server needed)
npm run dev            # the next two drive the running app over HTTP
npm run verify:rbac    # permission rules — who can see and edit whom
npm run verify:pages   # every screen, every role, renders real data
```

`verify` proves the things the spec is really about: a coach's score *is* the
average of their mentees, every mentee carries all three goal categories, one
mentee belongs to exactly one group, and Maychell holds both roles on a single
account. `verify:rbac` drives the API as a mentee, a coach, a delegated coach and
an admin, and asserts the 403s land where they should.

## Configuration

| Variable       | Purpose                                                              |
| -------------- | -------------------------------------------------------------------- |
| `DATABASE_URL` | `file:./dev.db` for SQLite; a Postgres URL works after the swap below |
| `AUTH_SECRET`  | Signs the session JWT. Generate with `openssl rand -base64 32`        |
| `CRON_SECRET`  | Optional. Bearer token for `POST /api/cron/recalculate`               |

SQLite is the default so the app runs with nothing installed. Moving to Postgres
is a three-line change — the datasource provider, the Prisma adapter in
`src/lib/db.ts`, and the URL. No model or query changes; see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#moving-to-postgres).

## The nightly job

`POST /api/cron/recalculate` freezes score snapshots, captures leaderboard ranks,
and runs the notification sweep. It is idempotent, so a retry is harmless. The
**Admin → Recalculate** button does the same work on demand.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it fits together, the scoring
  formula, the permission model, and the Postgres path.
