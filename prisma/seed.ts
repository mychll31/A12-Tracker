/**
 * Abundance Hub — database seed.
 *
 * Runs under plain Node via `tsx prisma/seed.ts` (wired in prisma.config.ts).
 * Because of that it may only import modules that are NOT `server-only`
 * guarded: db, dates, domain, scoring, achievement-defs. Passwords are hashed
 * with bcryptjs directly at cost 12 — the same cost src/lib/auth.ts uses.
 *
 * Two properties this script must hold:
 *
 *   Idempotent   — every row is written through an upsert on a natural key, or
 *                  skipped when its id already exists. Re-running changes nothing.
 *   Deterministic — all "randomness" comes from a seeded mulberry32 PRNG with a
 *                  per-user stream. Math.random() is never called, so two runs
 *                  produce identical data and row ids stay stable.
 *
 * Row ids are hand-built (`goal_priya_2`) rather than cuids precisely so that a
 * re-run can recognise what it already wrote.
 */

import "dotenv/config";

import bcrypt from "bcryptjs";

import { ACHIEVEMENT_DEFS } from "@/lib/achievement-defs";
import { addDays, dayKey, isoDay, today } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  NOTIFICATION_TYPES,
  type GoalCategoryKey,
  type GoalStatus,
  type LeaderboardBoard,
  type RoleKey,
} from "@/lib/domain";
import {
  computeCoachScores,
  computeScoresForUsers,
  persistSnapshots,
  type UserScore,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

const SEED = 0xabf00d;

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a — gives every user their own PRNG stream, so editing one person's
 * profile does not reshuffle everybody else's history.
 */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const streamFor = (name: string): Rng =>
  mulberry32((SEED ^ hashString(name)) >>> 0);

const int = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

const chance = (rng: Rng, p: number): boolean => rng() < p;

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

const clampInt = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function takeEvenly<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)] as T);
}

/** A time-of-day on a UTC day bucket, so rows don't all land on midnight. */
const atHour = (day: Date, hour: number): Date =>
  new Date(day.getTime() + hour * 3_600_000);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "org_abundance_hub";
const PASSWORD = "Abundance123!";
const BCRYPT_COST = 12;
const HISTORY_DAYS = 60;
const SNAPSHOT_DAYS = 60;

const TODAY = today();

const ROLES: { key: RoleKey; name: string; description: string }[] = [
  {
    key: "ADMIN",
    name: "Administrator",
    description:
      "Full access to the organization, its people and its settings.",
  },
  {
    key: "COACH",
    name: "Coach",
    description: "Leads a coaching group, reviews mentees and writes notes.",
  },
  {
    key: "MENTEE",
    name: "Mentee",
    description:
      "Sets goals in all three categories and logs the daily disciplines.",
  },
];

const CATEGORIES: {
  key: GoalCategoryKey;
  name: string;
  description: string;
  accent: string;
  sortOrder: number;
}[] = [
  {
    key: "PERSONAL",
    name: "Personal",
    description: "Health, family, character — the life the rest of it is for.",
    accent: "violet",
    sortOrder: 0,
  },
  {
    key: "PROFESSIONAL",
    name: "Professional",
    description: "Career, craft and the results you are paid to produce.",
    accent: "sky",
    sortOrder: 1,
  },
  {
    key: "CONTRIBUTION",
    name: "Contribution",
    description:
      "What you give back — people lifted, hours served, doors opened.",
    accent: "emerald",
    sortOrder: 2,
  },
];

const CORE_TASKS: {
  key: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
}[] = [
  {
    key: "MEDITATION",
    name: "Meditation",
    description: "Twenty minutes of stillness before the day gets a vote.",
    icon: "brain",
    sortOrder: 0,
  },
  {
    key: "COACHING_CALL",
    name: "Coaching Call",
    description: "Connect with your coach or someone in your group.",
    icon: "phone",
    sortOrder: 1,
  },
  {
    key: "EXERCISE",
    name: "Exercise",
    description: "Move the body. Thirty minutes, anything that counts.",
    icon: "dumbbell",
    sortOrder: 2,
  },
  {
    key: "EVERYDAY_LEARNING",
    name: "Everyday Learning",
    description: "Read, study or practise something that compounds.",
    icon: "book-open",
    sortOrder: 3,
  },
];

// ---------------------------------------------------------------------------
// People
//
// Coach Maychell, Coach Diana and Coach Raviel each run their own group of
// three mentees. Maychell is ALSO a mentee inside Diana's group — one account,
// two roles, no duplicate.
// ---------------------------------------------------------------------------

type Profile = {
  /** Chance the user showed up at all on a given day. */
  dayRate: number;
  /** Chance each of the four core tasks got done on a day they showed up. */
  taskRate: number;
  /** Chance a check-in was filed on a day they showed up. */
  checkInRate: number;
  moodBase: number;
  /** Most recent N days that are never missed — what makes a real streak. */
  streakGuarantee: number;
  /** The at-risk case: strong early, then near-silence for the last 10 days. */
  fellOff?: boolean;
};

type SeedPerson = {
  slug: string;
  firstName: string;
  lastName: string;
  headline: string;
  roles: RoleKey[];
  joinedDaysAgo: number;
  /** Slug of the coach whose group this person is a mentee in. */
  coachSlug?: string;
  profile: Profile;
};

