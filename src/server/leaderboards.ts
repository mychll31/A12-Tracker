import "server-only";

import type { SessionUser } from "@/lib/auth";
import { dayKey, today } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  LEADERBOARD_DESCRIPTIONS,
  LEADERBOARD_LABELS,
  type LeaderboardBoard,
} from "@/lib/domain";
import {
  ForbiddenError,
  assertCanViewGroup,
  groupMemberIds,
  visibleUserIds,
} from "@/lib/rbac";
import {
  computeCoachScores,
  computeScoresForUsers,
  type UserScore,
} from "@/lib/scoring";

/**
 * The six leaderboards, and the rules about who may open which.
 *
 * A mentee sees only their own coaching group — never the organization board,
 * never the coach board, never another group. That restriction is enforced
 * twice on purpose: once when listing which boards exist (`availableBoards`, so
 * a forbidden board is never offered) and again when a board is actually read
 * (`getLeaderboard`, so a hand-crafted request cannot reach past the menu).
 */

export type LeaderboardRow = {
  rank: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    headline: string | null;
  };
  /** The board's primary metric — whatever this board ranks on. */
  score: number;
  secondary?: string;
  isCurrentUser: boolean;
  /** Rank change against the previous captured board; positive = climbed. */
  delta: number | null;
};

export type BoardScope = {
  board: LeaderboardBoard;
  scopeId: string;
  title: string;
  description: string;
};

type RowUser = LeaderboardRow["user"];

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  headline: true,
} as const;

/** Boards that rank individual members on a single metric. */
const MEMBER_BOARDS = [
  "CORE_TASK",
  "GOAL_COMPLETION",
  "CONSISTENCY",
] as const satisfies readonly LeaderboardBoard[];

type MemberBoard = (typeof MEMBER_BOARDS)[number];

const round = (n: number) => Math.round(n * 10) / 10;
const isPrivileged = (actor: SessionUser) => actor.isCoach || actor.isAdmin;

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

type Ranked = {
  user: RowUser;
  score: number;
  secondary?: string;
  /** Only consulted when two users share a score. */
  tiebreak: number;
};

/**
 * The surname sort is not cosmetic: without a deterministic tie-break, two
 * users on an identical score could swap places between two reads of the same
 * board and every `delta` would become noise.
 */
function rankEntries(entries: Ranked[]): Ranked[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
    return a.user.lastName.localeCompare(b.user.lastName);
  });
}

function metricFor(board: LeaderboardBoard, score: UserScore): number {
  switch (board) {
    case "CORE_TASK":
      return score.coreTaskScore;
    case "GOAL_COMPLETION":
      return score.goalsCompleted;
    case "CONSISTENCY":
      return score.currentStreak;
    default:
      return score.overallScore;
  }
}

function secondaryFor(
  board: LeaderboardBoard,
  score: UserScore,
): string | undefined {
  switch (board) {
    case "GROUP":
      return `${score.goalsCompleted} goals`;
    case "CORE_TASK":
      return `${score.taskCompletionRate}% tasks`;
    case "CONSISTENCY":
      return `${score.longestStreak} best`;
    case "GOAL_COMPLETION":
      return `${score.goalsTotal} set`;
    default:
      return undefined;
  }
}

/** Goal-completion ties break on the underlying goal score. */
function tiebreakFor(board: LeaderboardBoard, score: UserScore): number {
  return board === "GOAL_COMPLETION" ? score.goalScore : 0;
}

function toRanked(board: LeaderboardBoard, user: RowUser, score?: UserScore) {
  if (!score) return { user, score: 0, tiebreak: 0 };
  return {
    user,
    score: round(metricFor(board, score)),
    secondary: secondaryFor(board, score),
    tiebreak: tiebreakFor(board, score),
  };
}

// ---------------------------------------------------------------------------
// Scoping
// ---------------------------------------------------------------------------

/**
 * Which scope a board request lands on, and whether the actor may have it.
 * Throws rather than silently narrowing: a mentee asking for the organization
 * board has asked for something they may not see, and quietly handing back
 * their own group instead would misrepresent what they are looking at.
 */
