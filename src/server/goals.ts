import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  ForbiddenError,
  assertCanEditMentee,
  assertCanViewUser,
} from "@/lib/rbac";
import {
  GOAL_CATEGORY_KEYS,
  asGoalCategoryKey,
  asGoalStatus,
  type GoalCategoryKey,
  type GoalStatus,
} from "@/lib/domain";
import { scoreCategories, scoreGoal, weightGoalScore } from "@/lib/scoring";
import { daysUntil } from "@/lib/dates";
import { logActivity } from "@/server/activity";

/**
 * Goals — the three-category engine at the centre of Abundance Hub.
 *
 * Progress is derived, never trusted: once a goal has tasks, the only way
 * to move its bar is to tick one. Every movement appends a GoalUpdate row, so
 * the trend chart reads a ledger rather than a guess.
 */

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type GoalCategoryRef = {
  key: GoalCategoryKey;
  name: string;
  accent: string;
};

export type GoalTaskItem = {
  id: string;
  title: string;
  isComplete: boolean;
  dueDate: Date | null;
  completedAt: Date | null;
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
  taskCount: number;
  completedTasks: number;
  /**
   * The goal's own score, 0-100 — the weighted share of its to-do list that is
   * done. `null` only for an abandoned goal, which is withdrawn from every
   * average rather than dragging one down.
   */
  score: number | null;
  daysUntilDue: number;
  isOverdue: boolean;
};

export type GoalDetail = GoalSummary & {
  notes: string | null;
  tasks: GoalTaskItem[];
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

/**
 * AT_RISK is a judgement a coach or mentee makes. Overdue is arithmetic: a goal
 * past its target date that nobody has closed out is late whatever its status says.
 */
function isOverdueGoal(targetDate: Date, status: GoalStatus): boolean {
  return !CLOSED_STATUSES.includes(status) && daysUntil(targetDate) < 0;
}

/**
 * The stored `progress` column mirrors the goal's score so lists and charts can
 * read one column instead of joining the task list. It must therefore use the
 * same weighting scoreGoal() does, or the bar and the score would disagree.
 */
function deriveProgress(
  tasks: { isComplete: boolean; weight: number }[],
  fallback: number,
): number {
  if (tasks.length === 0) return Math.min(100, Math.max(0, fallback));
  const total = tasks.reduce((sum, t) => sum + Math.max(1, t.weight), 0);
  const done = tasks
    .filter((t) => t.isComplete)
    .reduce((sum, t) => sum + Math.max(1, t.weight), 0);
  return total ? Math.round((done / total) * 100) : 0;
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
  startDate: Date;
  targetDate: Date;
  completedAt: Date | null;
  category: { key: string; name: string; accent: string };
  tasks: { isComplete: boolean; weight: number }[];
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
    taskCount: goal.tasks.length,
    completedTasks: goal.tasks.filter((t) => t.isComplete).length,
    // Scored by the same engine that ranks the leaderboards, so the number on a
    // goal card and the number a mentee is ranked by can never diverge.
    score: scoreGoal({
      status: goal.status,
      progress: goal.progress,
      categoryKey: goal.category.key,
      tasks: goal.tasks,
    }),
    daysUntilDue: daysUntil(goal.targetDate),
    isOverdue: isOverdueGoal(goal.targetDate, status),
  };
}

