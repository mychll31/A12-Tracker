# Running Abundance Hub locally

Use a local or hosted Postgres database. Vercel deployments use the same
Postgres-backed Prisma schema.

```bash
npm install
npm run setup
npm run dev
```

Open <http://localhost:3000> and sign in as `maychell@abundancehub.io` with the
password `Abundance123!`.

If that worked, you can stop reading. The rest of this page is the detail.

---

## The one thing you have to create

**`.env.local`**, in the project root, with two lines:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
AUTH_SECRET="paste-the-output-of-the-command-below"
```

Generate a real `AUTH_SECRET` — it signs the session cookie:

```bash
openssl rand -base64 32
```

> **Why `.env.local` and not `.env`?**
> `prisma.config.ts` loads env through `@next/env`, the same loader Next uses. So
> `.env.local` is read by **both** the app and the Prisma CLI — one file covers
> `npm run dev`, `npm run db:seed` and everything else. It's gitignored, so it
> never gets committed.

That's the whole configuration. `DATABASE_URL` points at Postgres; `npm run setup`
applies the migrations and seeds the database.

---

## What `npm run setup` does

```
prisma migrate deploy   # create/update the database tables
prisma generate         # regenerate the typed client
prisma db seed          # 13 members, 38 goals, ~60 days of history
```

It is **idempotent** — re-run it as often as you like, nothing duplicates.

To wipe and start over:

```bash
npm run db:reset        # drops the configured database schema, re-migrates, re-seeds
```

---

## Sign in

Every seeded account uses the password **`Abundance123!`**.

| Email                      | Roles              | Why this one is worth a look                                          |
| -------------------------- | ------------------ | --------------------------------------------------------------------- |
| `maychell@abundancehub.io` | Coach **+** Mentee | One account, both roles — coaches her own circle, mentored in Diana's |
| `diana@abundancehub.io`    | Coach              | Coaches Maychell, so a peer coach appears among her own mentees        |
| `raviel@abundancehub.io`   | Coach              | A third circle, so the coach leaderboard has something to rank         |
| `admin@abundancehub.io`    | Admin + Coach      | Unrestricted — users, groups, core tasks                               |
| `jonah@abundancehub.io`    | Mentee             | A plain mentee — watch the visibility rules bite                       |

Sign in as **Jonah** and you only ever see his own circle: no organization
leaderboard, no other coach's mentees. Sign in as **Maychell** and you get the
mentee dashboard *and* the coaching views at once, on one account.

---

## Where to look first

| Route           | What it is                                                       |
| --------------- | ---------------------------------------------------------------- |
| `/`             | The Abundance 12 landing page — public, no sign-in               |
| `/onboarding`   | The 5-step wizard a brand-new signup is sent to                  |
| `/dashboard`    | The mentee's day: score, today's core tasks, goals, streak       |
| `/goals`        | Goal Total Score and the three realms                            |
| `/coach`        | The coach's roster, at-risk mentees first                        |
| `/organization` | Org-wide stats and coach rankings                                |
| `/leaderboards` | Six boards — group, coaches, org, core tasks, goals, consistency |
| `/admin`        | Users, groups, core tasks, and the recalculate job               |

To see the onboarding wizard, register a new account at `/register` — a fresh
signup has `onboardedAt = NULL` and is sent straight there.

Browse the raw data any time with `npm run db:studio`.

---

## Checking it actually works

```bash
npm run verify              # scoring engine + data invariants (no server needed)
npm run verify:onboarding   # the wizard, end to end — what it really writes

npm run dev                 # the next two drive the running app over HTTP
npm run verify:rbac         # permissions — who may see and edit whom
npm run verify:pages        # every screen, every role, renders real data
```

`npm run verify` is the interesting one. It proves the things the product is
actually about: a coach's score really *is* the average of their mentees, every
mentee holds all three goal categories, every goal carries a task list, and one
mentee belongs to exactly one circle.

---

## Everyday commands

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Development server                              |
| `npm run build`      | Production build                                |
| `npm run typecheck`  | `tsc --noEmit`                                  |
| `npm run lint`       | ESLint                                          |
| `npm run db:seed`    | Re-seed (idempotent)                            |
| `npm run db:reset`   | **Drops the configured schema**, re-migrates, re-seeds |
| `npm run db:studio`  | Browse the data in Prisma Studio                |
| `npm run db:migrate` | Create a migration after editing the schema     |

---

## Troubleshooting

### `DATABASE_URL is not set`

You haven't created `.env.local`. See [above](#the-one-thing-you-have-to-create),
then **restart `npm run dev`** — Next reads env files only at startup, so a running
server won't pick up a new one.

### Every page 500s, or "relation does not exist"

You ran `npm run dev` before `npm run setup`, so the database has no tables yet:

```bash
npm run setup
```

### Port 3000 is taken

```bash
npm run dev -- -p 3001
```

### I want to start completely fresh

```bash
npm run db:reset
```

---

## A note on deploying

The Vercel project uses Prisma Postgres. `vercel.json` runs `npm run
vercel-build`, which generates Prisma, applies migrations, and builds Next.js.
Seed the database once after creating a new deployment database.

---

## Optional

`CRON_SECRET` protects `POST /api/cron/recalculate` — the nightly job that freezes
score snapshots, captures leaderboard ranks and runs the notification sweep. Leave
it unset locally: the route then accepts an authenticated admin instead, which is
what the **Recalculate** button on `/admin` uses.
