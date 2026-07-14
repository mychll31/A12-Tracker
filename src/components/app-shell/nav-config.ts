import type { SessionUser } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  /** lucide-react icon name, resolved in the client components. */
  icon: string;
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
};

/**
 * The one place navigation is decided, so the desktop rail and the mobile
 * drawer can never drift apart.
 *
 * Sections are built from the actor's roles. A user who is both a coach and a
 * mentee — which the spec requires to work on a single account — simply gets
 * both blocks, instead of being forced to pick an identity.
 */
export function navFor(user: SessionUser): NavSection[] {
  const sections: NavSection[] = [];

  if (user.isMentee) {
    sections.push({
      title: null,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
        { href: "/goals", label: "My Goals", icon: "target" },
        { href: "/core-tasks", label: "Core Tasks", icon: "circle-check-big" },
        { href: "/check-in", label: "Daily Check-In", icon: "notebook-pen" },
        { href: "/analytics", label: "My Analytics", icon: "trending-up" },
      ],
    });
  }

  if (user.isCoach) {
    sections.push({
      title: "Coaching",
      items: [
        { href: "/coach", label: "Coach Dashboard", icon: "compass" },
        { href: "/coach/mentees", label: "Mentees", icon: "users" },
        { href: "/coach/groups", label: "Groups", icon: "users-round" },
        { href: "/coach/notes", label: "Coaching Notes", icon: "file-text" },
        { href: "/organization", label: "Organization", icon: "building-2" },
      ],
    });
  }

  sections.push({
    title: user.isCoach || user.isMentee ? "Community" : null,
    items: [
      { href: "/leaderboards", label: "Leaderboards", icon: "trophy" },
      { href: "/notes", label: "My Notes", icon: "message-square-quote" },
      { href: "/achievements", label: "Achievements", icon: "award" },
    ],
  });

  if (user.isAdmin) {
    sections.push({
      title: "Administration",
      items: [
        { href: "/admin", label: "Overview", icon: "shield" },
        { href: "/admin/users", label: "Users", icon: "user-cog" },
        { href: "/admin/groups", label: "Coach Groups", icon: "network" },
        { href: "/admin/core-tasks", label: "Core Tasks", icon: "list-checks" },
      ],
    });
  }

  return sections;
}

/**
 * `/coach` must not stay lit while you are on `/coach/mentees`, but `/goals`
 * must stay lit on `/goals/abc123`. Exact match for section roots, prefix match
 * for the rest.
 */
export function isActive(pathname: string, href: string): boolean {
  const sectionRoots = ["/coach", "/admin", "/dashboard"];
  if (sectionRoots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
