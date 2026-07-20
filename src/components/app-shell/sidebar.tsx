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
  Goal,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MessageSquareQuote,
  Network,
  NotebookPen,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

import { Wordmark } from "./wordmark";

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
  goal: Goal,
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
              const hasChildren = Boolean(item.children?.length);
              const current = pathname === item.href || (!hasChildren && active);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
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
                  {item.children?.length ? (
                    <ul className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                      {item.children.map((child) => {
                        const childActive = isActive(pathname, child.href);

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "block truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                childActive
                                  ? "bg-primary-soft text-primary"
                                  : "text-muted hover:bg-surface-sunken hover:text-foreground",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
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
      <Wordmark className="px-6 py-5" />

      <div className="flex-1 overflow-y-auto pb-6 scroll-thin">
        <NavLinks sections={sections} />
      </div>
    </aside>
  );
}