/** Owner and current state — the lookup every write path starts from. */
async function loadGoalOrThrow(goalId: string) {
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    include: { tasks: { select: { isComplete: true, weight: true } } },
  });
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
      tasks: { select: { isComplete: true, weight: true } },
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
    tasks: goal.tasks.map((m) => ({
      id: m.id,
      title: m.title,
      isComplete: m.isComplete,
      dueDate: m.dueDate,
      completedAt: m.completedAt,
      sortOrder: m.sortOrder,
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
      category: { select: { key: true } },
      tasks: { select: { isComplete: true, weight: true } },
    },
  });

  // The category and total scores come from the same engine the leaderboards
  // use, so the number a mentee reads on their goals page is the number they are
  // ranked by. Two implementations would eventually disagree.
  const scorable = goals.map((g) => ({
    status: g.status,
    progress: g.progress,
    categoryKey: g.category.key,
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
    tasks?: string[];
  },
): Promise<string> {
  await assertCanEditMentee(actor, input.userId);

  // A goal's score is the weighted share of its to-do list that is done, so a
  // goal with no tasks has nothing to be scored from and would sit at zero
  // forever. Enforced here rather than in the form, so the API and any future
  // caller obey the same rule.
  const taskTitles = (input.tasks ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (taskTitles.length === 0) {
    throw new ForbiddenError(
      "Add at least one task to this goal — a goal is scored by the work inside it.",
    );
  }

  const category = await db.goalCategory.findUnique({
    where: { key: input.categoryKey },
    select: { id: true },
  });
  if (!category) {
    throw new Error(`Unknown goal category: ${input.categoryKey}`);
  }

  const goal = await db.goal.create({
    data: {
      userId: input.userId,
      categoryId: category.id,
      title: input.title,
      description: input.description ?? null,
      targetDate: input.targetDate,
      notes: input.notes ?? null,
      status: "NOT_STARTED",
      progress: 0,
      tasks: {
        create: taskTitles.map((title, index) => ({
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
    progress?: number;
    targetDate?: Date;
    notes?: string;
  },
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const statusFrom = asGoalStatus(goal.status);
  const statusTo = input.status ?? statusFrom;
  const progressFrom = goal.progress;

  // Tasks own the progress bar. Once any exist a caller-supplied progress
  // is ignored outright rather than fought with.
  let progressTo = deriveProgress(
    goal.tasks,
    input.progress ?? progressFrom,
  );

  const completing = statusTo === "COMPLETED" && statusFrom !== "COMPLETED";
  const reopening = statusFrom === "COMPLETED" && statusTo !== "COMPLETED";

  // Marking a goal done is the statement; a bar left at 90 is not.
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

export async function addGoalTask(
  actor: SessionUser,
  goalId: string,
  title: string,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);
  await assertCanEditMentee(actor, goal.userId);

  const count = await db.goalTask.count({ where: { goalId } });
  await db.goalTask.create({ data: { goalId, title, sortOrder: count } });

  // The first task hands the progress bar over to the task list, so a
  // goal sitting at a hand-typed 40% correctly falls back to 0-of-1 done.
  await recomputeGoalProgress(actor, goalId);
}

export async function toggleGoalTask(
  actor: SessionUser,
  goalTaskId: string,
): Promise<void> {
  const task = await db.goalTask.findUnique({
    where: { id: goalTaskId },
    include: { goal: { select: { id: true, userId: true } } },
  });
  if (!task) throw new ForbiddenError("That task no longer exists.");
  await assertCanEditMentee(actor, task.goal.userId);

  const nowComplete = !task.isComplete;
  await db.goalTask.update({
    where: { id: goalTaskId },
    data: {
      isComplete: nowComplete,
      completedAt: nowComplete ? new Date() : null,
    },
  });

  await recomputeGoalProgress(actor, task.goal.id);
}

/**
 * Re-derives a goal's progress from its tasks and records the movement.
 * Shared by `addGoalTask` and `toggleGoalTask` so both agree on the number.
 */
async function recomputeGoalProgress(
  actor: SessionUser,
  goalId: string,
): Promise<void> {
  const goal = await loadGoalOrThrow(goalId);

  const statusFrom = asGoalStatus(goal.status);
  const progressFrom = goal.progress;

  // Ticking the last task does not silently close a goal — completion stays
  // a deliberate act — but a goal already completed remains pinned at 100.
  const progressTo =
    statusFrom === "COMPLETED"
      ? 100
      : deriveProgress(goal.tasks, progressFrom);

  await db.goal.update({
    where: { id: goalId },
    data: { progress: progressTo },
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
    summary: `Task progress on "${goal.title}" — ${progressFrom}% to ${progressTo}%`,
    metadata: { progressFrom, progressTo, source: "task" },
  });
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
