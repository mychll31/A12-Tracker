"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";

import { NavLinks } from "./sidebar";
import { UserMenu, type UserMenuProps } from "./user-menu";
import { Wordmark } from "./wordmark";
import type { NavSection } from "./nav-config";

export function Topbar({
  sections,
  unreadCount,
  user,
}: {
  sections: NavSection[];
  unreadCount: number;
  user: UserMenuProps;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Leaving the drawer open across a navigation would cover the page the user
  // just asked for. Adjusting state during render — rather than in an effect —
  // closes it in the same pass that renders the new route, so the drawer is
  // never briefly painted over the destination. Browser back/forward changes the
  // pathname without going through the link handler, so this is what catches it.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface-raised/80 px-4 backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-sunken hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <Wordmark size="sm" className="lg:hidden" />

        <div className="flex-1" />

        <Link
          href="/notifications"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.625rem] font-semibold leading-4 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <UserMenu {...user} />
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 animate-fade-in bg-black/50"
          />

          <div className="absolute inset-y-0 left-0 flex w-72 animate-slide-up flex-col border-r border-border bg-surface-raised">
            <div className="flex items-center justify-between px-5 py-5">
              <Wordmark size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-sunken hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-6 scroll-thin">
              <NavLinks
                sections={sections}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
