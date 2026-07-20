import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
  coachMenteeIds,
  groupMemberIds,
  visibleUserIds,
} from "@/lib/rbac";
import {
  ACTION_PLAN_STATUSES,
  GOAL_CATEGORY_KEYS,
  GOAL_DIRECTIONS,
  PERIOD_DAYS,
  PLAN_STATUS_WEIGHT,
  asGoalCategoryKey,
  asGoalStatus,
  asGoalType,
  asTargetPeriod,
  perPeriodTarget,
  type ActionPlanStatus,
  type GoalCategoryKey,
  type GoalDirection,
  type GoalStatus,
  type GoalType,
  type TargetPeriod,
} from "@/lib/domain";
import { scoreCategories, scoreGoal, weightGoalScore } from "@/lib/scoring";
import { addDays, dayKey, daysUntil, today } from "@/lib/dates";
import { logActivity } from "@/server/activity";

/**
 * Goals — the three-category engine at the centre of Abundance Hub.
 *
 * A goal's SCORE is its numeric measure: how far `currentValue` has come toward
 * `targetValue` (a GAIN or a LOSE). Its action plans carry a status each; their
 * completion is shown alongside the goal but never folded into the score. Every
 * measure movement appends a GoalUpdate row, so the trend chart reads a ledger.
 */

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type GoalCategoryRef = {
  key: GoalCategoryKey;
  name: string;
  accent: string;
};

export type ActionPlanItem = {
  id: string;
  title: string;
  status: ActionPlanStatus;
  dueDate: Date | null;
  sortOrder: number;
};

export type GoalCommentItem = {
  id: string;
  body: string;
  isPrivate: boolean;
  createdAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

export type GoalUpdateItem = {
  id: string;
  progressFrom: number;
  progressTo: number;
  statusFrom: GoalStatus | null;
  statusTo: GoalStatus | null;
  note: string | null;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string };
};

export type GoalAttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  kind: string;
  createdAt: Date;
};

export type GoalSummary = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  startDate: Date;
  targetDate: Date;
  completedAt: Date | null;
  category: GoalCategoryRef;
  /** MERIT scores by the measure; MILESTONE scores by its action plans. */
  goalType: GoalType;
  /** For a MERIT goal, how often its per-period target recurs (NONE = manual). */
  targetPeriod: TargetPeriod;
  /** For a periodic MERIT goal, the amount to log this period (0 otherwise). */
  periodTarget: number;
  /** The measurable target that drives the score. */
  direction: GoalDirection;
  targetValue: number;
  currentValue: number;
  unit: string;
  /** Action plans: how many there are, and how many are DONE. */
  taskCount: number;
  completedTasks: number;
  /** Informational action-plan completion (done 100 / in-progress 50 / not-started 0). Never scored. */
  planCompletion: number;
  /**
   * The goal's own score, 0-100 — its numeric measure (current ÷ target). `null`
   * only for an abandoned goal, which is withdrawn from every average rather than
   * dragging one down.
   */
  score: number | null;
  daysUntilDue: number;
  isOverdue: boolean;
};

export type GoalDetail = GoalSummary & {
  notes: string | null;
  tasks: ActionPlanItem[];
  comments: GoalCommentItem[];
  updates: GoalUpdateItem[];
  attachments: GoalAttachmentItem[];
};