async function resolveScope(
  actor: SessionUser,
  board: LeaderboardBoard,
  scopeId?: string,
): Promise<string> {
  if (board === "COACH" || board === "ORGANIZATION") {
    if (!isPrivileged(actor)) {
      throw new ForbiddenError(
        "Organization-wide leaderboards are visible to coaches only.",
      );
    }
    return scopeId ?? actor.organizationId;
  }

  if (board === "GROUP") {
    const groupId = scopeId ?? actor.menteeGroupId ?? actor.coachGroupIds[0];
    if (!groupId) {
      throw new ForbiddenError("You are not a member of a coaching group.");
    }
    assertCanViewGroup(actor, groupId);
    return groupId;
  }

  // CORE_TASK | GOAL_COMPLETION | CONSISTENCY — organization-wide for a coach,
  // fenced to their own group for a mentee.
  if (!isPrivileged(actor)) {
    const own = actor.menteeGroupId;
    if (!own) return actor.organizationId;
    if (scopeId && scopeId !== own) {
      throw new ForbiddenError("That coaching group is not visible to you.");
    }
    return own;
  }

  return scopeId ?? actor.organizationId;
}

async function orgUserIds(organizationId: string): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * The population of a group-scoped member board: its mentees plus the coach who
 * runs it — which is exactly what `visibleUserIds` returns for a mentee. Keeping
 * the two identical is what lets a live board and its nightly capture rank the
 * same cast of people; otherwise every `delta` would be measured against a
 * board that contained different competitors.
 */
async function groupCandidateIds(groupId: string): Promise<string[]> {
  const [members, group] = await Promise.all([
    groupMemberIds(groupId),
    db.coachGroup.findUnique({
      where: { id: groupId },
      select: { coachId: true },
    }),
  ]);
  return [...new Set([...members, ...(group ? [group.coachId] : [])])];
}