const PEOPLE: SeedPerson[] = [
  {
    slug: "admin",
    firstName: "Avery",
    lastName: "Stone",
    headline: "Platform steward — keeping Abundance Hub honest",
    roles: ["ADMIN", "COACH"],
    joinedDaysAgo: 90,
    profile: {
      dayRate: 0.8,
      taskRate: 0.75,
      checkInRate: 0.55,
      moodBase: 3,
      streakGuarantee: 2,
    },
  },

  // --- Coaches ---
  {
    slug: "maychell",
    firstName: "Maychell",
    lastName: "Alcorin",
    headline: "Coach and lifelong student — still being coached myself",
    roles: ["COACH", "MENTEE"], // the dual-role case, on one account
    joinedDaysAgo: 88,
    coachSlug: "diana", // mentored inside Diana's group
    profile: {
      dayRate: 1,
      taskRate: 0.96,
      checkInRate: 0.93,
      moodBase: 5,
      streakGuarantee: 45,
    },
  },
  {
    slug: "diana",
    firstName: "Diana",
    lastName: "Reyes",
    headline: "Sales leader turned coach — allergic to vague goals",
    roles: ["COACH"],
    joinedDaysAgo: 86,
    profile: {
      dayRate: 0.88,
      taskRate: 0.84,
      checkInRate: 0.7,
      moodBase: 4,
      streakGuarantee: 5,
    },
  },
  {
    slug: "raviel",
    firstName: "Raviel",
    lastName: "Cruz",
    headline: "Coach — I care more about your Tuesdays than your breakthroughs",
    roles: ["COACH"],
    joinedDaysAgo: 84,
    profile: {
      dayRate: 0.85,
      taskRate: 0.8,
      checkInRate: 0.62,
      moodBase: 4,
      streakGuarantee: 3,
    },
  },

  // --- Maychell's Circle ---
  {
    slug: "jonah",
    firstName: "Jonah",
    lastName: "Whitfield",
    headline: "Account executive rebuilding his mornings",
    roles: ["MENTEE"],
    joinedDaysAgo: 74,
    coachSlug: "maychell",
    profile: {
      dayRate: 0.86,
      taskRate: 0.82,
      checkInRate: 0.66,
      moodBase: 4,
      streakGuarantee: 4,
    },
  },
  {
    slug: "priya",
    firstName: "Priya",
    lastName: "Nadkarni",
    headline: "Staff engineer — compounding small reps since day one",
    roles: ["MENTEE"],
    joinedDaysAgo: 82,
    coachSlug: "maychell",
    profile: {
      dayRate: 0.99,
      taskRate: 0.95,
      checkInRate: 0.9,
      moodBase: 5,
      streakGuarantee: 34,
    },
  },
  {
    slug: "marcus",
    firstName: "Marcus",
    lastName: "Delgado",
    headline: "Restaurant owner learning to schedule himself",
    roles: ["MENTEE"],
    joinedDaysAgo: 62,
    coachSlug: "maychell",
    profile: {
      dayRate: 0.58,
      taskRate: 0.72,
      checkInRate: 0.3,
      moodBase: 2,
      streakGuarantee: 0,
    },
  },

  // --- Diana's Circle (plus Maychell, above) ---
  {
    slug: "elena",
    firstName: "Elena",
    lastName: "Vasquez",
    headline: "Regional director — 30% up and not done yet",
    roles: ["MENTEE"],
    joinedDaysAgo: 78,
    coachSlug: "diana",
    profile: {
      dayRate: 0.98,
      taskRate: 0.93,
      checkInRate: 0.88,
      moodBase: 5,
      streakGuarantee: 26,
    },
  },
  {
    slug: "tomas",
    firstName: "Tomas",
    lastName: "Lindqvist",
    headline: "Product manager — strong start, rough patch",
    roles: ["MENTEE"],
    joinedDaysAgo: 58,
    coachSlug: "diana",
    profile: {
      dayRate: 0.88,
      taskRate: 0.85,
      checkInRate: 0.72,
      moodBase: 3,
      streakGuarantee: 0,
      fellOff: true,
    },
  },
  {
    slug: "grace",
    firstName: "Grace",
    lastName: "Okonkwo",
    headline: "Nurse practitioner building a consulting practice on the side",
    roles: ["MENTEE"],
    joinedDaysAgo: 70,
    coachSlug: "diana",
    profile: {
      dayRate: 0.84,
      taskRate: 0.8,
      checkInRate: 0.64,
      moodBase: 4,
      streakGuarantee: 2,
    },
  },

  // --- Raviel's Circle ---
  {
    slug: "samuel",
    firstName: "Samuel",
    lastName: "Bright",
    headline: "Founder — great at starting, working on finishing",
    roles: ["MENTEE"],
    joinedDaysAgo: 50,
    coachSlug: "raviel",
    profile: {
      dayRate: 0.5,
      taskRate: 0.7,
      checkInRate: 0.26,
      moodBase: 2,
      streakGuarantee: 0,
    },
  },
  {
    slug: "nadia",
    firstName: "Nadia",
    lastName: "Farouk",
    headline: "Designer — trading perfectionism for reps",
    roles: ["MENTEE"],
    joinedDaysAgo: 42,
    coachSlug: "raviel",
    profile: {
      dayRate: 0.62,
      taskRate: 0.7,
      checkInRate: 0.34,
      moodBase: 3,
      streakGuarantee: 0,
    },
  },
  {
    slug: "liam",
    firstName: "Liam",
    lastName: "Torres",
    headline: "Teacher and volunteer coach — quietly consistent",
    roles: ["MENTEE"],
    joinedDaysAgo: 66,
    coachSlug: "raviel",
    profile: {
      dayRate: 0.87,
      taskRate: 0.83,
      checkInRate: 0.68,
      moodBase: 4,
      streakGuarantee: 3,
    },
  },
];

const COACHES: { slug: string; group: string; description: string }[] = [
  {
    slug: "maychell",
    group: "Maychell's Circle",
    description:
      "Operators and builders. We meet on Tuesdays and we do not do vague.",
  },
  {
    slug: "diana",
    group: "Diana's Circle",
    description:
      "Revenue leaders — and the coaches who coach them. Numbers on the table.",
  },
  {
    slug: "raviel",
    group: "Raviel's Circle",
    description: "Founders, teachers and makers. We win the ordinary Tuesday.",
  },
];

const emailFor = (slug: string): string => `${slug}@abundancehub.io`;
const userIdFor = (slug: string): string => `user_${slug}`;
const groupIdFor = (coachSlug: string): string => `group_${coachSlug}`;

// ---------------------------------------------------------------------------
// Copy pools — 12 rotating variants each, so check-ins never read as copy-paste
// ---------------------------------------------------------------------------

const WINS = [
  "Closed the quarter's biggest deal after three weeks of patient follow-up.",
  "Trained before sunrise every day this week — no snoozing, no negotiating.",
  "Finally shipped the proposal I had been sitting on for a month.",
  "Had the hard conversation with my brother, and it went better than I feared.",
  "Meditated a full twenty minutes without reaching for my phone once.",
  "Ran further than I ever have without stopping to walk.",
  "Said no to a project that did not fit, and did not apologise for it.",
  "Walked a teammate through a bug she had been stuck on for two days.",
  "Cooked every meal at home this week instead of ordering in.",
  "Cleared the inbox to zero for the first time since March.",
  "Read two chapters before bed instead of scrolling.",
  "Got the whole team aligned on the roadmap in a single meeting.",
];

const CHALLENGES = [
  "Kept getting pulled into meetings that had nothing to do with my priorities.",
  "Energy crashed hard in the afternoon — the sleep debt is catching up.",
  "Procrastinated on the outreach calls again. It is the fear of the no.",
  "Two of my goals are competing for the same hours, and I am losing both.",
  "Family came first this weekend, and the training plan quietly slipped.",
  "Could not hold focus with the open-plan noise all day.",
  "Said yes to something I knew I should have declined.",
  "Comparison crept in when I opened the leaderboard this morning.",
  "The learning block is the first thing sacrificed when the day runs long.",
  "Skipped the workout twice. The excuse was 'too busy' and it was not true.",
  "Motivation was flat and I coasted through most of the afternoon.",
  "Lost an hour to email before touching anything that actually mattered.",
];

const LESSONS = [
  "Discipline shows up long before motivation does.",
  "If it is not on the calendar, it is not real.",
  "Small daily reps beat heroic weekend sprints, every single time.",
  "The task I avoid the longest is usually the one that moves the needle.",
  "Sleep is not a luxury. It is the input to everything else.",
  "Saying no to good things is how you protect the great ones.",
  "Progress compounds quietly. You only notice it looking backwards.",
  "Asking for help two days earlier would have saved me two days.",
  "My best hours are the first two — stop spending them on email.",
  "A missed day is a data point, not a verdict.",
  "Clarity comes from writing it down, not from thinking harder.",
  "Consistency is a skill, and skills can be trained.",
];

const GRATITUDE = [
  "Grateful for a coach who tells me the truth instead of what is comfortable.",
  "Grateful for a body that still shows up when I ask it to.",
  "Grateful for the teammate who covered for me without being asked.",
  "Grateful for a quiet morning and a full cup of coffee.",
  "Grateful that my sister called, just to check in.",
  "Grateful for work that actually means something to me.",
  "Grateful for the friend who reminded me why I started this.",
  "Grateful for a roof, a warm meal, and another chance to get it right.",
  "Grateful for the group — it is hard to quit when people are watching.",
  "Grateful for the rain. It made the run feel earned.",
  "Grateful for the client who trusted us with this one.",
  "Grateful for a day that asked something of me.",
];

