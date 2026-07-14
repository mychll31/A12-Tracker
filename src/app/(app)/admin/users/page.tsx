import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/dates";
import { ROLE_KEYS, type RoleKey } from "@/lib/domain";
import { listUsers } from "@/server/admin";
import { listGroups } from "@/server/mentees";

import { UsersClient, type AdminUserView } from "./users-client";

export const metadata: Metadata = { title: "Users" };

function asRoleFilter(value: string | undefined): RoleKey | undefined {
  return (ROLE_KEYS as readonly string[]).includes(value ?? "")
    ? (value as RoleKey)
    : undefined;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;

  const search = params.search?.trim() ?? "";
  const role = asRoleFilter(params.role);

  const [rows, groups] = await Promise.all([
    listUsers(user, { search: search || undefined, role }),
    listGroups(user),
  ]);

  // Formatted here, not in the client island: `formatRelative` reads the clock,
  // and a client re-render would disagree with the server HTML.
  const users: AdminUserView[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    roles: row.roles,
    groupName: row.groupName,
    joinedLabel: formatDate(row.joinedAt),
    lastActiveLabel: row.lastActiveAt
      ? formatRelative(row.lastActiveAt)
      : "Never",
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-2 text-sm text-muted">
          Every member of the organization. A person can hold more than one role
          — a coach who is also a mentee keeps both.
        </p>
      </header>

      <UsersClient
        users={users}
        groupOptions={groups.map((group) => ({
          value: group.id,
          label: group.name,
        }))}
        search={search}
        role={role ?? ""}
      />
    </div>
  );
}
