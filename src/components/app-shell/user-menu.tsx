"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/domain";

export type UserMenuProps = {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  roles: RoleKey[];
};

export function UserMenu({
  firstName,
  lastName,
  email,
  avatarUrl,
  roles,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-surface-sunken"
      >
        <Avatar
          src={avatarUrl}
          firstName={firstName}
          lastName={lastName}
          size="sm"
        />
        <ChevronDown
          className={cn(
            "size-4 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right animate-slide-up overflow-hidden rounded-card border border-border bg-surface-raised card-shadow"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium">
              {firstName} {lastName}
            </p>
            <p className="truncate text-xs text-muted">{email}</p>

            {/* Both badges show for someone who coaches and is coached — the
                spec's dual-role case, made visible rather than hidden. */}
            <div className="mt-2 flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role} size="sm" variant="neutral">
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
            >
              <User className="size-4" />
              Profile &amp; settings
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
