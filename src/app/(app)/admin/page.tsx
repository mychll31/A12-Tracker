import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  Network,
  ShieldCheck,
  Target,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getOrgDashboard } from "@/server/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatCard,
} from "@/components/ui";
import { scoreTone } from "@/lib/utils";

import { MaintenancePanel } from "./maintenance-panel";

export const metadata: Metadata = { title: "Administration" };

const SECTIONS = [
  {
    href: "/admin/users",
    icon: UserCog,
    title: "Users",
    description:
      "Create members, edit profiles, grant roles, reset passwords and deactivate accounts.",
  },
  {
    href: "/admin/groups",
    icon: Network,
    title: "Coach groups",
    description:
      "Open groups, move mentees between them, and delegate edit access between coaches.",
  },
  {
    href: "/admin/core-tasks",
    icon: ListChecks,
    title: "Core tasks",
    description:
      "Define the daily disciplines every member in the organization is measured against.",
  },
];

export default async function AdminOverviewPage() {
  const user = await requireAdmin();
  const { totals } = await getOrgDashboard(user);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Administration
        </h1>
        <p className="mt-2 text-sm text-muted">
          The shape of the organization at a glance, and the controls that keep
          it running.
        </p>
      </header>

      <section aria-label="Organization totals">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total users"
            value={totals.totalMembers}
            icon={Users}
          />
          <StatCard label="Coaches" value={totals.coaches} icon={UsersRound} />
          <StatCard label="Mentees" value={totals.mentees} icon={Target} />
          <StatCard
            label="Active this week"
            value={totals.activeMembers}
            icon={ShieldCheck}
          />
          <StatCard
            label="Org score"
            value={totals.orgScore}
            tone={scoreTone(totals.orgScore)}
            icon={Target}
          />
        </div>
      </section>

      <section aria-label="Administration sections">
        <div className="grid gap-4 md:grid-cols-3">
          {SECTIONS.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-card border border-border bg-surface-raised p-5 card-shadow transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span
                className="flex size-9 items-center justify-center rounded-lg bg-primary-soft"
                aria-hidden="true"
              >
                <Icon className="size-4 text-primary" />
              </span>

              <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {title}
                <ArrowRight
                  className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <MaintenancePanel />

      <Card>
        <CardHeader>
          <CardTitle>Where the org score comes from</CardTitle>
          <CardDescription>
            Half of every score is goals, three-tenths is daily core tasks, and
            the last fifth is consistency — streaks and check-in cadence.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-sunken p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Goal completion rate
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {totals.goalCompletionRate}%
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-sunken p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Core task completion
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {totals.taskCompletionRate}%
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
