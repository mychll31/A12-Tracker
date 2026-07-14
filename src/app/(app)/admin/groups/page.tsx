import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { listDelegations, listUsers } from "@/server/admin";
import { listGroups, listMentees } from "@/server/mentees";
import type { SelectOption } from "@/components/ui";

import {
  GroupsClient,
  type DelegationView,
  type GroupMemberView,
  type GroupView,
} from "./groups-client";

export const metadata: Metadata = { title: "Coach groups" };

export default async function AdminGroupsPage() {
  const user = await requireAdmin();

  const [groups, allUsers, mentees] = await Promise.all([
    listGroups(user),
    listUsers(user),
    listMentees(user),
  ]);

  const coaches = allUsers.filter((u) => u.roles.includes("COACH"));

  // `listDelegations` is scoped to a single grantor, so the org-wide view is the
  // union across everyone who can grant one — coaches, and admins acting for them.
  const grantors = allUsers.filter(
    (u) => u.roles.includes("COACH") || u.roles.includes("ADMIN"),
  );

  const granted = await Promise.all(
    grantors.map(async (grantor) => {
      const rows = await listDelegations(user, grantor.id);
      return rows.map((row) => ({ row, grantor }));
    }),
  );

  const delegations: DelegationView[] = granted.flat().map(({ row, grantor }) => ({
    id: row.id,
    grantorName: `${grantor.firstName} ${grantor.lastName}`,
    granteeName: `${row.grantee.firstName} ${row.grantee.lastName}`,
    scopeLabel: row.mentee
      ? `Mentee · ${row.mentee.firstName} ${row.mentee.lastName}`
      : row.group
        ? `Group · ${row.group.name}`
        : "—",
    permission: row.permission,
    expiresLabel: row.expiresAt ? formatDate(row.expiresAt) : "Never",
    isExpired: row.isExpired,
  }));

  // The one-group invariant means each mentee lands in at most one bucket.
  const membersByGroup = new Map<string, GroupMemberView[]>();
  for (const mentee of mentees) {
    if (!mentee.groupId) continue;
    const list = membersByGroup.get(mentee.groupId) ?? [];
    list.push({
      id: mentee.id,
      name: `${mentee.firstName} ${mentee.lastName}`,
    });
    membersByGroup.set(mentee.groupId, list);
  }

  const groupViews: GroupView[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.isActive,
    coachName: `${group.coach.firstName} ${group.coach.lastName}`,
    memberCount: group.memberCount,
    averageScore: group.averageScore,
    members: membersByGroup.get(group.id) ?? [],
  }));

  const coachOptions: SelectOption[] = coaches.map((coach) => ({
    value: coach.id,
    label: `${coach.firstName} ${coach.lastName}`,
  }));

  const menteeOptions: SelectOption[] = mentees.map((mentee) => ({
    value: mentee.id,
    label: `${mentee.firstName} ${mentee.lastName} · ${mentee.groupName ?? "no group"}`,
  }));

  const groupOptions: SelectOption[] = groups.map((group) => ({
    value: group.id,
    label: group.isActive ? group.name : `${group.name} (archived)`,
  }));

  const delegationTargetOptions: SelectOption[] = [
    ...mentees.map((mentee) => ({
      value: `mentee:${mentee.id}`,
      label: `Mentee · ${mentee.firstName} ${mentee.lastName}`,
    })),
    ...groups.map((group) => ({
      value: `group:${group.id}`,
      label: `Group · ${group.name}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Coach groups</h1>
        <p className="mt-2 text-sm text-muted">
          Who coaches whom, and who is allowed to step in for whom.
        </p>
      </header>

      <GroupsClient
        groups={groupViews}
        delegations={delegations}
        coachOptions={coachOptions}
        menteeOptions={menteeOptions}
        groupOptions={groupOptions}
        delegationTargetOptions={delegationTargetOptions}
      />
    </div>
  );
}
