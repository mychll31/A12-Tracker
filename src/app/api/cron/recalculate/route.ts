import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { persistSnapshots } from "@/lib/scoring";
import { captureLeaderboards } from "@/server/leaderboards";
import { runNotificationSweep } from "@/server/notifications";

import { errorResponse, unauthorized } from "../../_lib/http";

/**
 * The nightly job.
 *
 * Two ways in, and never both at once:
 *
 *   CRON_SECRET set   — a bearer token, and nothing else. A signed-in admin's
 *                       cookie is *not* accepted, so production has exactly one
 *                       door.
 *   CRON_SECRET unset — an authenticated admin, so a local dev server can run
 *                       the job without inventing a secret first.
 *
 * Every step is idempotent: snapshots and captures upsert on today's day bucket,
 * and the sweep dedupes on (userId, type, link) within the day. A retry after a
 * half-finished run is safe.
 */
async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }

  const user = await getCurrentUser();
  return user?.isAdmin ?? false;
}

export async function POST(request: Request) {
  if (!(await authorize(request))) return unauthorized();

  try {
    const organizations = await db.organization.findMany({
      select: { id: true },
    });

    const totals = {
      organizations: organizations.length,
      users: 0,
      coaches: 0,
      groups: 0,
      leaderboardRows: 0,
      notifications: 0,
    };

    // Sequential on purpose: each org's sweep reads the leaderboard rows the
    // capture just wrote, so the order inside an org matters.
    for (const { id } of organizations) {
      const snapshots = await persistSnapshots(id);
      const rows = await captureLeaderboards(id);
      const created = await runNotificationSweep(id);

      totals.users += snapshots.users;
      totals.coaches += snapshots.coaches;
      totals.groups += snapshots.groups;
      totals.leaderboardRows += rows;
      totals.notifications += created;
    }

    return NextResponse.json(totals);
  } catch (error) {
    return errorResponse(error);
  }
}
