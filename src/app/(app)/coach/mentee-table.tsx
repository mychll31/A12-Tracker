import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Flame, Users } from "lucide-react";

import {
  Avatar,
  Badge,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { formatRelative } from "@/lib/dates";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";

/**
 * The mentee roster, shared by the coach dashboard and a group's detail page so
 * the same person reads identically on both.
 */

export type MenteeRow = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  groupName: string | null;
  overallScore: number;
  currentStreak: number;
  goalsCompleted: number;
  goalsTotal: number;
  taskCompletionRate: number;
  lastActiveAt: Date | null;
  isAtRisk: boolean;
};

export interface MenteeTableProps {
  mentees: MenteeRow[];
  /** Redundant inside a single group, where every row shares one group. */
  showGroup?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (mentee: MenteeRow) => ReactNode;
}

export function MenteeTable({
  mentees,
  showGroup = true,
  emptyTitle = "No mentees yet",
  emptyDescription = "Once a mentee joins one of your councils they appear here, with their score and streak.",
  actions,
}: MenteeTableProps) {
  if (mentees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <Table>
      <caption className="sr-only">
        Mentees, ranked by overall score, highest first.
      </caption>
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Mentee</TH>
          {showGroup ? <TH>Council</TH> : null}
          <TH className="text-right">Score</TH>
          <TH className="text-right">Streak</TH>
          <TH className="text-right">Goals</TH>
          <TH className="text-right">Tasks</TH>
          <TH>Last active</TH>
          <TH>
            <span className="sr-only">Status</span>
          </TH>
          {actions ? <TH className="text-right">Actions</TH> : null}
        </TR>
      </THead>

      <TBody>
        {mentees.map((mentee) => {
          const tone = scoreTone(mentee.overallScore);
          const href = `/coach/mentees/${mentee.id}`;

          return (
            <TR key={mentee.id} className="group">
              <TD>
                <Link
                  href={href}
                  className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Avatar
                    src={mentee.avatarUrl}
                    firstName={mentee.firstName}
                    lastName={mentee.lastName}
                    size="sm"
                  />
                  <span className="font-medium text-foreground group-hover:text-primary">
                    {mentee.firstName} {mentee.lastName}
                  </span>
                </Link>
              </TD>

              {showGroup ? (
                <TD className="text-muted">{mentee.groupName ?? "—"}</TD>
              ) : null}

              <TD
                className={cn(
                  "text-right font-semibold tabular-nums",
                  TONE_TEXT[tone],
                )}
              >
                {formatScore(mentee.overallScore)}
              </TD>

              <TD className="text-right tabular-nums text-muted-strong">
                <span className="inline-flex items-center gap-1">
                  <Flame
                    className={cn(
                      "size-3.5",
                      mentee.currentStreak > 0
                        ? "text-amber-500"
                        : "text-muted/40",
                    )}
                    aria-hidden="true"
                  />
                  {mentee.currentStreak}
                </span>
              </TD>

              <TD className="text-right tabular-nums text-muted-strong">
                {mentee.goalsCompleted}/{mentee.goalsTotal}
              </TD>

              <TD className="text-right tabular-nums text-muted-strong">
                {Math.round(mentee.taskCompletionRate)}%
              </TD>

              <TD className="whitespace-nowrap text-muted">
                {mentee.lastActiveAt
                  ? formatRelative(mentee.lastActiveAt)
                  : "never"}
              </TD>

              <TD>
                {mentee.isAtRisk ? (
                  <Badge variant="danger" size="sm">
                    <AlertTriangle aria-hidden="true" />
                    At risk
                  </Badge>
                ) : null}
              </TD>

              {actions ? (
                <TD>
                  <div className="flex justify-end">{actions(mentee)}</div>
                </TD>
              ) : null}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