export type GoalSummaryStats = {
  total: number;
  completed: number;
  inProgress: number;
  atRisk: number;
  overdue: number;
  /**
   * The Goal Total Score: the three category scores combined, on 0-100. This is
   * the user's Overall Score — the three categories are the whole of it.
   */
  goalTotalScore: number;
  byCategory: Record<
    GoalCategoryKey,
    {
      total: number;
      completed: number;
      avgProgress: number;
      /** Mean score of the goals in this category. Zero when the category is empty. */
      score: number;
    }
  >;
  /**
   * Required categories the user has no goal in. All three are mandatory, and an
   * empty one scores zero — so this is the list of gaps actively costing them.
   */
  missingCategories: GoalCategoryKey[];
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CLOSED_STATUSES: GoalStatus[] = ["COMPLETED", "ABANDONED"];

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

function asPlanStatus(value: string): ActionPlanStatus {
  return (ACTION_PLAN_STATUSES as readonly string[]).includes(value)
    ? (value as ActionPlanStatus)
    : "NOT_STARTED";
}

function asDirection(value: string): GoalDirection {
  return (GOAL_DIRECTIONS as readonly string[]).includes(value)
    ? (value as GoalDirection)
    : "GAIN";
}

/**
 * AT_RISK is a judgement a coach or mentee makes. Overdue is arithmetic: a goal
 * past its target date that nobody has closed out is late whatever its status says.
 */
function isOverdueGoal(targetDate: Date, status: GoalStatus): boolean {
  return !CLOSED_STATUSES.includes(status) && daysUntil(targetDate) < 0;
}

/**
 * The stored `progress` column mirrors the goal's score — its numeric measure —
 * so lists and charts read one column. It must use the same rule scoreGoal()
 * does (current ÷ target), or the bar and the score would disagree. Falls back
 * to the passed value when no target is set.
 */
function measurePct(
  targetValue: number,
  currentValue: number,
  fallback: number,
): number {
  if (targetValue > 0) {
    return clampPct(Math.round((currentValue / targetValue) * 100));
  }
  return clampPct(fallback);
}

/** Informational only: the mean status weight across a goal's action plans. */
function planCompletionOf(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce(
    (acc, t) => acc + PLAN_STATUS_WEIGHT[asPlanStatus(t.status)],
    0,
  );
  return Math.round(sum / tasks.length);
}

const categorySelect = {
  select: { key: true, name: true, accent: true },
} as const;

function toCategoryRef(row: {
  key: string;
  name: string;
  accent: string;
}): GoalCategoryRef {
  return {
    key: asGoalCategoryKey(row.key),
    name: row.name,
    accent: row.accent,
  };
}

type GoalRowForSummary = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  goalType: string;
  targetPeriod: string;
  direction: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: Date;
  targetDate: Date;
  completedAt: Date | null;
  category: { key: string; name: string; accent: string };
  tasks: { status: string }[];
};

function toSummary(goal: GoalRowForSummary): GoalSummary {
  const status = asGoalStatus(goal.status);
  const goalType = asGoalType(goal.goalType);
  const targetPeriod = asTargetPeriod(goal.targetPeriod);

  // A periodic MERIT goal's per-period target: the remaining gap spread over the
  // periods left until the target date.
  const periodTarget =
    goalType === "MERIT" && targetPeriod !== "NONE"
      ? perPeriodTarget(
          goal.targetValue,
          goal.currentValue,
          daysUntil(goal.targetDate),
          PERIOD_DAYS[targetPeriod],
        )
      : 0;

  return {
    id: goal.id,
    userId: goal.userId,
    title: goal.title,
    description: goal.description,
    status,
    progress: goal.progress,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    completedAt: goal.completedAt,
    category: toCategoryRef(goal.category),
    goalType,
    targetPeriod,
    periodTarget,
    direction: asDirection(goal.direction),
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    unit: goal.unit,
    taskCount: goal.tasks.length,
    completedTasks: goal.tasks.filter((t) => asPlanStatus(t.status) === "DONE")
      .length,
    planCompletion: planCompletionOf(goal.tasks),
    // Scored by the same engine that ranks the leaderboards, so the number on a
    // goal card and the number a mentee is ranked by can never diverge.
    score: scoreGoal({
      status: goal.status,
      progress: goal.progress,
      categoryKey: goal.category.key,
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      tasks: goal.tasks,
    }),
    daysUntilDue: daysUntil(goal.targetDate),
    isOverdue: isOverdueGoal(goal.targetDate, status),
  };
}

/** Owner and current state — the lookup every write path starts from. */
async function loadGoalOrThrow(goalId: string) {
  const goal = await db.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new ForbiddenError("That goal no longer exists.");
  return goal;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listGoals(
  actor: SessionUser,
  userId: string,
  filter?: { status?: GoalStatus; categoryKey?: GoalCategoryKey },
): Promise<GoalSummary[]> {
  await assertCanViewUser(actor, userId);

  const goals = await db.goal.findMany({
    where: {
      userId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.categoryKey ? { category: { key: filter.categoryKey } } : {}),
    },
    orderBy: [{ targetDate: "asc" }, { createdAt: "desc" }],
    include: {
      category: categorySelect,
      tasks: { select: { status: true } },
    },
  });

  return goals.map(toSummary);
}

