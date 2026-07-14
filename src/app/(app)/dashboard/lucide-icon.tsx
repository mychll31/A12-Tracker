import {
  Award,
  BookOpen,
  Brain,
  Circle,
  CircleCheckBig,
  Crown,
  Dumbbell,
  Flame,
  Heart,
  type LucideIcon,
  Medal,
  Phone,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

/**
 * `core_tasks.icon` and `achievements.icon` hold kebab-case names chosen by an
 * admin, so the icon is only known at runtime.
 *
 * Resolving that against `import * as icons from "lucide-react"` would work, but
 * it defeats tree-shaking — the bundler cannot prove which icons are reachable
 * and ships the entire set. An explicit map keeps the bundle to the icons the
 * product actually uses; an unknown name falls back rather than crashing.
 */
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "book-open": BookOpen,
  brain: Brain,
  "circle-check-big": CircleCheckBig,
  crown: Crown,
  dumbbell: Dumbbell,
  flame: Flame,
  heart: Heart,
  medal: Medal,
  phone: Phone,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  trophy: Trophy,
  zap: Zap,
};

export function TaskIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} aria-hidden="true" />;
}
