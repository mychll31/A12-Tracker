"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import type { BadgeVariant, SelectOption } from "@/components/ui";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/domain";

import { ActionForm, InlineAction } from "../action-form";
import {
  createUserAction,
  resetPasswordAction,
  setUserRolesAction,
  updateUserAction,
} from "../actions";

/** Dates arrive pre-formatted: relative time computed here would break hydration. */
export type AdminUserView = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  roles: RoleKey[];
  groupName: string | null;
  joinedLabel: string;
  lastActiveLabel: string;
};

const ROLE_VARIANTS: Record<RoleKey, BadgeVariant> = {
  ADMIN: "primary",
  COACH: "info",
  MENTEE: "neutral",
};

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: AdminUserView }
  | { kind: "roles"; user: AdminUserView }
  | { kind: "password"; user: AdminUserView }
  | null;

function RoleCheckboxes({ selected }: { selected: RoleKey[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium leading-none text-muted-strong">
        Roles
      </legend>
      {ROLE_KEYS.map((key) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
        >
          <input
            type="checkbox"
            name="roles"
            value={key}
            defaultChecked={selected.includes(key)}
            className="size-4 shrink-0 rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {ROLE_LABELS[key]}
        </label>
      ))}
    </fieldset>
  );
}

function Toolbar({
  search,
  role,
  onCreate,
}: {
  search: string;
  role: string;
  onCreate: () => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(search);

  const push = useCallback(
    (next: { search?: string; role?: string }) => {
      const params = new URLSearchParams();
      const nextSearch = next.search ?? term;
      const nextRole = next.role ?? role;

      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextRole) params.set("role", nextRole);

      const query = params.toString();
      router.push(query ? `/admin/users?${query}` : "/admin/users");
    },
    [router, term, role],
  );

  const roleOptions: SelectOption[] = [
    { value: "", label: "All roles" },
    ...ROLE_KEYS.map((key) => ({ value: key, label: ROLE_LABELS[key] })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          push({});
        }}
        className="flex flex-1 flex-col gap-3 sm:max-w-xl sm:flex-row"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            name="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
            className="pl-9"
          />
        </div>

        <Select
          options={roleOptions}
          value={role}
          onChange={(event) => push({ role: event.target.value })}
          aria-label="Filter by role"
          className="sm:w-44"
        />

        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Button icon={<Plus />} onClick={onCreate} className="sm:shrink-0">
        New user
      </Button>
    </div>
  );
}