export async function getGoal(
  actor: SessionUser,
  goalId: string,
): Promise<GoalDetail> {
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    include: {
      category: categorySelect,
      tasks: { orderBy: { sortOrder: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!goal) throw new ForbiddenError("That goal no longer exists.");
  await assertCanViewUser(actor, goal.userId);

  // A private comment is coach-eyes-only: the mentee it is about must not see
  // it, even on their own goal.
  const viewerIsSubject = actor.id === goal.userId && !actor.isAdmin;
  const comments = goal.comments.filter((c) => !c.isPrivate || !viewerIsSubject);

  return {
    ...toSummary(goal),
    notes: goal.notes,
    tasks: goal.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: asPlanStatus(t.status),
      dueDate: t.dueDate,
      sortOrder: t.sortOrder,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt,
      author: c.author,
    })),
    updates: goal.updates.map((u) => ({
      id: u.id,
      progressFrom: u.progressFrom,
      progressTo: u.progressTo,
      statusFrom: u.statusFrom ? asGoalStatus(u.statusFrom) : null,
      statusTo: u.statusTo ? asGoalStatus(u.statusTo) : null,
      note: u.note,
      createdAt: u.createdAt,
      author: u.author,
    })),
    attachments: goal.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      url: a.url,
      kind: a.kind,
      createdAt: a.createdAt,
    })),
  };
}

export async function goalSummaryFor(
  userId: string,
): Promise<GoalSummaryStats> {
  const goals = await db.goal.findMany({
    where: { userId },
    select: {
      status: true,
      progress: true,
      goalType: true,
      targetDate: true,
      targetValue: true,
      currentValue: true,
      category: { select: { key: true } },
      tasks: { select: { status: true } },
    },
  });

  // The category and total scores come from the same engine the leaderboards
  // use, so the number a mentee reads on their goals page is the number they are
  // ranked by. Two implementations would eventually disagree.
  const scorable = goals.map((g) => ({
    status: g.status,
    progress: g.progress,
    categoryKey: g.category.key,
    goalType: g.goalType,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    tasks: g.tasks,
  }));
  const categoryScores = scoreCategories(scorable);
  const goalTotalScore = weightGoalScore(categoryScores);

  const byCategory = {} as GoalSummaryStats["byCategory"];
  const missingCategories: GoalCategoryKey[] = [];

  for (const key of GOAL_CATEGORY_KEYS) {
    const inCategory = goals.filter(
      (g) => asGoalCategoryKey(g.category.key) === key,
    );
    if (inCategory.length === 0) missingCategories.push(key);

    byCategory[key] = {
      total: inCategory.length,
      completed: inCategory.filter(
        (g) => asGoalStatus(g.status) === "COMPLETED",
      ).length,
      avgProgress: inCategory.length
        ? Math.round(
            inCategory.reduce((sum, g) => sum + g.progress, 0) /
              inCategory.length,
          )
        : 0,
      score: categoryScores[key],
    };
  }

  const statusOf = (g: { status: string }) => asGoalStatus(g.status);

  return {
    total: goals.length,
    completed: goals.filter((g) => statusOf(g) === "COMPLETED").length,
    inProgress: goals.filter((g) => statusOf(g) === "IN_PROGRESS").length,
    atRisk: goals.filter((g) => statusOf(g) === "AT_RISK").length,
    overdue: goals.filter((g) => isOverdueGoal(g.targetDate, statusOf(g)))
      .length,
    goalTotalScore,
    byCategory,
    missingCategories,
  };
}

