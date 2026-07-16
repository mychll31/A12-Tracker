import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
} from "@/lib/rbac";
import {
  ACTION_PLAN_STATUSES,
  GOAL_CATEGORY_KEYS,
  GOAL_DIRECTIONS,
  PLAN_STATUS_WEIGHT,
  asGoalCategoryKey,
  asGoalStatus,
  type ActionPlanStatus,
  type GoalCategoryKey,
  type GoalDirection,
  type GoalStatus,
} from "@/lib/domain";
import { scoreCategories, scoreGoal, weightGoalScore } from "@/lib/scoring";
import { daysUntil } from "@/lib/dates";
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
   * the number that carries 50% of the user's Overall Score.
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
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
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
      targetDate: true,
      targetValue: true,
      currentValue: true,
      category: { select: { key: true } },
    },
  });

  // The category and total scores come from the same engine the leaderboards
  // use, so the number a mentee reads on their goals page is the number they are
  // ranked by. Two implementations would eventually disagree.
  const scorable = goals.map((g) => ({
    status: g.status,
    progress: g.progress,
    categoryKey: g.category.key,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
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

  const targetValue = Math.max(0, input.targetValue ?? 0);
  const currentValue = Math.max(0, input.currentValue ?? 0);

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
      direction: input.direction ?? "GAIN",
      targetValue,
      currentValue,
      unit: input.unit?.trim() ?? "",
      // The stored bar mirrors the measure.
      progress: measurePct(targetValue, currentValue, 0),
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
  },
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const statusFrom = asGoalStatus(goal.status);
  const statusTo = input.status ?? statusFrom;
  const progressFrom = goal.progress;

  const targetValue =
    input.targetValue !== undefined
      ? Math.max(0, input.targetValue)
      : goal.targetValue;
  const currentValue =
    input.currentValue !== undefined
      ? Math.max(0, input.currentValue)
      : goal.currentValue;

  // The bar mirrors the measure; marking the goal done pins it to 100.
  let progressTo = measurePct(targetValue, currentValue, progressFrom);
  const completing = statusTo === "COMPLETED" && statusFrom !== "COMPLETED";
  const reopening = statusFrom === "COMPLETED" && statusTo !== "COMPLETED";
  if (statusTo === "COMPLETED") progressTo = 100;

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
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
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
  // No recompute: action-plan completion never feeds the goal score.
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
  // No recompute: the goal score is the numeric measure, not the plans.
}

export async function deleteActionPlan(
  actor: SessionUser,
  goalTaskId: string,
): Promise<void> {
  const task = await loadPlanOrThrow(goalTaskId);
  await assertCanEditMentee(actor, task.goal.userId);
  await db.goalTask.delete({ where: { id: goalTaskId } });
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