async function memberBoardCandidates(
  actor: SessionUser,
  scopeId: string,
): Promise<string[]> {
  if (scopeId !== actor.organizationId) return groupCandidateIds(scopeId);

  // `null` from visibleUserIds means "no restriction" — the whole organization.
  const visible = await visibleUserIds(actor);
  return visible ?? orgUserIds(actor.organizationId);
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

function scopeOf(
  board: LeaderboardBoard,
  scopeId: string,
  title?: string,
): BoardScope {
  return {
    board,
    scopeId,
    title: title ?? LEADERBOARD_LABELS[board],
    description: LEADERBOARD_DESCRIPTIONS[board],
  };
}

export async function availableBoards(
  actor: SessionUser,
): Promise<BoardScope[]> {
  if (!isPrivileged(actor)) {
    // A mentee's whole world is their own group. Without one there is nobody to
    // rank them against, so they are offered no board at all.
    if (!actor.menteeGroupId) return [];

    const group = await db.coachGroup.findUnique({
      where: { id: actor.menteeGroupId },
      select: { id: true, name: true },
    });
    if (!group) return [];

    return [
      scopeOf("GROUP", group.id, group.name),
      ...MEMBER_BOARDS.map((board) => scopeOf(board, group.id)),
    ];
  }

  const groups = await db.coachGroup.findMany({
    where: { organizationId: actor.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return [
    scopeOf("ORGANIZATION", actor.organizationId),
    scopeOf("COACH", actor.organizationId),
    ...MEMBER_BOARDS.map((board) => scopeOf(board, actor.organizationId)),
    ...groups.map((g) => scopeOf("GROUP", g.id, g.name)),
  ];
}

/**
 * The most recent capture strictly older than today — comparing against a
 * capture taken today would compare the board with itself.
 */
async function previousRanks(
  board: LeaderboardBoard,
  scopeId: string,
): Promise<Map<string, number> | null> {
  const latest = await db.leaderboardEntry.findFirst({
    where: { board, scopeId, capturedAt: { lt: today() } },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  if (!latest) return null;

  const entries = await db.leaderboardEntry.findMany({
    where: { board, scopeId, capturedAt: latest.capturedAt },
    select: { userId: true, rank: true },
  });

  return new Map(entries.map((e) => [e.userId, e.rank]));
}

async function coachBoard(scopeId: string, asOf: Date): Promise<Ranked[]> {
  const coaches = await db.user.findMany({
    where: {
      organizationId: scopeId,
      roles: { some: { role: { key: "COACH" } } },
    },
    select: USER_SELECT,
  });

  const scores = await computeCoachScores(
    coaches.map((c) => c.id),
    asOf,
  );

  return rankEntries(
    coaches.map((user) => {
      const score = scores.get(user.id);
      return {
        user,
        score: round(score?.averageScore ?? 0),
        secondary: `${score?.menteeCount ?? 0} mentees`,
        tiebreak: 0,
      };
    }),
  );
}

async function userBoard(
  board: LeaderboardBoard,
  candidateIds: string[],
  asOf: Date,
): Promise<Ranked[]> {
  if (!candidateIds.length) return [];

  const [users, scores] = await Promise.all([
    db.user.findMany({
      where: { id: { in: candidateIds } },
      select: USER_SELECT,
    }),
    computeScoresForUsers(candidateIds, asOf),
  ]);

  return rankEntries(users.map((u) => toRanked(board, u, scores.get(u.id))));
}

export async function getLeaderboard(
  actor: SessionUser,
  board: LeaderboardBoard,
  scopeId?: string,
): Promise<LeaderboardRow[]> {
  const scope = await resolveScope(actor, board, scopeId);
  const asOf = new Date();

  const candidates =
    board === "COACH"
      ? []
      : board === "GROUP"
        ? await groupMemberIds(scope)
        : board === "ORGANIZATION"
          ? await orgUserIds(scope)
          : await memberBoardCandidates(actor, scope);

  const [ranked, previous] = await Promise.all([
    board === "COACH"
      ? coachBoard(scope, asOf)
      : userBoard(board, candidates, asOf),
    previousRanks(board, scope),
  ]);

  return ranked.map((entry, index) => {
    const position = index + 1;
    const before = previous?.get(entry.user.id);

    return {
      rank: position,
      user: entry.user,
      score: entry.score,
      secondary: entry.secondary,
      isCurrentUser: entry.user.id === actor.id,
      // Positive means they climbed: rank 5 → rank 2 is +3.
      delta: before === undefined ? null : before - position,
    };
  });
}

export async function getUserRank(
  actor: SessionUser,
  userId: string,
  board: LeaderboardBoard,
  scopeId?: string,
): Promise<{ rank: number; total: number } | null> {
  const rows = await getLeaderboard(actor, board, scopeId);
  const row = rows.find((r) => r.user.id === userId);
  return row ? { rank: row.rank, total: rows.length } : null;
}

// ---------------------------------------------------------------------------
// Capture — the nightly job and the seed
// ---------------------------------------------------------------------------

/**
 * Freeze every board in the organization at today's day bucket. This is the
 * only thing that gives a board a *yesterday*, so it is what makes `delta` —
 * and the "you moved up 3 places" notification — possible at all.
 *
 * Member boards are captured at both scopes, org-wide (what a coach reads) and
 * per-group (what a mentee reads), because a mentee must see their movement
 * inside the board they were actually shown.
 *
 * Idempotent: re-running for the same day overwrites that day's rows, so a
 * failed nightly run is safe to retry.
 */
export async function captureLeaderboards(
  organizationId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const capturedAt = dayKey(asOf);

  const groups = await db.coachGroup.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });

  const targets: { board: LeaderboardBoard; scopeId: string }[] = [
    { board: "ORGANIZATION", scopeId: organizationId },
    { board: "COACH", scopeId: organizationId },
    ...MEMBER_BOARDS.map((board) => ({
      board: board as LeaderboardBoard,
      scopeId: organizationId,
    })),
    ...groups.flatMap((group) => [
      { board: "GROUP" as LeaderboardBoard, scopeId: group.id },
      ...MEMBER_BOARDS.map((board) => ({
        board: board as LeaderboardBoard,
        scopeId: group.id,
      })),
    ]),
  ];

  let written = 0;

  for (const { board, scopeId } of targets) {
    const ranked = await captureBoard(
      board,
      scopeId,
      organizationId,
      capturedAt,
    );

    for (const [index, entry] of ranked.entries()) {
      const payload = { rank: index + 1, score: entry.score };

      await db.leaderboardEntry.upsert({
        where: {
          board_scopeId_userId_capturedAt: {
            board,
            scopeId,
            userId: entry.user.id,
            capturedAt,
          },
        },
        create: {
          board,
          scopeId,
          userId: entry.user.id,
          capturedAt,
          ...payload,
        },
        update: payload,
      });
      written += 1;
    }
  }

  return written;
}

/** Capture has no actor, so it resolves each board's population structurally. */
async function captureBoard(
  board: LeaderboardBoard,
  scopeId: string,
  organizationId: string,
  capturedAt: Date,
): Promise<Ranked[]> {
  if (board === "COACH") return coachBoard(scopeId, capturedAt);

  const candidateIds =
    board === "GROUP"
      ? await groupMemberIds(scopeId)
      : board === "ORGANIZATION"
        ? await orgUserIds(scopeId)
        : scopeId === organizationId
          ? await orgUserIds(organizationId)
          : await groupCandidateIds(scopeId);

  return userBoard(board, candidateIds, capturedAt);
}

export type { MemberBoard };
