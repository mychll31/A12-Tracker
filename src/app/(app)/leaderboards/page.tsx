import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";

import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import {
  RankMedalImage,
  RANK_BAR,
  RANK_TEXT,
} from "@/components/ui/rank-medal";
import { requireUser } from "@/lib/auth";
import {
  LEADERBOARD_DESCRIPTIONS,
  rankForPercent,
  type LeaderboardBoard,
} from "@/lib/domain";
import { cn, formatScore, ordinal, scoreTone, TONE_TEXT } from "@/lib/utils";
import {
  availableBoards,
  getLeaderboard,
  getUserRank,
  type BoardScope,
  type LeaderboardRow,
} from "@/server/leaderboards";

import { AccessNotice, guard } from "../_components/guard";

export const metadata: Metadata = { title: "Leaderboards" };

/**
 * The boards whose metric is a 0-100 score. `scoreTone()` is documented for that
 * scale and no other, so the count boards — goals completed, streak days — are
 * left neutral rather than painting "3 goals" critical-red.
 */
const SCORE_SCALE: ReadonlySet<LeaderboardBoard> = new Set<LeaderboardBoard>([
  "GROUP",
  "COACH",
  "ORGANIZATION",
  "CORE_TASK",
]);

const MEDAL: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 ring-amber-400/40 dark:text-amber-300",
  2: "bg-slate-400/20 text-slate-600 ring-slate-400/50 dark:text-slate-300",
  3: "bg-amber-700/15 text-amber-700 ring-amber-700/40 dark:text-amber-500",
};

/** A coach is offered one GROUP board per group, so the board alone is not a key. */
const keyOf = (scope: BoardScope) => `${scope.board}:${scope.scopeId}`;

function hrefFor(scope: BoardScope): string {
  return `/leaderboards?board=${scope.board}&scope=${encodeURIComponent(scope.scopeId)}`;
}

function RankMedal({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ring-1",
        MEDAL[rank] ?? "bg-surface-sunken text-muted ring-border",
      )}
    >
      {rank}
    </span>
  );
}

function DeltaChip({ delta }: { delta: number | null }) {
  // `null` is not zero: the board has never been captured before, so this member
  // has no previous position to have moved from.
  if (delta === null) {
    return <span className="text-xs text-muted">new</span>;
  }

  if (delta === 0) {
    return <span className="text-xs font-medium text-muted">—</span>;
  }

  const climbed = delta > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        climbed
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      <span aria-hidden="true">{climbed ? "▲" : "▼"}</span>
      {Math.abs(delta)}
      <span className="sr-only">
        {climbed ? "up" : "down"} {Math.abs(delta)} places
      </span>
    </span>
  );
}

