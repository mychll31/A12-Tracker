/**
 * The achievement catalogue.
 *
 * Pure data on purpose: the seed script imports this under plain Node and the
 * runtime evaluator imports it inside the Next.js server. Adding any import
 * here — especially a `server-only` guard — would break the seed.
 *
 * `criteria` is a JSON string rather than a nested object because the schema
 * stores it verbatim in `achievements.criteria` (SQLite has no Json scalar).
 * Every rule is a single `{ metric, gte }` pair, checked against the fields of
 * a computed `UserScore`.
 */

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  criteria: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // --- Streaks: showing up, day after day ---
  {
    key: "STREAK_7",
    name: "First Flame",
    description: "Kept a 7-day streak. The habit has caught.",
    icon: "flame",
    tier: "BRONZE",
    criteria: '{"metric":"streak","gte":7}',
  },
  {
    key: "STREAK_30",
    name: "Thirty Days Strong",
    description: "Kept a 30-day streak. A full month without a gap.",
    icon: "zap",
    tier: "SILVER",
    criteria: '{"metric":"streak","gte":30}',
  },
  {
    key: "STREAK_100",
    name: "Unbroken",
    description: "Kept a 100-day streak. Discipline has become identity.",
    icon: "crown",
    tier: "PLATINUM",
    criteria: '{"metric":"streak","gte":100}',
  },

  // --- Goals carried all the way to done ---
  {
    key: "GOALS_COMPLETED_1",
    name: "First Finish",
    description: "Completed your first goal. Proof that it can be done.",
    icon: "target",
    tier: "BRONZE",
    criteria: '{"metric":"goalsCompleted","gte":1}',
  },
  {
    key: "GOALS_COMPLETED_5",
    name: "Closer",
    description: "Completed 5 goals. Finishing is now the pattern.",
    icon: "award",
    tier: "SILVER",
    criteria: '{"metric":"goalsCompleted","gte":5}',
  },
  {
    key: "GOALS_COMPLETED_10",
    name: "Goal Architect",
    description: "Completed 10 goals across your three categories.",
    icon: "trophy",
    tier: "GOLD",
    criteria: '{"metric":"goalsCompleted","gte":10}',
  },

  // --- Overall score: the whole picture ---
  {
    key: "OVERALL_SCORE_60",
    name: "Finding Rhythm",
    description: "Reached an overall score of 60. The system is working.",
    icon: "compass",
    tier: "BRONZE",
    criteria: '{"metric":"overallScore","gte":60}',
  },
  {
    key: "OVERALL_SCORE_80",
    name: "High Performer",
    description: "Reached an overall score of 80. Top of the room.",
    icon: "sparkles",
    tier: "GOLD",
    criteria: '{"metric":"overallScore","gte":80}',
  },
  {
    key: "OVERALL_SCORE_90",
    name: "Abundance Elite",
    description: "Reached an overall score of 90. Rare air.",
    icon: "medal",
    tier: "PLATINUM",
    criteria: '{"metric":"overallScore","gte":90}',
  },

  // --- Daily disciplines: the four core tasks ---
  {
    key: "TASK_RATE_80",
    name: "Disciplined",
    description: "Completed 80% of your core tasks over the last 30 days.",
    icon: "check-check",
    tier: "SILVER",
    criteria: '{"metric":"taskCompletionRate","gte":80}',
  },
  {
    key: "TASK_RATE_95",
    name: "Immovable",
    description: "Completed 95% of your core tasks over the last 30 days.",
    icon: "sunrise",
    tier: "GOLD",
    criteria: '{"metric":"taskCompletionRate","gte":95}',
  },

  // --- Reflection: the daily check-in ---
  {
    key: "CHECK_IN_RATE_80",
    name: "Examined Life",
    description: "Filed a check-in on 80% of the last 30 days.",
    icon: "heart-handshake",
    tier: "SILVER",
    criteria: '{"metric":"checkInRate","gte":80}',
  },
];
