# Abundance Hub

A coaching, accountability and personal-growth platform. Mentees set goals across
three areas of life, complete four daily disciplines, and file a daily
reflection. Coaches see all of it. Everything rolls up into a score, and the
scores roll up into leaderboards.

## Run it

The app uses Postgres. For Vercel, connect a Prisma Postgres resource or set
`DATABASE_URL` to a hosted Postgres connection string.

**1.** Create `.env.local` in the project root:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
AUTH_SECRET="run: openssl rand -base64 32"
```

**2.** Go:

```bash
npm install
npm run setup    # migrate + generate + seed ~60 days of history
npm run dev
```

Open <http://localhost:3000>. Full detail — and what to do when something breaks —
in **[docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md)**.

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

## The front door

`/` is the **Abundance 12** landing page — public, video hero, navy-and-gold. It is
deliberately *not* the app's chrome: the application is violet-on-slate and obeys a
light/dark toggle, while the brand is always dark. The two palettes are kept apart
by scoping the brand under `.a12` (`src/app/(brand)/brand.css`), so neither can
repaint the other.

`/onboarding` is the five-step wizard a new account is sent to on signup. Until it
is finished, `users.onboardedAt` is `NULL` and the app shell bounces them back to
it — a brand-new member has no goals, no circle and no check-in, and letting them
straight in would show nothing but empty states and a score of zero.

Three places where the implementation departs from the mockup, each a deliberate
call:

| Design said | We built | Why |
| --- | --- | --- |
| Toggle which daily disciplines you'll do | All four, as a **commitment** | Core tasks are organization-wide and the Core Task Score divides by a shared expected count. Opting into a single task would let someone score 100% as easily as a person doing four. |
| A goal is just a title | A title **and its first task** | A goal's score *is* the share of its tasks that are done. A goal with no tasks has nothing to be scored from and would sit at zero forever. |
| Pick your own circle | Self-join, **once**, and only if you have none | Normally only a coach places a mentee. The wizard is the one case where that is wrong, so the exception is narrow and re-checked server-side. |

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
| `npm run db:deploy` | Apply migrations in production        |
| `npm run db:seed`   | Re-seed (idempotent — safe to re-run) |
| `npm run db:reset`  | Drop, re-migrate and re-seed          |
| `npm run db:studio` | Browse the database                   |

## Verifying it works

Three checks, all read-only against the seeded database:

```bash
npm run verify              # scoring engine + data invariants (no server needed)
npm run verify:onboarding   # the wizard, end to end — what it actually writes
npm run dev                 # the next two drive the running app over HTTP
npm run verify:rbac         # permission rules — who can see and edit whom
npm run verify:pages        # every screen, every role, renders real data
```

`verify` proves the things the spec is really about: a coach's score *is* the
average of their mentees, every mentee carries all three goal categories, one
mentee belongs to exactly one group, and Maychell holds both roles on a single
account. `verify:rbac` drives the API as a mentee, a coach, a delegated coach and
an admin, and asserts the 403s land where they should.

## Configuration

Two variables, in `.env.local`.

| Variable       | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string.                                    |
| `AUTH_SECRET`  | Signs the session JWT. Generate with `openssl rand -base64 32` |
| `CRON_SECRET`  | Optional bearer token for `POST /api/cron/recalculate`         |

## Deploying

Vercel is configured through `vercel.json` to run `npm run vercel-build`, which
generates Prisma, applies migrations, and builds Next.js. Set `DATABASE_URL` and
`AUTH_SECRET` in Vercel before deploying.

Once the deployment target has a database, seed it once to get the demo
organization and accounts:

```bash
DOTENV_CONFIG_PATH=.env.production.local npm run db:seed
```

## The nightly job

`POST /api/cron/recalculate` freezes score snapshots, captures leaderboard ranks,
and runs the notification sweep. It is idempotent, so a retry is harmless. The
**Admin → Recalculate** button does the same work on demand.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it fits together, the scoring
  formula, the permission model, and the Postgres path.