export async function upcomingDeadlines(
  actor: SessionUser,
  userId: string,
  withinDays = 14,
): Promise<GoalSummary[]> {
  const goals = await listGoals(actor, userId);
  return goals
    .filter(
      (g) => !CLOSED_STATUSES.includes(g.status) && g.daysUntilDue <= withinDays,
    )
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createGoal(
  actor: SessionUser,
  input: {
    userId: string;
    categoryKey: GoalCategoryKey;
    title: string;
    description?: string;
    targetDate: Date;
    notes?: string;
    direction?: GoalDirection;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    goalType?: GoalType;
    targetPeriod?: TargetPeriod;
    tasks?: string[];
  },
): Promise<string> {
  await assertCanEditMentee(actor, input.userId);

  const category = await db.goalCategory.findUnique({
    where: { key: input.categoryKey },
    select: { id: true },
  });
  if (!category) {
    throw new Error(`Unknown goal category: ${input.categoryKey}`);
  }

  const goalType = asGoalType(input.goalType ?? "MERIT");
  const isMilestone = goalType === "MILESTONE";
  // A milestone goal has no numeric measure — its plans are the score.
  const targetValue = isMilestone ? 0 : Math.max(0, input.targetValue ?? 0);
  const currentValue = isMilestone ? 0 : Math.max(0, input.currentValue ?? 0);
  const targetPeriod: TargetPeriod = isMilestone
    ? "NONE"
    : asTargetPeriod(input.targetPeriod ?? "NONE");

  const planTitles = (input.tasks ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const goal = await db.goal.create({
    data: {
      userId: input.userId,
      categoryId: category.id,
      title: input.title,
      description: input.description ?? null,
      targetDate: input.targetDate,
      notes: input.notes ?? null,
      status: "NOT_STARTED",
      goalType,
      targetPeriod,
      direction: isMilestone ? "GAIN" : (input.direction ?? "GAIN"),
      targetValue,
      currentValue,
      unit: isMilestone ? "" : (input.unit?.trim() ?? ""),
      // MERIT mirrors its measure; a fresh MILESTONE has no plans done yet, so 0.
      progress: isMilestone ? 0 : measurePct(targetValue, currentValue, 0),
      tasks: {
        create: planTitles.map((title, index) => ({
          title,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });

  await logActivity({
    userId: input.userId,
    actorId: actor.id,
    type: "GOAL_CREATED",
    entityType: "goal",
    entityId: goal.id,
    summary: `Set a new ${input.categoryKey.toLowerCase()} goal: "${input.title}"`,
    metadata: {
      categoryKey: input.categoryKey,
      targetDate: input.targetDate.toISOString(),
    },
  });

  return goal.id;
}

export async function updateGoal(
  actor: SessionUser,
  goalId: string,
  input: {
    title?: string;
    description?: string;
    status?: GoalStatus;
    targetDate?: Date;
    notes?: string;
    direction?: GoalDirection;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    goalType?: GoalType;
    targetPeriod?: TargetPeriod;
  },
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const statusFrom = asGoalStatus(goal.status);
  const statusTo = input.status ?? statusFrom;
  const progressFrom = goal.progress;

  const goalType = asGoalType(input.goalType ?? goal.goalType);
  const isMilestone = goalType === "MILESTONE";
  const targetPeriod: TargetPeriod = isMilestone
    ? "NONE"
    : asTargetPeriod(input.targetPeriod ?? goal.targetPeriod);

  const targetValue = isMilestone
    ? 0
    : input.targetValue !== undefined
      ? Math.max(0, input.targetValue)
      : goal.targetValue;
  const currentValue = isMilestone
    ? 0
    : input.currentValue !== undefined
      ? Math.max(0, input.currentValue)
      : goal.currentValue;

  // Progress mirrors the score: the measure for MERIT, plan completion for
  // MILESTONE, pinned to 100 when the goal is marked complete.
  const completing = statusTo === "COMPLETED" && statusFrom !== "COMPLETED";
  const reopening = statusFrom === "COMPLETED" && statusTo !== "COMPLETED";
  let progressTo: number;
  if (statusTo === "COMPLETED") {
    progressTo = 100;
  } else if (isMilestone) {
    const plans = await db.goalTask.findMany({
      where: { goalId },
      select: { status: true },
    });
    progressTo = planCompletionOf(plans);
  } else {
    progressTo = measurePct(targetValue, currentValue, progressFrom);
  }

  await db.goal.update({
    where: { id: goalId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: input.targetDate }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.direction !== undefined && !isMilestone
        ? { direction: input.direction }
        : {}),
      ...(input.unit !== undefined && !isMilestone
        ? { unit: input.unit.trim() }
        : {}),
      goalType,
      targetPeriod,
      targetValue,
      currentValue,
      status: statusTo,
      progress: progressTo,
      ...(completing ? { completedAt: new Date() } : {}),
      ...(reopening ? { completedAt: null } : {}),
    },
  });

  await db.goalUpdate.create({
    data: {
      goalId,
      authorId: actor.id,
      progressFrom,
      progressTo,
      statusFrom,
      statusTo,
    },
  });

  await logActivity({
    userId: goal.userId,
    actorId: actor.id,
    type: completing ? "GOAL_COMPLETED" : "GOAL_UPDATED",
    entityType: "goal",
    entityId: goalId,
    summary: completing
      ? `Completed the goal "${goal.title}"`
      : `Updated the goal "${goal.title}" — ${progressFrom}% to ${progressTo}%`,
    metadata: { progressFrom, progressTo, statusFrom, statusTo },
  });
}

/** Updates just the "current" measure value and re-mirrors the bar. */
export async function setGoalMeasure(
  actor: SessionUser,
  goalId: string,
  currentValue: number,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const statusFrom = asGoalStatus(goal.status);
  const progressFrom = goal.progress;
  const current = Math.max(0, currentValue);
  const progressTo =
    statusFrom === "COMPLETED"
      ? 100
      : measurePct(goal.targetValue, current, progressFrom);

  await db.goal.update({
    where: { id: goalId },
    data: { currentValue: current, progress: progressTo },
  });

  await db.goalUpdate.create({
    data: {
      goalId,
      authorId: actor.id,
      progressFrom,
      progressTo,
      statusFrom,
      statusTo: statusFrom,
    },
  });

  await logActivity({
    userId: goal.userId,
    actorId: actor.id,
    type: "GOAL_UPDATED",
    entityType: "goal",
    entityId: goalId,
    summary: `Measure on "${goal.title}" — ${progressFrom}% to ${progressTo}%`,
    metadata: { progressFrom, progressTo, source: "measure" },
  });
}

export async function deleteGoal(
  actor: SessionUser,
  goalId: string,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  // Tasks, updates, comments and attachments cascade at the schema level.
  await db.goal.delete({ where: { id: goalId } });
}

export async function addGoalComment(
  actor: SessionUser,
  goalId: string,
  body: string,
  isPrivate: boolean,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);

  // Commenting is an observation, not an edit: a coach may weigh in on any
  // mentee they can see, without holding a delegation to edit them.
  await assertCanViewUser(actor, goal.userId);
  const mayComment = actor.isCoach || actor.isAdmin || actor.id === goal.userId;
  if (!mayComment) {
    throw new ForbiddenError("You cannot comment on this goal.");
  }

  await db.goalComment.create({
    data: { goalId, authorId: actor.id, body, isPrivate },
  });

  await logActivity({
    userId: goal.userId,
    actorId: actor.id,
    type: "COMMENT_ADDED",
    entityType: "goal",
    entityId: goalId,
    summary: `${actor.fullName} commented on "${goal.title}"`,
    metadata: { isPrivate },
  });

  // A private comment is for the coaching team; notifying the mentee it exists
  // would defeat the point of marking it private.
  const isCoachFeedback =
    (actor.isCoach || actor.isAdmin) && actor.id !== goal.userId;

  if (isCoachFeedback && !isPrivate) {
    await db.notification.create({
      data: {
        userId: goal.userId,
        type: "COACH_FEEDBACK",
        title: "New coach comment",
        body: `${actor.fullName} commented on your goal "${goal.title}".`,
        link: `/goals/${goalId}`,
        priority: "NORMAL",
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Action plans — a status each; never folded into the goal score.
// ---------------------------------------------------------------------------

async function loadPlanOrThrow(goalTaskId: string) {
  const task = await db.goalTask.findUnique({
    where: { id: goalTaskId },
    include: { goal: { select: { id: true, userId: true } } },
  });
  if (!task) throw new ForbiddenError("That action plan no longer exists.");
  return task;
}

/**
 * A MILESTONE goal is scored by its plans, so any plan change re-mirrors its
 * progress column. A MERIT goal's score is its measure, so it is left untouched.
 */
async function remirrorMilestone(goalId: string): Promise<void> {
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    select: { goalType: true, status: true },
  });
  if (!goal || asGoalType(goal.goalType) !== "MILESTONE") return;
  const status = asGoalStatus(goal.status);
  if (status === "COMPLETED" || status === "ABANDONED") return;

  const plans = await db.goalTask.findMany({
    where: { goalId },
    select: { status: true },
  });
  await db.goal.update({
    where: { id: goalId },
    data: { progress: planCompletionOf(plans) },
  });
}

export async function addActionPlan(
  actor: SessionUser,
  goalId: string,
  title: string,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const count = await db.goalTask.count({ where: { goalId } });
  await db.goalTask.create({
    data: { goalId, title: title.trim(), sortOrder: count },
  });
  await remirrorMilestone(goalId);
}

export async function setActionPlanStatus(
  actor: SessionUser,
  goalTaskId: string,
  status: ActionPlanStatus,
): Promise<void> {
  const task = await loadPlanOrThrow(goalTaskId);
  await assertCanEditMentee(actor, task.goal.userId);

  const done = status === "DONE";
  await db.goalTask.update({
    where: { id: goalTaskId },
    data: {
      status,
      isComplete: done,
      completedAt: done ? (task.completedAt ?? new Date()) : null,
    },
  });
  // For a MILESTONE goal the plans ARE the score, so re-mirror it; for a MERIT
  // goal remirrorMilestone is a no-op and the numeric measure stands.
  await remirrorMilestone(task.goalId);
}

export async function deleteActionPlan(
  actor: SessionUser,
  goalTaskId: string,
): Promise<void> {
  const task = await loadPlanOrThrow(goalTaskId);
  await assertCanEditMentee(actor, task.goal.userId);
  await db.goalTask.delete({ where: { id: goalTaskId } });
  await remirrorMilestone(task.goalId);
}

// ---------------------------------------------------------------------------
// Merit periodic logging
// ---------------------------------------------------------------------------

/** Has this MERIT goal been logged within its current period window? */
async function isPeriodLogged(
  goalId: string,
  periodDays: number,
): Promise<boolean> {
  const since = dayKey(addDays(today(), -(Math.max(1, periodDays) - 1)));
  const count = await db.meritLog.count({
    where: { goalId, date: { gte: since } },
  });
  return count > 0;
}

/** Adds `amount` to a MERIT goal's current value, logged against today. */
async function addMerit(
  actor: SessionUser,
  goal: {
    id: string;
    userId: string;
    status: string;
    progress: number;
    targetValue: number;
    currentValue: number;
    unit: string;
    title: string;
  },
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const day = dayKey(today());

  await db.meritLog.upsert({
    where: { goalId_date: { goalId: goal.id, date: day } },
    create: { goalId: goal.id, userId: goal.userId, date: day, amount },
    update: { amount: { increment: amount } },
  });

  const status = asGoalStatus(goal.status);
  const newCurrent = goal.currentValue + amount;
  const progressFrom = goal.progress;
  const progressTo =
    status === "COMPLETED"
      ? 100
      : measurePct(goal.targetValue, newCurrent, progressFrom);

  await db.goal.update({
    where: { id: goal.id },
    data: { currentValue: newCurrent, progress: progressTo },
  });

  await db.goalUpdate.create({
    data: {
      goalId: goal.id,
      authorId: actor.id,
      progressFrom,
      progressTo,
      statusFrom: status,
      statusTo: status,
    },
  });

  await logActivity({
    userId: goal.userId,
    actorId: actor.id,
    type: "GOAL_UPDATED",
    entityType: "goal",
    entityId: goal.id,
    summary: `Logged ${amount}${goal.unit ? ` ${goal.unit}` : ""} toward "${goal.title}"`,
    metadata: { amount, progressFrom, progressTo, source: "merit" },
  });
}

/**
 * Logs the current period's target for a periodic MERIT goal — the check the
 * mentee taps in Core Tasks. Idempotent within a period: if it is already logged
 * this period, nothing happens.
 */
export async function logMeritTarget(
  actor: SessionUser,
  goalId: string,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  if (asGoalType(goal.goalType) !== "MERIT") {
    throw new ForbiddenError("Only a merit goal has a period target to log.");
  }
  const period = asTargetPeriod(goal.targetPeriod);
  if (period === "NONE") {
    throw new ForbiddenError("This goal has no recurring target.");
  }
  if (await isPeriodLogged(goalId, PERIOD_DAYS[period])) return;

  const amount = perPeriodTarget(
    goal.targetValue,
    goal.currentValue,
    daysUntil(goal.targetDate),
    PERIOD_DAYS[period],
  );
  await addMerit(actor, goal, amount);
}

/** Goes the extra mile: logs a custom amount on top of the period target. */
export async function goExtraMile(
  actor: SessionUser,
  goalId: string,
  amount: number,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  if (asGoalType(goal.goalType) !== "MERIT") {
    throw new ForbiddenError("Only a merit goal can log extra progress.");
  }
  await addMerit(actor, goal, Math.max(0, amount));
}

export type MeritTargetItem = {
  goalId: string;
  title: string;
  categoryKey: GoalCategoryKey;
  direction: GoalDirection;
  unit: string;
  targetPeriod: TargetPeriod;
  /** How much to log this period. */
  periodTarget: number;
  currentValue: number;
  targetValue: number;
  /** Already logged in the current period. */
  done: boolean;
};

/**
 * A user's open MERIT period-targets — the goal-derived tasks that show up on the
 * Core Tasks board. Excludes goals already at their target, and marks whether the
 * current period has been logged.
 */
export async function listMeritTargets(
  actor: SessionUser,
  userId: string,
): Promise<MeritTargetItem[]> {
  await assertCanViewUser(actor, userId);

  const windowStart = dayKey(addDays(today(), -6)); // widest period is weekly
  const goals = await db.goal.findMany({
    where: {
      userId,
      goalType: "MERIT",
      targetPeriod: { not: "NONE" },
      status: { notIn: ["COMPLETED", "ABANDONED"] },
    },
    include: {
      category: { select: { key: true } },
      meritLogs: {
        where: { date: { gte: windowStart } },
        select: { date: true },
      },
    },
    orderBy: [{ targetDate: "asc" }],
  });

  const items: MeritTargetItem[] = [];
  for (const g of goals) {
    // A goal already at (or past) its target needs no more logging.
    if (g.targetValue > 0 && g.currentValue >= g.targetValue) continue;

    const period = asTargetPeriod(g.targetPeriod);
    const periodDays = PERIOD_DAYS[period];
    const since = dayKey(addDays(today(), -(Math.max(1, periodDays) - 1)));
    const done = g.meritLogs.some((l) => l.date >= since);

    items.push({
      goalId: g.id,
      title: g.title,
      categoryKey: asGoalCategoryKey(g.category.key),
      direction: asDirection(g.direction),
      unit: g.unit,
      targetPeriod: period,
      periodTarget: perPeriodTarget(
        g.targetValue,
        g.currentValue,
        daysUntil(g.targetDate),
        periodDays,
      ),
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      done,
    });
  }
  return items;
}

export type MilestoneTargetItem = {
  goalId: string;
  title: string;
  categoryKey: GoalCategoryKey;
  /** The goal's current score, 0-100 (its plans' mean completion). */
  score: number;
  plans: ActionPlanItem[];
};

/**
 * A user's open MILESTONE goals and their action plans — the goal-derived
 * checklists that show up on the Core Tasks board. Moving a plan's status is
 * what moves a milestone goal's score.
 */
export async function listMilestoneTargets(
  actor: SessionUser,
  userId: string,
): Promise<MilestoneTargetItem[]> {
  await assertCanViewUser(actor, userId);

  const goals = await db.goal.findMany({
    where: {
      userId,
      goalType: "MILESTONE",
      status: { notIn: ["COMPLETED", "ABANDONED"] },
      tasks: { some: {} },
    },
    include: {
      category: { select: { key: true } },
      tasks: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ targetDate: "asc" }],
  });

  return goals.map((g) => ({
    goalId: g.id,
    title: g.title,
    categoryKey: asGoalCategoryKey(g.category.key),
    score: g.progress,
    plans: g.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: asPlanStatus(t.status),
      dueDate: t.dueDate,
      sortOrder: t.sortOrder,
    })),
  }));
}

/**
 * The required categories a user has no goal in.
 *
 * All three — Personal, Professional, Contribution — are mandatory, and an empty
 * category scores zero rather than being skipped. That is deliberate: not having
 * a contribution goal is exactly the gap the score should surface. This is what
 * the dashboard and goals page use to say so out loud instead of quietly
 * docking the score.
 */
export async function requiredGoalGaps(
  actor: SessionUser,
  userId: string,
): Promise<GoalCategoryKey[]> {
  await assertCanViewUser(actor, userId);

  const goals = await db.goal.findMany({
    where: { userId, status: { notIn: ["ABANDONED"] } },
    select: { category: { select: { key: true } } },
  });

  const held = new Set(goals.map((g) => asGoalCategoryKey(g.category.key)));
  return GOAL_CATEGORY_KEYS.filter((key) => !held.has(key));
}

// ---------------------------------------------------------------------------
// Coach Goals Board — every mentee's goals in one bounded read
// ---------------------------------------------------------------------------

export type MenteeGoalsGroup = {
  mentee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  /** The mentee's Goal Total Score (the three categories combined), 0-100. */
  goalTotalScore: number;
  /** Overdue first, then at-risk, then soonest due. */
  goals: GoalSummary[];
  /** Required categories this mentee holds no (non-abandoned) goal in. */
  missingCategories: GoalCategoryKey[];
};

export type MenteeGoalsFilter = {
  /** "" = all my councils, "all" = every visible mentee, else a council id I lead. */
  council?: string;
  /** Matched (case-insensitively by SQLite's default collation) against name. */
  search?: string;
  /** Keep only goals in this category. */
  category?: GoalCategoryKey;
  /** Score comparison operator; only takes effect together with scoreValue. */
  scoreOp?: "gte" | "gt" | "eq" | "lt";
  /** The percentage the operator compares a goal's score against. */
  scoreValue?: number;
};

/**
 * The Goals Board's single read: every mentee in scope with their goals, Goal
 * Total Score and required-category gaps.
 *
 * Bounded queries regardless of roster size — no per-mentee loop. One query to
 * resolve the id set, then identities and every goal for the set; grouping and
 * scoring happen in memory, mirroring cardsForUserIds in src/server/mentees.ts.
 * Scores come from the same engine the leaderboards use, so the number here can
 * never diverge from a mentee's ranked score.
 *
 * Council + search pick the set of mentees; category + score filter each
 * mentee's displayed goals. A mentee's Goal Total Score and missing-category
 * flags always reflect ALL their goals — filtering is a display lens, never a
 * recomputation — but when a goal-level filter is active, a mentee with no
 * matching goal drops out of the list entirely.
 */
export async function listMenteeGoals(
  actor: SessionUser,
  filter: MenteeGoalsFilter = {},
): Promise<MenteeGoalsGroup[]> {
  const council = filter.council ?? "";
  const search = filter.search?.trim();

  const isAll = council === "all";
  // "All" = every mentee the coach may view (visibleUserIds is null = whole org).
  // A specific council the coach leads uses its membership; otherwise all their
  // councils' members. coachGroupIds only holds the coach's own active groups,
  // so a stray/foreign council id harmlessly falls back to "all my councils".
  const allowed = isAll ? await visibleUserIds(actor) : null;
  const scopedIds = isAll
    ? null
    : council && actor.coachGroupIds.includes(council)
      ? await groupMemberIds(council)
      : await coachMenteeIds(actor.id);

  if (!isAll && (scopedIds?.length ?? 0) === 0) return [];

  const users = await db.user.findMany({
    where: {
      isActive: true,
      ...(isAll
        ? {
            organizationId: actor.organizationId,
            roles: { some: { role: { key: "MENTEE" } } },
            ...(allowed === null ? {} : { id: { in: allowed } }),
          }
        : { id: { in: scopedIds ?? [] } }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          }
        : {}),
    },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const goals = await db.goal.findMany({
    where: { userId: { in: userIds } },
    orderBy: [{ targetDate: "asc" }, { createdAt: "desc" }],
    include: {
      category: categorySelect,
      tasks: { select: { status: true } },
    },
  });

  // Group the raw goal rows by owner (rows still carry task statuses, which the
  // category scorer needs for MILESTONE goals).
  const rowsByUser = new Map<string, typeof goals>();
  for (const goal of goals) {
    const list = rowsByUser.get(goal.userId);
    if (list) list.push(goal);
    else rowsByUser.set(goal.userId, [goal]);
  }

  // Overdue first, then AT_RISK, then soonest due.
  const rank = (g: GoalSummary) =>
    g.isOverdue ? 0 : g.status === "AT_RISK" ? 1 : 2;

  // Goal-level filters. A score condition without a value is inert.
  const hasScore =
    filter.scoreOp !== undefined && filter.scoreValue !== undefined;
  const goalFilterActive = Boolean(filter.category) || hasScore;

  const passesScore = (score: number | null): boolean => {
    if (!hasScore) return true;
    if (score === null) return false; // abandoned — out when a score filter is set
    switch (filter.scoreOp) {
      case "gte":
        return score >= filter.scoreValue!;
      case "gt":
        return score > filter.scoreValue!;
      case "eq":
        return score === filter.scoreValue!;
      case "lt":
        return score < filter.scoreValue!;
      default:
        return true;
    }
  };
  const passesCategory = (g: GoalSummary): boolean =>
    !filter.category || g.category.key === filter.category;

  const groups: MenteeGoalsGroup[] = [];
  for (const user of users) {
    const rows = rowsByUser.get(user.id) ?? [];

    const displayed = rows
      .map(toSummary)
      .filter((g) => passesCategory(g) && passesScore(g.score))
      .sort((a, b) => rank(a) - rank(b) || a.daysUntilDue - b.daysUntilDue);

    // A goal-level filter turns the board into a search: hide the misses.
    if (goalFilterActive && displayed.length === 0) continue;

    const goalTotalScore = weightGoalScore(
      scoreCategories(
        rows.map((g) => ({
          status: g.status,
          progress: g.progress,
          categoryKey: g.category.key,
          goalType: g.goalType,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
          tasks: g.tasks,
        })),
      ),
    );

    // An abandoned goal doesn't count as "holding" a category — matches
    // requiredGoalGaps.
    const held = new Set(
      rows
        .filter((g) => asGoalStatus(g.status) !== "ABANDONED")
        .map((g) => asGoalCategoryKey(g.category.key)),
    );
    const missingCategories = GOAL_CATEGORY_KEYS.filter((k) => !held.has(k));

    groups.push({
      mentee: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      goalTotalScore,
      goals: displayed,
      missingCategories,
    });
  }

  return groups;
}