export function UsersClient({
  users,
  groupOptions,
  search,
  role,
}: {
  users: AdminUserView[];
  groupOptions: SelectOption[];
  search: string;
  role: string;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  const filtered = search.length > 0 || role.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <Toolbar
        search={search}
        role={role}
        onCreate={() => setDialog({ kind: "create" })}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={filtered ? "No members match those filters" : "No members yet"}
          description={
            filtered
              ? "Try a different name, email or role."
              : "Add the first member of the organization to get started."
          }
          action={
            <Button
              icon={<Plus />}
              onClick={() => setDialog({ kind: "create" })}
            >
              New user
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Roles</TH>
              <TH>Group</TH>
              <TH>Joined</TH>
              <TH>Last active</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => (
              <TR key={user.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatarUrl}
                      firstName={user.firstName}
                      lastName={user.lastName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TD>

                <TD>
                  <div className="flex flex-wrap gap-1">
                    {/* Driven off ROLE_KEYS so a coach who is also a mentee
                        shows both badges, in a stable order. */}
                    {ROLE_KEYS.filter((key) => user.roles.includes(key)).map(
                      (key) => (
                        <Badge key={key} size="sm" variant={ROLE_VARIANTS[key]}>
                          {ROLE_LABELS[key]}
                        </Badge>
                      ),
                    )}
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-muted">None</span>
                    ) : null}
                  </div>
                </TD>

                <TD className="text-sm text-muted">{user.groupName ?? "—"}</TD>
                <TD className="whitespace-nowrap text-sm text-muted">
                  {user.joinedLabel}
                </TD>
                <TD className="whitespace-nowrap text-sm text-muted">
                  {user.lastActiveLabel}
                </TD>

                <TD>
                  <Badge
                    size="sm"
                    variant={user.isActive ? "success" : "neutral"}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TD>

                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil />}
                      onClick={() => setDialog({ kind: "edit", user })}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<ShieldCheck />}
                      onClick={() => setDialog({ kind: "roles", user })}
                    >
                      Roles
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<KeyRound />}
                      onClick={() => setDialog({ kind: "password", user })}
                    >
                      Password
                    </Button>
                    <InlineAction
                      action={updateUserAction}
                      title={user.isActive ? "Deactivate" : "Reactivate"}
                      label={user.isActive ? "Deactivate" : "Reactivate"}
                      fields={{
                        userId: user.id,
                        isActive: user.isActive ? "false" : "true",
                      }}
                      confirm={
                        user.isActive
                          ? `Deactivate ${user.firstName} ${user.lastName}? They will not be able to sign in.`
                          : undefined
                      }
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={dialog?.kind === "create"}
        onClose={close}
        title="New user"
        description="They can sign in as soon as you save. Share the password with them directly."
        size="lg"
      >
        <ActionForm
          action={createUserAction}
          submitLabel="Create user"
          onSuccess={close}
          onCancel={close}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required>
              <Input name="firstName" autoComplete="given-name" required />
            </FormField>
            <FormField label="Last name" required>
              <Input name="lastName" autoComplete="family-name" required />
            </FormField>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Email" required>
              <Input name="email" type="email" autoComplete="off" required />
            </FormField>
            <FormField
              label="Password"
              required
              hint="At least 10 characters, with a number and mixed case."
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField
              label="Headline"
              hint="Optional. Shown on their profile."
            >
              <Input
                name="headline"
                placeholder="Building a coaching practice"
              />
            </FormField>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <RoleCheckboxes selected={["MENTEE"]} />

            <FormField
              label="Coaching group"
              hint="Optional. Placing them in a group also grants the Mentee role."
            >
              <Select
                name="groupId"
                options={groupOptions}
                placeholder="No group"
              />
            </FormField>
          </div>
        </ActionForm>
      </Modal>

      <Modal
        open={dialog?.kind === "edit"}
        onClose={close}
        title="Edit member"
        description="Name and email only. Headline and bio are edited from their own profile."
      >
        {dialog?.kind === "edit" ? (
          <ActionForm
            action={updateUserAction}
            submitLabel="Save changes"
            onSuccess={close}
            onCancel={close}
          >
            <input type="hidden" name="userId" value={dialog.user.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" required>
                <Input
                  name="firstName"
                  defaultValue={dialog.user.firstName}
                  required
                />
              </FormField>
              <FormField label="Last name" required>
                <Input
                  name="lastName"
                  defaultValue={dialog.user.lastName}
                  required
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Email" required>
                <Input
                  name="email"
                  type="email"
                  defaultValue={dialog.user.email}
                  required
                />
              </FormField>
            </div>
          </ActionForm>
        ) : null}
      </Modal>

      <Modal
        open={dialog?.kind === "roles"}
        onClose={close}
        title="Manage roles"
        description="A member can hold more than one role — a coach who is also a mentee keeps both."
        size="sm"
      >
        {dialog?.kind === "roles" ? (
          <ActionForm
            action={setUserRolesAction}
            submitLabel="Save roles"
            onSuccess={close}
            onCancel={close}
          >
            <input type="hidden" name="userId" value={dialog.user.id} />
            <p className="mb-4 text-sm text-muted">
              {dialog.user.firstName} {dialog.user.lastName}
            </p>
            <RoleCheckboxes selected={dialog.user.roles} />
          </ActionForm>
        ) : null}
      </Modal>

      <Modal
        open={dialog?.kind === "password"}
        onClose={close}
        title="Reset password"
        description="The old password stops working immediately. There is no email — hand the new one over yourself."
        size="sm"
      >
        {dialog?.kind === "password" ? (
          <ActionForm
            action={resetPasswordAction}
            submitLabel="Reset password"
            submitVariant="danger"
            onSuccess={close}
            onCancel={close}
          >
            <input type="hidden" name="userId" value={dialog.user.id} />
            <p className="mb-4 text-sm text-muted">
              {dialog.user.firstName} {dialog.user.lastName} ·{" "}
              {dialog.user.email}
            </p>
            <FormField
              label="New password"
              required
              hint="At least 10 characters, with a number and mixed case."
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </FormField>
          </ActionForm>
        ) : null}
      </Modal>
    </div>
  );
}