function Row({ row, board }: { row: LeaderboardRow; board: LeaderboardBoard }) {
  // The illustrated tier medal + progress bar only make sense on the 0-100 score
  // boards; the count boards (goals completed, streak days) keep the plainer
  // secondary-value layout.
  const isScoreBoard = SCORE_SCALE.has(board);
  const rank = isScoreBoard ? rankForPercent(row.score) : null;
  const pct = Math.min(100, Math.max(0, row.score));

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5",
        row.isCurrentUser &&
          "rounded-card bg-primary-soft ring-2 ring-inset ring-primary/40",
      )}
    >
      <RankMedal rank={row.rank} />

      <Avatar
        src={row.user.avatarUrl}
        firstName={row.user.firstName}
        lastName={row.user.lastName}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {row.user.firstName} {row.user.lastName}
          </p>
          {row.isCurrentUser ? (
            <Badge variant="primary" size="sm">
              You
            </Badge>
          ) : null}
        </div>
        {row.user.headline ? (
          <p className="truncate text-xs text-muted">{row.user.headline}</p>
        ) : null}
      </div>

      {rank ? (
        <div className="hidden w-44 shrink-0 items-center gap-2 md:flex">
          <RankMedalImage score={row.score} size={40} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-semibold leading-tight",
                RANK_TEXT[rank.key],
              )}
            >
              {rank.name}
            </p>
            <p className="text-[0.6875rem] tabular-nums text-muted">
              {rank.min}–{rank.max}%
            </p>
          </div>
        </div>
      ) : (
        <div className="hidden w-20 shrink-0 text-right text-xs text-muted sm:block">
          {row.secondary}
        </div>
      )}

      {rank ? (
        <div className="hidden w-40 shrink-0 items-center gap-2 lg:flex">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn("h-full rounded-full", RANK_BAR[rank.key])}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "w-9 shrink-0 text-right text-xs font-semibold tabular-nums",
              RANK_TEXT[rank.key],
            )}
          >
            {Math.round(pct)}%
          </span>
        </div>
      ) : null}

      <div className="w-10 shrink-0 text-right">
        <DeltaChip delta={row.delta} />
      </div>

      <div className="flex w-16 shrink-0 items-center justify-end gap-1.5">
        {row.rank <= 3 ? (
          <Crown
            className={cn(
              "size-4 shrink-0",
              row.rank === 1
                ? "text-amber-400"
                : row.rank === 2
                  ? "text-slate-400"
                  : "text-amber-700 dark:text-amber-600",
            )}
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn(
            "text-xl font-semibold tabular-nums tracking-tight",
            isScoreBoard ? TONE_TEXT[scoreTone(row.score)] : "text-foreground",
          )}
        >
          {formatScore(row.score)}
        </span>
      </div>
    </li>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboards</h1>
      <p className="mt-1 text-sm text-muted">
        See where you stand — and who you&apos;re climbing towards.
      </p>
    </div>
  );
}

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; scope?: string }>;
}) {
  const user = await requireUser();
  const { board, scope } = await searchParams;

  const boards = await availableBoards(user);

  if (boards.length === 0) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <EmptyState
            icon={Trophy}
            title="No leaderboards yet"
            description="You'll be ranked against your council as soon as a coach places you in one."
          />
        </div>
      </div>
    );
  }

  // The selection is resolved *only against the boards this user was offered*, so
  // a hand-typed ?board=ORGANIZATION cannot promote a mentee onto a board they
  // may not see: it simply fails to match, and falls back to their first board.
  const active =
    boards.find(
      (b) => b.board === board && (scope === undefined || b.scopeId === scope),
    ) ?? boards[0];

  const [rows, rank] = await Promise.all([
    guard(() => getLeaderboard(user, active.board, active.scopeId)),
    guard(() => getUserRank(user, user.id, active.board, active.scopeId)),
  ]);

  return (
    <div className="animate-slide-up">
      <Header />

      <nav
        aria-label="Leaderboards"
        className="scroll-thin mt-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface-sunken p-1"
      >
        {boards.map((item) => {
          const selected = keyOf(item) === keyOf(active);
          return (
            <Link
              key={keyOf(item)}
              href={hrefFor(item)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3",
                "text-xs font-medium transition-colors duration-150 ease-out",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "card-shadow bg-surface-raised text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>

      <p className="mt-4 text-sm text-muted">
        {LEADERBOARD_DESCRIPTIONS[active.board]}
      </p>

      {rank.ok && rank.data ? (
        <div className="sticky top-16 z-20 mt-4 flex items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary-soft px-4 py-3 backdrop-blur-md">
          <span className="text-sm font-medium">
            You&apos;re {ordinal(rank.data.rank)}
            <span className="text-muted"> of {rank.data.total}</span>
          </span>
          <span className="text-xs text-muted">{active.title}</span>
        </div>
      ) : null}

      <div className="mt-4">
        {!rows.ok ? (
          <AccessNotice message={rows.message} />
        ) : rows.data.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nobody on this board yet"
            description="Scores appear here as soon as members start logging goals and core tasks."
          />
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {rows.data.map((row) => (
                <Row key={row.user.id} row={row} board={active.board} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
