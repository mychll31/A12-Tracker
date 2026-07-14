"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Building2,
  Circle,
  CircleCheckBig,
  Compass,
  FileText,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MessageSquareQuote,
  Network,
  NotebookPen,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isActive, type NavSection } from "./nav-config";

/**
 * Named explicitly rather than resolved out of `import * as icons` — a namespace
 * import defeats tree-shaking and would ship every lucide icon to the browser.
 */
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "building-2": Building2,
  "circle-check-big": CircleCheckBig,
  compass: Compass,
  "file-text": FileText,
  "layout-dashboard": LayoutDashboard,
  "list-checks": ListChecks,
  "message-square-quote": MessageSquareQuote,
  network: Network,
  "notebook-pen": NotebookPen,
  shield: Shield,
  target: Target,
  "trending-up": TrendingUp,
  trophy: Trophy,
  "user-cog": UserCog,
  users: Users,
  "users-round": UsersRound,
};

const iconFor = (name: string): LucideIcon => ICONS[name] ?? Circle;

export function NavLinks({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3">
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title ? (
            <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </p>
          ) : null}

          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = iconFor(item.icon);
              const active = isActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted hover:bg-surface-sunken hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted group-hover:text-foreground",
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface-raised lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-6 py-5 text-base font-semibold tracking-tight"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        Abundance Hub
      </Link>

      <div className="flex-1 overflow-y-auto pb-6 scroll-thin">
        <NavLinks sections={sections} />
      </div>
    </aside>
  );
}
