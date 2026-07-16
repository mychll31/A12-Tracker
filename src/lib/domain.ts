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
 * How much each status counts toward a goal's *informational* action-plan
 * completion figure. This is shown next to a goal but never folded into the
 * goal score, which is the numeric measure alone.
 */
export const PLAN_STATUS_WEIGHT: Record<ActionPlanStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  DONE: 100,
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Weights for the Overall Score. They sum to 1, so the overall score lands on
 * the same 0-100 scale as its components and stays directly comparable across
 * users, groups and the organization.
 */
export const SCORE_WEIGHTS = {
  goals: 0.5, // the three goal categories, combined
  coreTasks: 0.3, // daily discipline
  consistency: 0.2, // streaks and check-in cadence
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
export const asGoalCategoryKey = (v: string) =>
  narrow(GOAL_CATEGORY_KEYS, v, "PERSONAL");
export const asBoard = (v: string) => narrow(LEADERBOARD_BOARDS, v, "GROUP");
export const asNotificationType = (v: string) =>
  narrow(NOTIFICATION_TYPES, v, "GROUP_UPDATE");
export const asNoteVisibility = (v: string) =>
  narrow(NOTE_VISIBILITIES, v, "PRIVATE");
