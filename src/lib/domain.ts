/**
 * The shared vocabulary of Abundance Hub.
 *
 * The schema stores these codes as TEXT. This module is the single place that
 * narrows that TEXT back into real union types, and the only place a new
 * status/category/board code should be added.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLE_KEYS = ["ADMIN", "COACH", "MENTEE"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administrator",
  COACH: "Coach",
  MENTEE: "Mentee",
};

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const GOAL_CATEGORY_KEYS = [
  "PERSONAL",
  "PROFESSIONAL",
  "CONTRIBUTION",
] as const;
export type GoalCategoryKey = (typeof GOAL_CATEGORY_KEYS)[number];

export const GOAL_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AT_RISK",
  "COMPLETED",
  "ABANDONED",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  AT_RISK: "At risk",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

/** Statuses that still count against a user's active workload. */
export const OPEN_GOAL_STATUSES: GoalStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AT_RISK",
];

/** Whether the goal's measured metric is being grown or reduced. */
export const GOAL_DIRECTIONS = ["GAIN", "LOSE"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];

/** An action plan's state. */
export const ACTION_PLAN_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
] as const;
export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];

export const ACTION_PLAN_STATUS_LABELS: Record<ActionPlanStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

/**
 * How much each action-plan status counts, 0-100. For a MILESTONE goal the
 * average of these weights across its plans IS the goal score. For a MERIT goal
 * the plans are informational and this figure is shown but never folded into the
 * score, which is the numeric measure alone.
 */
export const PLAN_STATUS_WEIGHT: Record<ActionPlanStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  DONE: 100,
};

/**
 * A goal is one of two kinds:
 *   MERIT     — a numeric measure chipped away over time (current ÷ target),
 *               optionally with a recurring per-period target (see TARGET_PERIODS).
 *   MILESTONE — scored by its action plans (the average of PLAN_STATUS_WEIGHT),
 *               with no numeric measure.
 */
export const GOAL_TYPES = ["MERIT", "MILESTONE"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  MERIT: "Merit",
  MILESTONE: "Milestone",
};

/**
 * A MERIT goal's cadence. Its per-period target recurs this often between the
 * start and the target date; NONE means no recurring task — the current value is
 * edited by hand.
 */
export const TARGET_PERIODS = [
  "NONE",
  "DAILY",
  "EVERY_2",
  "EVERY_3",
  "EVERY_4",
  "EVERY_5",
  "EVERY_6",
  "WEEKLY",
] as const;
export type TargetPeriod = (typeof TARGET_PERIODS)[number];

/** How many days one period spans. NONE has no cadence. */
export const PERIOD_DAYS: Record<TargetPeriod, number> = {
  NONE: 0,
  DAILY: 1,
  EVERY_2: 2,
  EVERY_3: 3,
  EVERY_4: 4,
  EVERY_5: 5,
  EVERY_6: 6,
  WEEKLY: 7,
};

export const TARGET_PERIOD_LABELS: Record<TargetPeriod, string> = {
  NONE: "No recurring target",
  DAILY: "Daily",
  EVERY_2: "Every 2 days",
  EVERY_3: "Every 3 days",
  EVERY_4: "Every 4 days",
  EVERY_5: "Every 5 days",
  EVERY_6: "Every 6 days",
  WEEKLY: "Weekly",
};

/**
 * How many whole periods of length `periodDays` fit in `daysRemaining` — at
 * least one, so a target due sooner than a full period still has something to
 * aim at.
 */
export function periodsRemaining(
  daysRemaining: number,
  periodDays: number,
): number {
  if (periodDays <= 0) return 0;
  return Math.max(1, Math.floor(daysRemaining / periodDays));
}

/**
 * The amount a MERIT goal should log each period to close the gap from `current`
 * to `target` by the target date. Rounded to two decimals for a clean label.
 */
