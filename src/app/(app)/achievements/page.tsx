import type { Metadata } from "next";
import type { ComponentType } from "react";
import {
  Award,
  CheckCheck,
  Compass,
  Crown,
  Flame,
  HeartHandshake,
  Lock,
  Medal,
  Sparkles,
  Sunrise,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

import { Card, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { ACHIEVEMENT_TIERS, type AchievementTier } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { ACHIEVEMENT_DEFS, listAchievements } from "@/server/achievements";

import { AccessNotice, guard } from "../_components/guard";

export const metadata: Metadata = { title: "Achievements" };

/**
 * The catalogue names its icons as lucide keys (`"check-check"`). Resolving them
 * through an explicit map rather than a dynamic lookup keeps the icon set
 * tree-shaken and keeps an unknown name a visible fallback, not a crash.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  flame: Flame,
  zap: Zap,
  crown: Crown,
  target: Target,
  award: Award,
  trophy: Trophy,
  compass: Compass,
  sparkles: Sparkles,
  medal: Medal,
  "check-check": CheckCheck,
  sunrise: Sunrise,
  "heart-handshake": HeartHandshake,
};

const TIER_RING: Record<AchievementTier, string> = {
  BRONZE:
    "ring-amber-700/60 bg-amber-700/10 text-amber-700 dark:text-amber-600",
  SILVER:
    "ring-slate-400/60 bg-slate-400/10 text-slate-500 dark:text-slate-300",
  GOLD: "ring-amber-400/70 bg-amber-400/10 text-amber-500 dark:text-amber-300",
  PLATINUM:
    "ring-violet-400/60 bg-violet-400/10 text-violet-500 dark:text-violet-300",
};

const TIER_LABEL: Record<AchievementTier, string> = {
  BRONZE: "text-amber-700 dark:text-amber-600",
  SILVER: "text-slate-500 dark:text-slate-300",
  GOLD: "text-amber-500 dark:text-amber-300",
  PLATINUM: "text-violet-500 dark:text-violet-300",
};

/** `AchievementStatus.tier` arrives as a TEXT column, so it is narrowed here. */
const asTier = (value: string): AchievementTier =>
  (ACHIEVEMENT_TIERS as readonly string[]).includes(value)
    ? (value as AchievementTier)
    : "BRONZE";

const CRITERIA_BY_KEY = new Map(
  ACHIEVEMENT_DEFS.map((def) => [def.key, def.criteria]),
);

/**
 * Turns the stored rule — `{"metric":"streak","gte":30}` — into the sentence a
 * locked badge shows as its hint. `listAchievements` does not return `criteria`,
 * so it is joined back on from the catalogue. An unreadable rule falls back to
 * the badge's own description rather than inventing a target nobody can hit.
 */
function hintFor(key: string, fallback: string): string {
  const raw = CRITERIA_BY_KEY.get(key);
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  if (typeof parsed !== "object" || parsed === null) return fallback;
  const { metric, gte } = parsed as { metric?: unknown; gte?: unknown };
  if (typeof metric !== "string" || typeof gte !== "number") return fallback;

  switch (metric) {
    case "streak":
      return `Keep a ${gte}-day streak`;
    case "goalsCompleted":
      return `Complete ${gte} ${gte === 1 ? "goal" : "goals"}`;
    case "overallScore":
      return `Reach an overall score of ${gte}`;
    case "taskCompletionRate":
      return `Complete ${gte}% of your core tasks`;
    case "checkInRate":
      return `File a check-in on ${gte}% of days`;
    default:
      return fallback;
  }
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
      <p className="mt-1 text-sm text-muted">
        Proof of the days you showed up. Every badge is earned, never given.
      </p>
    </div>
  );
}

export default async function AchievementsPage() {
  const user = await requireUser();

  const loaded = await guard(() => listAchievements(user, user.id));

  if (!loaded.ok) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <AccessNotice message={loaded.message} />
        </div>
      </div>
    );
  }

  const achievements = loaded.data;
  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;
  const total = achievements.length;
  const percent = total ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div className="animate-slide-up">
      <Header />

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            {unlocked} of {total} unlocked
          </p>
          <p className="text-xs text-muted">{total - unlocked} still to earn</p>
        </div>
        <ProgressBar value={percent} className="mt-3" />
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((achievement) => {
          const tier = asTier(achievement.tier);
          const Icon = ICONS[achievement.icon] ?? Award;
          const isUnlocked = achievement.unlockedAt !== null;

          return (
            <Card
              key={achievement.key}
              // The achievement notification deep-links to /achievements#KEY.
              id={achievement.key}
              className={cn(
                "flex scroll-mt-24 gap-4 p-5",
                !isUnlocked && "opacity-60 grayscale",
              )}
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full ring-2",
                  isUnlocked
                    ? TIER_RING[tier]
                    : "bg-surface-sunken text-muted ring-border",
                )}
                aria-hidden="true"
              >
                {isUnlocked ? (
                  <Icon className="size-5" />
                ) : (
                  <Lock className="size-4" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold">
                    {achievement.name}
                  </h2>
                  <span
                    className={cn(
                      "shrink-0 text-[0.625rem] font-semibold uppercase tracking-wide",
                      isUnlocked ? TIER_LABEL[tier] : "text-muted",
                    )}
                  >
                    {tier}
                  </span>
                </div>

                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {achievement.description}
                </p>

                {isUnlocked && achievement.unlockedAt ? (
                  <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Unlocked {formatDate(achievement.unlockedAt)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-muted-strong">
                    {hintFor(achievement.key, achievement.description)}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