const TOMORROW = [
  "Ninety minutes of deep work before I open a single message.",
  "Make the three outreach calls I have been dodging all week.",
  "Finish the draft, even if it comes out ugly.",
  "Move my body first thing, before the day gets a vote.",
  "One hour on the certification. Not negotiable.",
  "Sit down with the numbers and stop guessing.",
  "Block the afternoon for the mentee session and defend it.",
  "Say no to at least one thing that is not mine to carry.",
  "Lights out by ten. That is the whole plan.",
  "Ship it. Perfect can arrive in version two.",
  "Walk the neighbourhood and actually think — no headphones.",
  "Reset the week: review the goals, clear the board, start clean.",
];

const GOAL_TEMPLATES: Record<
  GoalCategoryKey,
  { title: string; description: string }[]
> = {
  PERSONAL: [
    {
      title: "Lose 15 pounds",
      description:
        "Down to 175 by year end without crash dieting. Strength and sleep first.",
    },
    {
      title: "Read 24 books this year",
      description:
        "Two a month, alternating non-fiction and fiction. Thirty pages before bed.",
    },
    {
      title: "Repair relationship with my brother",
      description:
        "Monthly calls, one visit before winter, and no keeping score.",
    },
    {
      title: "Run a half marathon",
      description: "Sub two hours, injury-free, off a sixteen-week base plan.",
    },
    {
      title: "Sleep seven hours every night",
      description: "Lights out by 10:30. The phone charges outside the bedroom.",
    },
    {
      title: "Cut screen time to two hours a day",
      description:
        "Reclaim the evenings from the algorithm and give them back to my family.",
    },
  ],
  PROFESSIONAL: [
    {
      title: "Increase sales by 30%",
      description:
        "From $1.8M to $2.35M this year. Pipeline discipline over hero deals.",
    },
    {
      title: "Launch consulting business",
      description:
        "Registered, three paying clients, and one repeatable offer I can sell twice.",
    },
    {
      title: "Get promoted to senior",
      description: "Own a workstream end to end, and be visible while doing it.",
    },
    {
      title: "Earn the PMP certification",
      description:
        "Thirty-five contact hours, then sit the exam before the end of Q4.",
    },
    {
      title: "Ship the platform rewrite",
      description: "Cut over with no downtime and retire the legacy stack for good.",
    },
    {
      title: "Speak at a national conference",
      description:
        "One accepted talk, on work I actually did, to people who can tell.",
    },
  ],
  CONTRIBUTION: [
    {
      title: "Mentor 3 junior colleagues",
      description:
        "Weekly one-to-ones, honest feedback, and a stretch project each.",
    },
    {
      title: "Volunteer 100 hours",
      description:
        "Saturdays at the shelter kitchen. Show up when it is inconvenient.",
    },
    {
      title: "Serve on the community board",
      description:
        "Run for the seat, win it, and actually do the reading before meetings.",
    },
    {
      title: "Teach a free weekend workshop",
      description: "Four sessions, open to anyone, no gatekeeping and no upsell.",
    },
    {
      title: "Raise $10k for the youth shelter",
      description: "One campaign, one event, and a great deal of asking.",
    },
    {
      title: "Sponsor a scholarship student",
      description: "Fund one year, then stay in their corner for the other three.",
    },
  ],
};

const GOAL_TASK_TITLES = [
  "Write the plan down",
  "Clear the first checkpoint",
  "Set the baseline measurement",
  "Hit the halfway mark",
  "Get outside accountability",
  "Review progress with my coach",
  "Push through the messy middle",
  "Cross the finish line",
];

const UPDATE_NOTES = [
  "Two solid weeks. The routine is finally holding.",
  "Slower than I wanted, but moving.",
  "Reset the plan after a rough stretch — smaller steps this time.",
  "Big jump this week. The momentum is real.",
  "Blocked on something outside my control; adjusting the target.",
  "My coach pushed me on this one, and she was right.",
  "Back on track after losing a week to travel.",
  "Halfway. The second half is the hard half.",
];

const COMMENT_BODIES = [
  "This is the one I want you to protect when the week gets loud.",
  "Good movement. Now make the next task measurable.",
  "You are three weeks behind where we said you would be. Let's talk Tuesday.",
  "Proud of this. Do not let up now.",
  "Be honest with yourself about whether this is still the right goal.",
  "The progress bar says 40. Your calendar says otherwise. Which one is lying?",
  "Excellent. Write down what worked, so you can repeat it.",
  "Flagging this as at-risk. Not a judgement — just the truth of the timeline.",
];

const NOTE_TITLES = [
  "Week four check-in",
  "Momentum is building",
  "Course correction needed",
  "Quarterly goal review",
  "Pipeline conversation",
  "Reset and refocus",
  "Strong month — let's compound it",
  "Where the time is actually going",
  "Hard truths, said kindly",
  "The next ninety days",
];

const NOTE_BODIES = [
  "<p><strong>What is working:</strong> the morning routine is holding. Four core tasks on most days.</p><ul><li>Meditation is now automatic</li><li>Exercise slips on travel days</li></ul><p>We agreed to protect the first hour of the day.</p>",
  "<p>Honest session today. <strong>The professional goal is drifting</strong> and we both know why.</p><ul><li>Too many yeses</li><li>No hard stop in the evenings</li></ul><p>Next step: one thing comes off the calendar before we meet again.</p>",
  "<p><strong>Big week.</strong> Closed the deal and still kept the streak alive.</p><p>My concern is the contribution category — it is the first thing to go when work gets heavy. We named that today.</p>",
  "<p>Discussed the check-ins. They have become a formality — three words and a shrug.</p><ul><li>Write for yourself, not for me</li><li>One real sentence beats five polite ones</li></ul>",
  "<p><strong>At risk.</strong> Two goals with no movement in three weeks, and a broken streak.</p><p>Not a crisis, but it is a pattern now. We are shrinking the goals rather than abandoning them.</p><ul><li>Halve the target</li><li>Rebuild the streak from one day</li></ul>",
  "<p>Reviewed all three categories side by side for the first time.</p><p><strong>Personal</strong> is carrying the score. <strong>Professional</strong> is fine. <strong>Contribution</strong> is empty — and that is the one they said mattered most in our first session.</p>",
];

const ACTION_ITEMS = [
  "Book the three outreach calls",
  "Draft the first task plan",
  "Send me your revised targets",
  "Schedule the difficult conversation",
  "Track sleep for seven days",
  "Rewrite the contribution goal — it is too vague",
  "Set a hard stop at 6pm and hold it",
  "Share the reading list with the group",
  "Log the core tasks every day this week",
  "Bring the numbers to our next session",
];

const REVIEW_COMMENTS = [
  "This is the most honest check-in you have written. More of this.",
  "Good week. Now do it again when nobody is watching.",
  "I hear the frustration. Shrink the next step until it is impossible to skip.",
  "The gratitude line stopped me. Do not underestimate what that does for you.",
  "I noticed the missed days. What is the one thing that would have saved them?",
  "Strong. Bring this energy to Tuesday's session.",
];

// ---------------------------------------------------------------------------
// Generated history
// ---------------------------------------------------------------------------

type DayHistory = {
  day: Date;
  taskKeys: string[];
  checkIn: {
    wins: string;
    challenges: string;
    lessons: string;
    gratitude: string;
    tomorrowFocus: string;
    mood: number;
  } | null;
};

/**
 * A user's trailing 60 days, shaped by their discipline profile.
 *
 * Only days they actually showed up produce rows — absence is what makes a day
 * "missed", so no `completed: false` tombstones are ever written. The window is
 * clamped at joinedAt: a completion cannot predate the account.
 */