export function perPeriodTarget(
  target: number,
  current: number,
  daysRemaining: number,
  periodDays: number,
): number {
  const periods = periodsRemaining(daysRemaining, periodDays);
  if (periods <= 0) return 0;
  const remaining = Math.max(0, target - current);
  return Math.round((remaining / periods) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Weights for the Overall Score. The Overall Score IS the Goal Total Score — the
 * three goal categories are the whole of it. Core tasks and consistency are
 * still tracked and shown to the mentee, but they no longer move any score. The
 * weights still sum to 1 and live here so the blend can be re-tuned later
 * without touching the scoring engine.
 */
export const SCORE_WEIGHTS = {
  goals: 1, // the three goal categories are the entire Overall Score
  coreTasks: 0, // tracked, but not scored
  consistency: 0, // tracked, but not scored
} as const;

/** Within the goal half of the score, each category pulls equal weight. */
export const GOAL_CATEGORY_WEIGHTS: Record<GoalCategoryKey, number> = {
  PERSONAL: 1 / 3,
  PROFESSIONAL: 1 / 3,
  CONTRIBUTION: 1 / 3,
};

/**
 * Core-task and consistency scores are measured over a trailing window rather
 * than all-time, so a strong month can't be coasted on and a weak first week
 * can't sink someone forever.
 */
export const SCORING_WINDOW_DAYS = 30;

/** How much of the consistency score comes from streak vs check-in cadence. */
export const CONSISTENCY_WEIGHTS = {
  streak: 0.6,
  checkIns: 0.4,
} as const;

/** A streak this long saturates the streak half of the consistency score. */
export const STREAK_TARGET_DAYS = 30;

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export const LEADERBOARD_BOARDS = [
  "GROUP", // mentees within one coaching group
  "COACH", // coaches, by the average score of their mentees
  "ORGANIZATION", // every user in the org
  "CORE_TASK", // daily discipline only
  "GOAL_COMPLETION", // completed goals only
  "CONSISTENCY", // streaks only
] as const;
export type LeaderboardBoard = (typeof LEADERBOARD_BOARDS)[number];

export const LEADERBOARD_LABELS: Record<LeaderboardBoard, string> = {
  GROUP: "Group",
  COACH: "Coaches",
  ORGANIZATION: "Organization",
  CORE_TASK: "Core Tasks",
  GOAL_COMPLETION: "Goal Completion",
  CONSISTENCY: "Consistency",
};

export const LEADERBOARD_DESCRIPTIONS: Record<LeaderboardBoard, string> = {
  GROUP: "Every mentee inside your coaching group, by overall score.",
  COACH: "Coaches ranked by the average score of the mentees they lead.",
  ORGANIZATION: "Every member of Abundance Hub, by overall score.",
  CORE_TASK: "Ranked purely on daily discipline — core tasks completed.",
  GOAL_COMPLETION: "Ranked on goals carried all the way to done.",
  CONSISTENCY: "Ranked on streaks — showing up, day after day.",
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  "CORE_TASK_REMINDER",
  "MISSED_TASK",
  "GOAL_DEADLINE",
  "COACH_FEEDBACK",
  "CHECK_IN_REMINDER",
  "LEADERBOARD_CHANGE",
  "ACHIEVEMENT_UNLOCKED",
  "GROUP_UPDATE",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  CORE_TASK_REMINDER: "Core task reminders",
  MISSED_TASK: "Missed tasks",
  GOAL_DEADLINE: "Goal deadlines",
  COACH_FEEDBACK: "Coach feedback",
  CHECK_IN_REMINDER: "Check-in reminders",
  LEADERBOARD_CHANGE: "Leaderboard movement",
  ACHIEVEMENT_UNLOCKED: "Achievements",
  GROUP_UPDATE: "Group updates",
};

export const NOTIFICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const ACTIVITY_TYPES = [
  "GOAL_CREATED",
  "GOAL_UPDATED",
  "GOAL_COMPLETED",
  "TASK_COMPLETED",
  "CHECK_IN_SUBMITTED",
  "NOTE_ADDED",
  "COMMENT_ADDED",
  "MEMBER_JOINED",
  "ACHIEVEMENT_UNLOCKED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Misc codes
// ---------------------------------------------------------------------------

export const NOTE_VISIBILITIES = ["PRIVATE", "SHARED"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];

export const ACHIEVEMENT_TIERS = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

// ---------------------------------------------------------------------------
// Goal rank medals — a goal's completion percentage (0-100) maps to one of ten
// ascending ranks, one per 10-point band: 0-10% is Herald, 90-100% is Titan.
// The rank is pure display flavour on top of the score; it never feeds scoring.
// ---------------------------------------------------------------------------

export const GOAL_RANKS = [
  { key: "HERALD", name: "Herald" },
  { key: "GUARDIAN", name: "Guardian" },
  { key: "CRUSADER", name: "Crusader" },
  { key: "ARCHON", name: "Archon" },
  { key: "LEGEND", name: "Legend" },
  { key: "ANCIENT", name: "Ancient" },
  { key: "DIVINE", name: "Divine" },
  { key: "IMMORTAL", name: "Immortal" },
  { key: "MASTER_IMMORTAL", name: "Master Immortal" },
  { key: "TITAN", name: "Titan" },
] as const;

export type GoalRankKey = (typeof GOAL_RANKS)[number]["key"];
export type GoalRank = {
  key: GoalRankKey;
  name: string;
  /** Band bounds as whole percents — e.g. Divine is 60–70. */
  min: number;
  max: number;
};

/**
 * The rank medal for a goal's completion percentage (0-100). Each 10-point band
 * is one rank; the input is clamped, and a full 100% lands in the top band
 * (Titan) rather than falling off the end.
 */
export function rankForPercent(percent: number): GoalRank {
  const clamped = Math.min(100, Math.max(0, percent));
  const index = Math.min(GOAL_RANKS.length - 1, Math.floor(clamped / 10));
  const def = GOAL_RANKS[index]!;
  return {
    key: def.key,
    name: def.name,
    min: index * 10,
    max: index === GOAL_RANKS.length - 1 ? 100 : index * 10 + 10,
  };
}

export const MOOD_LABELS: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Energised",
};

// ---------------------------------------------------------------------------
// Narrowing helpers — every TEXT code read from the database passes through one
// of these, so a bad value surfaces at the boundary instead of deep inside a view.
// ---------------------------------------------------------------------------

function narrow<T extends string>(
  allowed: readonly T[],
  value: string,
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export const asRoleKey = (v: string) => narrow(ROLE_KEYS, v, "MENTEE");
export const asGoalStatus = (v: string) =>
  narrow(GOAL_STATUSES, v, "NOT_STARTED");
export const asGoalType = (v: string) => narrow(GOAL_TYPES, v, "MERIT");
export const asTargetPeriod = (v: string) => narrow(TARGET_PERIODS, v, "NONE");
export const asActionPlanStatus = (v: string) =>
  narrow(ACTION_PLAN_STATUSES, v, "NOT_STARTED");
export const asGoalCategoryKey = (v: string) =>
  narrow(GOAL_CATEGORY_KEYS, v, "PERSONAL");
export const asBoard = (v: string) => narrow(LEADERBOARD_BOARDS, v, "GROUP");
export const asNotificationType = (v: string) =>
  narrow(NOTIFICATION_TYPES, v, "GROUP_UPDATE");
export const asNoteVisibility = (v: string) =>
  narrow(NOTE_VISIBILITIES, v, "PRIVATE");