function buildHistory(person: SeedPerson): DayHistory[] {
  const rng = streamFor(`history:${person.slug}`);
  const days: DayHistory[] = [];
  const span = Math.min(HISTORY_DAYS, person.joinedDaysAgo);

  for (let n = span - 1; n >= 0; n -= 1) {
    const day = dayKey(addDays(TODAY, -n));
    const { profile } = person;

    // The at-risk case: active early, then near-silence for the last 10 days.
    const late = profile.fellOff === true && n < 10;
    const dayRate = late ? 0.06 : profile.dayRate;
    const taskRate = late ? 0.4 : profile.taskRate;
    const checkInRate = late ? 0 : profile.checkInRate;

    const active = n < profile.streakGuarantee || chance(rng, dayRate);
    if (!active) {
      days.push({ day, taskKeys: [], checkIn: null });
      continue;
    }

    let taskKeys = CORE_TASKS.filter(() => chance(rng, taskRate)).map(
      (t) => t.key,
    );
    // A day the user showed up must produce at least one row, or the streak
    // arithmetic in scoring.ts would never see it.
    if (taskKeys.length === 0) taskKeys = [CORE_TASKS[0].key];

    const filesCheckIn = chance(rng, checkInRate);
    const mood = clampInt(
      profile.moodBase + int(rng, -1, 1) - (late ? 2 : 0),
      1,
      5,
    );

    days.push({
      day,
      taskKeys,
      checkIn: filesCheckIn
        ? {
            wins: pick(rng, WINS),
            challenges: pick(rng, CHALLENGES),
            lessons: pick(rng, LESSONS),
            gratitude: pick(rng, GRATITUDE),
            tomorrowFocus: pick(rng, TOMORROW),
            mood,
          }
        : null,
    });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

type PlannedGoal = {
  id: string;
  categoryKey: GoalCategoryKey;
  title: string;
  description: string;
  status: GoalStatus;
  progress: number;
  startDate: Date;
  targetDate: Date;
  completedAt: Date | null;
};

/** Abandoned goals are rare by design — a couple across the whole org. */
let abandonedBudget = 2;

function planGoals(person: SeedPerson): PlannedGoal[] {
  const rng = streamFor(`goals:${person.slug}`);
  const goals: PlannedGoal[] = [];

  // All three categories are required, so everyone holds at least one goal in
  // each; the extras are what push some people to four or five.
  const plan: GoalCategoryKey[] = ["PERSONAL", "PROFESSIONAL", "CONTRIBUTION"];
  const extras = int(rng, 0, 2);
  for (let i = 0; i < extras; i += 1) {
    plan.push(pick(rng, ["PERSONAL", "PROFESSIONAL", "CONTRIBUTION"] as const));
  }

  const completedTarget = int(rng, 0, 2);
  let completedSoFar = 0;
  const usedTitles = new Set<string>();

  plan.forEach((categoryKey, index) => {
    const pool = GOAL_TEMPLATES[categoryKey].filter(
      (t) => !usedTitles.has(t.title),
    );
    const template = pick(
      rng,
      pool.length ? pool : GOAL_TEMPLATES[categoryKey],
    );
    usedTitles.add(template.title);

    const roll = rng();
    let status: GoalStatus;
    if (completedSoFar < completedTarget && roll < 0.24) {
      status = "COMPLETED";
      completedSoFar += 1;
    } else if (roll < 0.34) {
      status = "AT_RISK";
    } else if (roll < 0.43) {
      status = "NOT_STARTED";
    } else if (roll < 0.47 && abandonedBudget > 0) {
      status = "ABANDONED";
      abandonedBudget -= 1;
    } else {
      status = "IN_PROGRESS";
    }

    const progress =
      status === "COMPLETED"
        ? 100
        : status === "NOT_STARTED"
          ? 0
          : status === "AT_RISK"
            ? int(rng, 10, 45)
            : status === "ABANDONED"
              ? int(rng, 15, 60)
              : int(rng, 25, 85);

    const startDate = dayKey(
      addDays(TODAY, -int(rng, 15, person.joinedDaysAgo)),
    );
    // A couple of goals are deliberately overdue, so the deadline badges have
    // something to render.
    const targetDate = chance(rng, 0.12)
      ? dayKey(addDays(TODAY, -int(rng, 1, 14)))
      : dayKey(addDays(TODAY, int(rng, 14, 180)));

    goals.push({
      id: `goal_${person.slug}_${index}`,
      categoryKey,
      title: template.title,
      description: template.description,
      status,
      progress,
      startDate,
      targetDate,
      completedAt:
        status === "COMPLETED"
          ? atHour(dayKey(addDays(TODAY, -int(rng, 3, 45))), 17)
          : null,
    });
  });

  // Nobody should end up with a board of nothing but stalled goals.
  if (!goals.some((g) => g.status === "IN_PROGRESS")) {
    const last = goals[goals.length - 1] as PlannedGoal;
    last.status = "IN_PROGRESS";
    last.progress = int(rng, 25, 85);
    last.completedAt = null;
  }

  return goals;
}

// ---------------------------------------------------------------------------
// Bulk insert — "only what is missing" is what keeps a re-run cheap and safe
// ---------------------------------------------------------------------------

async function insertMissing<T extends { id: string }>(
  rows: T[],
  existingIds: Set<string>,
  createMany: (data: T[]) => Promise<unknown>,
): Promise<number> {
  const fresh = rows.filter((r) => !existingIds.has(r.id));
  for (const batch of chunk(fresh, 250)) {
    await createMany(batch);
  }
  return fresh.length;
}

const idsOf = (rows: { id: string }[]): Set<string> =>
  new Set(rows.map((r) => r.id));

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log("Seeding Abundance Hub…\n");

  // --- Organization -------------------------------------------------------
  await db.organization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      name: "Abundance Hub",
      slug: "abundance-hub",
      description:
        "A coaching organization built on three categories of goals and four daily disciplines.",
    },
    update: { name: "Abundance Hub", slug: "abundance-hub" },
  });

  // --- Roles --------------------------------------------------------------
  const roleIds = new Map<RoleKey, string>();
  for (const role of ROLES) {
    const row = await db.role.upsert({
      where: { key: role.key },
      create: { id: `role_${role.key}`, ...role },
      update: { name: role.name, description: role.description },
    });
    roleIds.set(role.key, row.id);
  }

  // --- Goal categories ----------------------------------------------------
  const categoryIds = new Map<GoalCategoryKey, string>();
  for (const category of CATEGORIES) {
    const row = await db.goalCategory.upsert({
      where: { key: category.key },
      create: {
        id: `cat_${category.key}`,
        ...category,
        weight: 1,
        isRequired: true,
      },
      update: {
        name: category.name,
        description: category.description,
        accent: category.accent,
        weight: 1,
        isRequired: true,
        sortOrder: category.sortOrder,
      },
    });
    categoryIds.set(category.key, row.id);
  }

  // --- Core tasks ---------------------------------------------------------
  const coreTaskIds = new Map<string, string>();
  for (const task of CORE_TASKS) {
    const row = await db.coreTask.upsert({
      where: { organizationId_key: { organizationId: ORG_ID, key: task.key } },
      create: {
        id: `task_${task.key}`,
        organizationId: ORG_ID,
        points: 25,
        ...task,
      },
      update: {
        name: task.name,
        description: task.description,
        icon: task.icon,
        points: 25,
        sortOrder: task.sortOrder,
        isActive: true,
      },
    });
    coreTaskIds.set(task.key, row.id);
  }

  // --- Achievements -------------------------------------------------------
  const achievementIds = new Map<string, string>();
  for (const def of ACHIEVEMENT_DEFS) {
    const row = await db.achievement.upsert({
      where: { key: def.key },
      create: { id: `ach_${def.key}`, ...def },
      update: {
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        criteria: def.criteria,
      },
    });
    achievementIds.set(def.key, row.id);
  }

  // --- Users --------------------------------------------------------------
  // One hash for the shared demo password: bcrypt salts are random, so hashing
  // per user — or re-hashing on every run — would defeat the determinism this
  // script promises. passwordHash is therefore written on create only.
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_COST);

  for (const person of PEOPLE) {
    const joinedAt = atHour(dayKey(addDays(TODAY, -person.joinedDaysAgo)), 9);
    await db.user.upsert({
      where: { email: emailFor(person.slug) },
      create: {
        id: userIdFor(person.slug),
        organizationId: ORG_ID,
        email: emailFor(person.slug),
        passwordHash,
        firstName: person.firstName,
        lastName: person.lastName,
        headline: person.headline,
        timezone: "UTC",
        isActive: true,
        joinedAt,
        lastActiveAt: atHour(TODAY, 8),
        // Seeded members are established, not new signups — without this they
        // would all be force-redirected into the onboarding wizard on sign-in.
        onboardedAt: joinedAt,
      },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        headline: person.headline,
        joinedAt,
        lastActiveAt: atHour(TODAY, 8),
        isActive: true,
        onboardedAt: joinedAt,
      },
    });
  }

  // --- Roles per user -----------------------------------------------------
  // Maychell holds COACH *and* MENTEE on the same account — two rows here, one
  // user. This is the spec's headline requirement.
  const userRoleRows = PEOPLE.flatMap((person) =>
    person.roles.map((role) => ({
      id: `urole_${person.slug}_${role}`,
      userId: userIdFor(person.slug),
      roleId: must(roleIds.get(role), `missing role ${role}`),
    })),
  );
  await insertMissing(
    userRoleRows,
    idsOf(await db.userRole.findMany({ select: { id: true } })),
    (data) => db.userRole.createMany({ data }),
  );

  // --- Coach groups -------------------------------------------------------
  for (const coach of COACHES) {
    await db.coachGroup.upsert({
      where: { id: groupIdFor(coach.slug) },
      create: {
        id: groupIdFor(coach.slug),
        organizationId: ORG_ID,
        coachId: userIdFor(coach.slug),
        name: coach.group,
        description: coach.description,
        isActive: true,
      },
      update: {
        name: coach.group,
        description: coach.description,
        isActive: true,
      },
    });
  }

  // --- Memberships --------------------------------------------------------
  // INVARIANT: exactly one active membership per mentee. Maychell's membership
  // in Diana's group is what makes her both a coach and a mentee.
  const mentees = PEOPLE.filter((p) => p.coachSlug !== undefined);
  for (const mentee of mentees) {
    const coachSlug = must(mentee.coachSlug, "mentee without a coach");
    const groupId = groupIdFor(coachSlug);
    const joinedAt = atHour(dayKey(addDays(TODAY, -mentee.joinedDaysAgo)), 10);
    await db.groupMembership.upsert({
      where: {
        groupId_menteeId: { groupId, menteeId: userIdFor(mentee.slug) },
      },
      create: {
        id: `member_${mentee.slug}`,
        groupId,
        menteeId: userIdFor(mentee.slug),
        joinedAt,
        isActive: true,
      },
      update: { isActive: true, leftAt: null, joinedAt },
    });
  }

  // --- Delegation ---------------------------------------------------------
  // Diana explicitly authorises Maychell to edit one of her mentees — the only
  // path by which a coach may act on another coach's mentee.
  await db.coachDelegation.upsert({
    where: { id: "delg_diana_maychell_elena" },
    create: {
      id: "delg_diana_maychell_elena",
      grantorId: userIdFor("diana"),
      granteeId: userIdFor("maychell"),
      groupId: groupIdFor("diana"),
      menteeId: userIdFor("elena"),
      permission: "EDIT",
      expiresAt: null,
    },
    update: { permission: "EDIT", expiresAt: null },
  });

  // --- Goals, tasks, updates, comments -------------------------------
  const goalsByPerson = new Map<string, PlannedGoal[]>();

  for (const person of mentees) {
    const rng = streamFor(`goalrows:${person.slug}`);
    const coachSlug = must(person.coachSlug, "mentee without a coach");
    const planned = planGoals(person);
    goalsByPerson.set(person.slug, planned);

    for (const goal of planned) {
      await db.goal.upsert({
        where: { id: goal.id },
        create: {
          id: goal.id,
          userId: userIdFor(person.slug),
          categoryId: must(
            categoryIds.get(goal.categoryKey),
            "missing category",
          ),
          title: goal.title,
          description: goal.description,
          status: goal.status,
          progress: goal.progress,
          startDate: goal.startDate,
          targetDate: goal.targetDate,
          completedAt: goal.completedAt,
        },
        update: {
          status: goal.status,
          progress: goal.progress,
          targetDate: goal.targetDate,
          completedAt: goal.completedAt,
        },
      });

      // --- tasks ---
      // Every goal carries a to-do list. The goal's score is the weighted share
      // of these that are done, so a goal without tasks would have nothing to be
      // scored from.
      {
        const count = int(rng, 3, 5);
        const offset = int(rng, 0, GOAL_TASK_TITLES.length - 1);
        const spanDays = Math.max(
          7,
          Math.round(
            (goal.targetDate.getTime() - goal.startDate.getTime()) / 86_400_000,
          ),
        );

        for (let i = 0; i < count; i += 1) {
          // isComplete has to agree with the goal's progress bar, or the UI
          // would contradict itself.
          const isComplete = goal.progress >= ((i + 1) / count) * 100;
          const dueDate = dayKey(
            addDays(goal.startDate, Math.round(((i + 1) / count) * spanDays)),
          );
          const id = `gt_${goal.id}_${i}`;
          await db.goalTask.upsert({
            where: { id },
            create: {
              id,
              goalId: goal.id,
              title:
                GOAL_TASK_TITLES[(offset + i) % GOAL_TASK_TITLES.length] ?? "",
              isComplete,
              dueDate,
              completedAt: isComplete ? atHour(dueDate, 18) : null,
              sortOrder: i,
            },
            update: {
              isComplete,
              completedAt: isComplete ? atHour(dueDate, 18) : null,
            },
          });
        }

        // The goal's score is the share of its tasks that are done, and the
        // `progress` column is only a cached mirror of that. Writing back the
        // exact derived value keeps the progress bar and the score from telling
        // the user two different stories about the same goal.
        const done = await db.goalTask.count({
          where: { goalId: goal.id, isComplete: true },
        });
        const derived =
          goal.status === "COMPLETED"
            ? 100
            : Math.round((done / count) * 100);

        if (derived !== goal.progress) {
          await db.goal.update({
            where: { id: goal.id },
            data: { progress: derived },
          });
          goal.progress = derived;
        }
      }

      // --- progress ledger ---
      const updateCount = goal.status === "NOT_STARTED" ? 0 : int(rng, 1, 2);
      let from = 0;
      for (let i = 0; i < updateCount; i += 1) {
        const to =
          i === updateCount - 1
            ? goal.progress
            : clampInt(
                Math.round((goal.progress * (i + 1)) / (updateCount + 1)),
                0,
                100,
              );
        const id = `gu_${goal.id}_${i}`;
        await db.goalUpdate.upsert({
          where: { id },
          create: {
            id,
            goalId: goal.id,
            authorId: userIdFor(person.slug),
            progressFrom: from,
            progressTo: to,
            statusFrom: i === 0 ? "NOT_STARTED" : "IN_PROGRESS",
            statusTo: i === updateCount - 1 ? goal.status : "IN_PROGRESS",
            note: pick(rng, UPDATE_NOTES),
            createdAt: atHour(dayKey(addDays(TODAY, -int(rng, 2, 40))), 20),
          },
          update: { progressFrom: from, progressTo: to },
        });
        from = to;
      }

      // --- coach comments ---
      if (chance(rng, 0.45)) {
        const isPrivate = chance(rng, 0.4);
        await db.goalComment.upsert({
          where: { id: `gc_${goal.id}` },
          create: {
            id: `gc_${goal.id}`,
            goalId: goal.id,
            authorId: userIdFor(coachSlug),
            body: pick(rng, COMMENT_BODIES),
            isPrivate,
            createdAt: atHour(dayKey(addDays(TODAY, -int(rng, 1, 30))), 16),
          },
          update: { isPrivate },
        });
      }
    }
  }

  // --- Core task completions & check-ins ----------------------------------
  type CompletionRow = {
    id: string;
    userId: string;
    coreTaskId: string;
    date: Date;
    completed: boolean;
    completedAt: Date;
  };
  type CheckInRow = {
    id: string;
    userId: string;
    date: Date;
    wins: string;
    challenges: string;
    lessons: string;
    gratitude: string;
    tomorrowFocus: string;
    mood: number;
    createdAt: Date;
  };

  const historyByPerson = new Map<string, DayHistory[]>();
  const completionRows: CompletionRow[] = [];
  const checkInRows: CheckInRow[] = [];

  for (const person of PEOPLE) {
    const history = buildHistory(person);
    historyByPerson.set(person.slug, history);

    for (const day of history) {
      for (const taskKey of day.taskKeys) {
        const order = CORE_TASKS.findIndex((t) => t.key === taskKey);
        completionRows.push({
          id: `ctc_${person.slug}_${taskKey}_${isoDay(day.day)}`,
          userId: userIdFor(person.slug),
          coreTaskId: must(coreTaskIds.get(taskKey), `missing task ${taskKey}`),
          date: day.day,
          completed: true,
          completedAt: atHour(day.day, 7 + order * 3),
        });
      }

      if (day.checkIn) {
        checkInRows.push({
          id: `ci_${person.slug}_${isoDay(day.day)}`,
          userId: userIdFor(person.slug),
          date: day.day,
          ...day.checkIn,
          createdAt: atHour(day.day, 21),
        });
      }
    }
  }

  await insertMissing(
    completionRows,
    idsOf(await db.coreTaskCompletion.findMany({ select: { id: true } })),
    (data) => db.coreTaskCompletion.createMany({ data }),
  );

  await insertMissing(
    checkInRows,
    idsOf(await db.dailyCheckIn.findMany({ select: { id: true } })),
    (data) => db.dailyCheckIn.createMany({ data }),
  );

  // --- Check-in reviews ---------------------------------------------------
  type ReviewRow = {
    id: string;
    checkInId: string;
    coachId: string;
    comment: string;
    createdAt: Date;
  };
  const reviewRows = new Map<string, ReviewRow>();

  for (const person of mentees) {
    const rng = streamFor(`reviews:${person.slug}`);
    const coachSlug = must(person.coachSlug, "mentee without a coach");
    const recent = (historyByPerson.get(person.slug) ?? [])
      .filter((d) => d.checkIn !== null)
      .slice(-12);
    if (recent.length === 0) continue;

    const count = Math.min(recent.length, int(rng, 1, 2));
    for (let i = 0; i < count; i += 1) {
      const day = recent[recent.length - 1 - i * 3] ?? recent[recent.length - 1];
      if (!day) continue;
      const id = `cir_${person.slug}_${isoDay(day.day)}`;
      reviewRows.set(id, {
        id,
        checkInId: `ci_${person.slug}_${isoDay(day.day)}`,
        coachId: userIdFor(coachSlug),
        comment: pick(rng, REVIEW_COMMENTS),
        createdAt: atHour(day.day, 22),
      });
    }
  }

  await insertMissing(
    [...reviewRows.values()],
    idsOf(await db.checkInReview.findMany({ select: { id: true } })),
    (data) => db.checkInReview.createMany({ data }),
  );

  // --- Coaching notes & action items --------------------------------------
  for (const person of mentees) {
    const rng = streamFor(`notes:${person.slug}`);
    const coachSlug = must(person.coachSlug, "mentee without a coach");
    const noteCount = int(rng, 2, 4);

    for (let i = 0; i < noteCount; i += 1) {
      const noteId = `note_${person.slug}_${i}`;
      const seedIndex = hashString(person.slug) + i;
      const visibility = chance(rng, 0.5) ? "SHARED" : "PRIVATE";
      const followUpDate = chance(rng, 0.5)
        ? dayKey(addDays(TODAY, int(rng, 2, 14)))
        : null;

      await db.coachingNote.upsert({
        where: { id: noteId },
        create: {
          id: noteId,
          coachId: userIdFor(coachSlug),
          menteeId: userIdFor(person.slug),
          title: NOTE_TITLES[seedIndex % NOTE_TITLES.length] ?? "Session note",
          body: NOTE_BODIES[seedIndex % NOTE_BODIES.length] ?? "<p>Session note.</p>",
          visibility,
          followUpDate,
          createdAt: atHour(dayKey(addDays(TODAY, -int(rng, 1, 50))), 15),
        },
        update: { visibility, followUpDate },
      });

      const itemCount = int(rng, 1, 3);
      for (let j = 0; j < itemCount; j += 1) {
        const id = `nai_${person.slug}_${i}_${j}`;
        const isDone = chance(rng, 0.45);
        const dueDate = dayKey(addDays(TODAY, int(rng, -5, 14)));
        await db.noteActionItem.upsert({
          where: { id },
          create: {
            id,
            noteId,
            assigneeId: chance(rng, 0.7) ? userIdFor(person.slug) : null,
            title:
              ACTION_ITEMS[
                hashString(`${person.slug}:${i}:${j}`) % ACTION_ITEMS.length
              ] ?? "Follow up",
            isDone,
            dueDate,
            completedAt: isDone ? atHour(dueDate, 12) : null,
            sortOrder: j,
          },
          update: { isDone, completedAt: isDone ? atHour(dueDate, 12) : null },
        });
      }
    }
  }

  // --- Notifications & preferences ----------------------------------------
  type NotificationRow = {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    link: string;
    priority: string;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  };
  const notificationRows: NotificationRow[] = [];

  for (const person of PEOPLE) {
    const rng = streamFor(`notifs:${person.slug}`);
    const coach = person.coachSlug
      ? PEOPLE.find((p) => p.slug === person.coachSlug)
      : undefined;
    const firstGoal = goalsByPerson.get(person.slug)?.[0];

    const templates = [
      {
        type: "COACH_FEEDBACK",
        title: "New note from your coach",
        body: coach
          ? `${coach.firstName} left feedback on your latest check-in.`
          : "You left feedback on a mentee's check-in.",
        link: "/notes",
        priority: "NORMAL",
      },
      {
        type: "GOAL_DEADLINE",
        title: "A goal is due soon",
        body: firstGoal
          ? `"${firstGoal.title}" is due in ${int(rng, 2, 10)} days.`
          : `A goal in your group is due in ${int(rng, 2, 10)} days.`,
        link: "/goals",
        priority: "HIGH",
      },
      {
        type: "ACHIEVEMENT_UNLOCKED",
        title: "Achievement unlocked",
        body: `You earned "${pick(rng, ACHIEVEMENT_DEFS).name}".`,
        link: "/achievements",
        priority: "LOW",
      },
      {
        type: "LEADERBOARD_CHANGE",
        title: "You moved on the leaderboard",
        body: `You climbed ${int(rng, 1, 4)} places on the organization board.`,
        link: "/leaderboard",
        priority: "LOW",
      },
      {
        type: "MISSED_TASK",
        title: "A core task went unlogged",
        body: `No ${pick(rng, CORE_TASKS).name} logged yesterday. Streaks are built on the ordinary days.`,
        link: "/tasks",
        priority: "NORMAL",
      },
    ];

    templates.forEach((template, i) => {
      const isRead = chance(rng, 0.45);
      const createdAt = atHour(
        dayKey(addDays(TODAY, -int(rng, 0, 20))),
        9 + i,
      );
      notificationRows.push({
        id: `notif_${person.slug}_${i}`,
        userId: userIdFor(person.slug),
        ...template,
        isRead,
        readAt: isRead ? atHour(createdAt, 2) : null,
        createdAt,
      });
    });
  }

  await insertMissing(
    notificationRows,
    idsOf(await db.notification.findMany({ select: { id: true } })),
    (data) => db.notification.createMany({ data }),
  );

  const prefRows = PEOPLE.flatMap((person) =>
    NOTIFICATION_TYPES.map((type) => ({
      id: `pref_${person.slug}_${type}`,
      userId: userIdFor(person.slug),
      type,
      inApp: true,
      email: false,
    })),
  );
  await insertMissing(
    prefRows,
    idsOf(await db.notificationPreference.findMany({ select: { id: true } })),
    (data) => db.notificationPreference.createMany({ data }),
  );

  // --- Activity logs ------------------------------------------------------
  // Assembled from what actually happened to each user — their real goals,
  // completions, check-ins and notes — rather than invented after the fact.
  type ActivityRow = {
    id: string;
    userId: string;
    actorId: string;
    type: string;
    entityType: string | null;
    entityId: string | null;
    summary: string;
    createdAt: Date;
  };
  const activityRows: ActivityRow[] = [];

  for (const person of PEOPLE) {
    const rng = streamFor(`activity:${person.slug}`);
    const userId = userIdFor(person.slug);
    const history = historyByPerson.get(person.slug) ?? [];
    const goals = goalsByPerson.get(person.slug) ?? [];
    const events: Omit<ActivityRow, "id">[] = [];

    for (const goal of goals) {
      events.push({
        userId,
        actorId: userId,
        type: "GOAL_CREATED",
        entityType: "Goal",
        entityId: goal.id,
        summary: `Set a new ${goal.categoryKey.toLowerCase()} goal: "${goal.title}"`,
        createdAt: atHour(goal.startDate, 11),
      });
      if (goal.completedAt) {
        events.push({
          userId,
          actorId: userId,
          type: "GOAL_COMPLETED",
          entityType: "Goal",
          entityId: goal.id,
          summary: `Completed "${goal.title}"`,
          createdAt: goal.completedAt,
        });
      }
    }

    if (person.coachSlug) {
      events.push({
        userId,
        actorId: userIdFor(person.coachSlug),
        type: "NOTE_ADDED",
        entityType: "CoachingNote",
        entityId: `note_${person.slug}_0`,
        summary: "Your coach added a session note",
        createdAt: atHour(dayKey(addDays(TODAY, -int(rng, 2, 30))), 15),
      });
    }

    // Sampled evenly across the window, so the feed spans all 60 days rather
    // than bunching up in the last week.
    for (const day of takeEvenly(
      history.filter((d) => d.taskKeys.length > 0),
      7,
    )) {
      events.push({
        userId,
        actorId: userId,
        type: "TASK_COMPLETED",
        entityType: "CoreTaskCompletion",
        entityId: null,
        summary: `Completed ${day.taskKeys.length} of ${CORE_TASKS.length} core tasks`,
        createdAt: atHour(day.day, 19),
      });
    }

    for (const day of takeEvenly(
      history.filter((d) => d.checkIn !== null),
      5,
    )) {
      events.push({
        userId,
        actorId: userId,
        type: "CHECK_IN_SUBMITTED",
        entityType: "DailyCheckIn",
        entityId: `ci_${person.slug}_${isoDay(day.day)}`,
        summary: "Filed the daily check-in",
        createdAt: atHour(day.day, 21),
      });
    }

    events
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 15)
      .forEach((event, i) => {
        activityRows.push({ id: `act_${person.slug}_${i}`, ...event });
      });
  }

  await insertMissing(
    activityRows,
    idsOf(await db.activityLog.findMany({ select: { id: true } })),
    (data) => db.activityLog.createMany({ data }),
  );

  // --- Achievements earned, and streaks -----------------------------------
  // Evaluated against each user's real computed score — nobody is handed a badge.
  const allUserIds = PEOPLE.map((p) => userIdFor(p.slug));
  const scores = await computeScoresForUsers(allUserIds, TODAY);

  type Criteria = {
    metric:
      | "streak"
      | "goalsCompleted"
      | "overallScore"
      | "taskCompletionRate"
      | "checkInRate";
    gte: number;
  };

  const metricValue = (score: UserScore, metric: Criteria["metric"]): number => {
    switch (metric) {
      case "streak":
        return score.currentStreak;
      case "goalsCompleted":
        return score.goalsCompleted;
      case "overallScore":
        return score.overallScore;
      case "taskCompletionRate":
        return score.taskCompletionRate;
      case "checkInRate":
        return score.checkInRate;
    }
  };

  const userAchievementRows: {
    id: string;
    userId: string;
    achievementId: string;
    unlockedAt: Date;
  }[] = [];

  for (const person of PEOPLE) {
    const score = scores.get(userIdFor(person.slug));
    if (!score) continue;
    const rng = streamFor(`unlocks:${person.slug}`);

    for (const def of ACHIEVEMENT_DEFS) {
      const criteria = JSON.parse(def.criteria) as Criteria;
      if (metricValue(score, criteria.metric) < criteria.gte) continue;
      userAchievementRows.push({
        id: `uach_${person.slug}_${def.key}`,
        userId: userIdFor(person.slug),
        achievementId: must(
          achievementIds.get(def.key),
          `missing achievement ${def.key}`,
        ),
        unlockedAt: atHour(dayKey(addDays(TODAY, -int(rng, 1, 30))), 20),
      });
    }

    await db.userStreak.upsert({
      where: { userId: userIdFor(person.slug) },
      create: {
        id: `streak_${person.slug}`,
        userId: userIdFor(person.slug),
        currentStreak: score.currentStreak,
        longestStreak: score.longestStreak,
        lastActiveDay: TODAY,
      },
      update: {
        currentStreak: score.currentStreak,
        longestStreak: score.longestStreak,
        lastActiveDay: TODAY,
      },
    });
  }

  await insertMissing(
    userAchievementRows,
    idsOf(await db.userAchievement.findMany({ select: { id: true } })),
    (data) => db.userAchievement.createMany({ data }),
  );

  // --- Snapshots ----------------------------------------------------------
  // Must run last: persistSnapshots derives every number from the source rows
  // above. O(60 × users) upserts — slow by design, and what gives the trend
  // charts 60 real days to plot.
  console.log(`Building ${SNAPSHOT_DAYS} days of score snapshots…`);
  for (let n = SNAPSHOT_DAYS - 1; n >= 0; n -= 1) {
    await persistSnapshots(ORG_ID, addDays(TODAY, -n));
    if (n % 20 === 0) {
      console.log(`  … ${SNAPSHOT_DAYS - n}/${SNAPSHOT_DAYS} days`);
    }
  }

  // --- Leaderboards -------------------------------------------------------
  // Today and yesterday, so a rank delta ("moved up 3 places") can be computed.
  type LeaderboardRow = {
    id: string;
    board: LeaderboardBoard;
    scopeId: string;
    userId: string;
    rank: number;
    score: number;
    capturedAt: Date;
  };
  const leaderboardRows: LeaderboardRow[] = [];

  const rankInto = (
    board: LeaderboardBoard,
    scopeId: string,
    entries: { userId: string; score: number }[],
    capturedAt: Date,
  ): void => {
    [...entries]
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
      .forEach((entry, i) => {
        leaderboardRows.push({
          id: `lb_${board}_${scopeId}_${entry.userId}_${isoDay(capturedAt)}`,
          board,
          scopeId,
          userId: entry.userId,
          rank: i + 1,
          score: Math.round(entry.score * 10) / 10,
          capturedAt,
        });
      });
  };

  for (const n of [1, 0]) {
    const capturedAt = dayKey(addDays(TODAY, -n));
    const dayScores = await computeScoresForUsers(allUserIds, capturedAt);
    const dayCoachScores = await computeCoachScores(
      COACHES.map((c) => userIdFor(c.slug)),
      capturedAt,
    );
    const everyone = [...dayScores.values()];

    for (const coach of COACHES) {
      rankInto(
        "GROUP",
        groupIdFor(coach.slug),
        PEOPLE.filter((p) => p.coachSlug === coach.slug)
          .map((p) => dayScores.get(userIdFor(p.slug)))
          .filter((s): s is UserScore => Boolean(s))
          .map((s) => ({ userId: s.userId, score: s.overallScore })),
        capturedAt,
      );
    }

    rankInto(
      "COACH",
      ORG_ID,
      [...dayCoachScores.values()].map((c) => ({
        userId: c.coachId,
        score: c.averageScore,
      })),
      capturedAt,
    );
    rankInto(
      "ORGANIZATION",
      ORG_ID,
      everyone.map((s) => ({ userId: s.userId, score: s.overallScore })),
      capturedAt,
    );
    rankInto(
      "CORE_TASK",
      ORG_ID,
      everyone.map((s) => ({ userId: s.userId, score: s.taskCompletionRate })),
      capturedAt,
    );
    rankInto(
      "GOAL_COMPLETION",
      ORG_ID,
      everyone.map((s) => ({ userId: s.userId, score: s.goalsCompleted })),
      capturedAt,
    );
    rankInto(
      "CONSISTENCY",
      ORG_ID,
      everyone.map((s) => ({ userId: s.userId, score: s.currentStreak })),
      capturedAt,
    );
  }

  await insertMissing(
    leaderboardRows,
    idsOf(await db.leaderboardEntry.findMany({ select: { id: true } })),
    (data) => db.leaderboardEntry.createMany({ data }),
  );

  // --- Summary ------------------------------------------------------------
  const [
    organizations,
    roles,
    users,
    userRoles,
    coachGroups,
    memberships,
    delegations,
    goalCategories,
    goals,
    tasks,
    goalUpdates,
    goalComments,
    coreTasks,
    completions,
    checkIns,
    checkInReviews,
    coachingNotes,
    actionItems,
    achievements,
    userAchievements,
    notifications,
    preferences,
    activityLogs,
    userStreaks,
    scoreSnapshots,
    coachSnapshots,
    groupSnapshots,
    orgSnapshots,
    leaderboardEntries,
  ] = await Promise.all([
    db.organization.count(),
    db.role.count(),
    db.user.count(),
    db.userRole.count(),
    db.coachGroup.count(),
    db.groupMembership.count(),
    db.coachDelegation.count(),
    db.goalCategory.count(),
    db.goal.count(),
    db.goalTask.count(),
    db.goalUpdate.count(),
    db.goalComment.count(),
    db.coreTask.count(),
    db.coreTaskCompletion.count(),
    db.dailyCheckIn.count(),
    db.checkInReview.count(),
    db.coachingNote.count(),
    db.noteActionItem.count(),
    db.achievement.count(),
    db.userAchievement.count(),
    db.notification.count(),
    db.notificationPreference.count(),
    db.activityLog.count(),
    db.userStreak.count(),
    db.scoreSnapshot.count(),
    db.coachScoreSnapshot.count(),
    db.groupScoreSnapshot.count(),
    db.orgScoreSnapshot.count(),
    db.leaderboardEntry.count(),
  ]);

  const counts: [string, number][] = [
    ["organizations", organizations],
    ["roles", roles],
    ["users", users],
    ["user_roles", userRoles],
    ["coach_groups", coachGroups],
    ["group_memberships", memberships],
    ["coach_delegations", delegations],
    ["goal_categories", goalCategories],
    ["goals", goals],
    ["goal_tasks", tasks],
    ["goal_updates", goalUpdates],
    ["goal_comments", goalComments],
    ["core_tasks", coreTasks],
    ["core_task_completions", completions],
    ["daily_check_ins", checkIns],
    ["check_in_reviews", checkInReviews],
    ["coaching_notes", coachingNotes],
    ["note_action_items", actionItems],
    ["achievements", achievements],
    ["user_achievements", userAchievements],
    ["notifications", notifications],
    ["notification_preferences", preferences],
    ["activity_logs", activityLogs],
    ["user_streaks", userStreaks],
    ["score_snapshots", scoreSnapshots],
    ["coach_score_snapshots", coachSnapshots],
    ["group_score_snapshots", groupSnapshots],
    ["org_score_snapshots", orgSnapshots],
    ["leaderboard_entries", leaderboardEntries],
  ];

  console.log("\n──────────────────────────────────────────────────────");
  console.log("  Abundance Hub — seed complete");
  console.log("──────────────────────────────────────────────────────");
  for (const [table, count] of counts) {
    console.log(`  ${table.padEnd(26)}${String(count).padStart(7)}`);
  }

  console.log("\n──────────────────────────────────────────────────────");
  console.log(`  Login — every account shares the password: ${PASSWORD}`);
  console.log("──────────────────────────────────────────────────────");
  for (const person of PEOPLE) {
    const coaches = COACHES.find((c) => c.slug === person.slug);
    const mentoredBy = person.coachSlug
      ? COACHES.find((c) => c.slug === person.coachSlug)?.group
      : undefined;
    const where = [
      coaches ? `coaches ${coaches.group}` : null,
      mentoredBy ? `mentee in ${mentoredBy}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `  ${emailFor(person.slug).padEnd(30)}${person.roles.join("+").padEnd(15)}${where || "—"}`,
    );
  }

  console.log(
    "\n  Dual role: maychell@abundancehub.io coaches Maychell's Circle AND is a\n" +
      "  mentee inside Diana's Circle — one account, two roles, no duplicate.",
  );
  console.log(`\nDone in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
