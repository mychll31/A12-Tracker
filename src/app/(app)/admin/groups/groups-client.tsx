"use client";

import { useCallback, useState } from "react";
import {
  ArrowRightLeft,
  KeySquare,
  Network,
  Pencil,
  Plus,
  ShieldPlus,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";

import { ActionForm, InlineAction } from "../action-form";
import {
  assignMenteeAction,
  createGroupAction,
  grantDelegationAction,
  removeMenteeAction,
  revokeDelegationAction,
  updateGroupAction,
} from "../actions";

export type GroupMemberView = { id: string; name: string };

export type GroupView = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  coachName: string;
  memberCount: number;
  averageScore: number;
  members: GroupMemberView[];
};

/** Dates are pre-formatted and expiry is pre-evaluated on the server. */
export type DelegationView = {
  id: string;
  grantorName: string;
  granteeName: string;
  scopeLabel: string;
  permission: string;
  expiresLabel: string;
  isExpired: boolean;
};

type Dialog =
  | { kind: "create-group" }
  | { kind: "edit-group"; group: GroupView }
  | { kind: "assign" }
  | { kind: "grant" }
  | null;

export function GroupsClient({
  groups,
  delegations,
  coachOptions,
  menteeOptions,
  groupOptions,
  delegationTargetOptions,
}: {
  groups: GroupView[];
  delegations: DelegationView[];
  coachOptions: SelectOption[];
  menteeOptions: SelectOption[];
  groupOptions: SelectOption[];
  delegationTargetOptions: SelectOption[];
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            A mentee belongs to exactly one council. Moving them into a
            new one closes the old membership.
          </p>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              icon={<ArrowRightLeft />}
              onClick={() => setDialog({ kind: "assign" })}
            >
              Assign mentee
            </Button>
            <Button
              icon={<Plus />}
              onClick={() => setDialog({ kind: "create-group" })}
            >
              New council
            </Button>
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No councils yet"
            description="A council is a coach and the mentees they lead. Create the first one to start placing members."
            action={
              <Button
                icon={<Plus />}
                onClick={() => setDialog({ kind: "create-group" })}
              >
                New council
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Coached by {group.coachName}
                      </CardDescription>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        size="sm"
                        variant={group.isActive ? "success" : "neutral"}
                      >
                        {group.isActive ? "Active" : "Archived"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Pencil />}
                        onClick={() => setDialog({ kind: "edit-group", group })}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  {group.description ? (
                    <p className="text-sm leading-relaxed text-muted">
                      {group.description}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Members
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {group.memberCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Avg score
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xl font-semibold tabular-nums",
                          TONE_TEXT[scoreTone(group.averageScore)],
                        )}
                      >
                        {formatScore(group.averageScore)}
                      </p>
                    </div>
                  </div>

                  {group.members.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-surface-sunken px-3 py-4 text-center text-xs text-muted">
                      No mentees in this council yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {group.members.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-sunken"
                        >
                          <span className="truncate text-sm">
                            {member.name}
                          </span>
                          <InlineAction
                            action={removeMenteeAction}
                            title="Remove member"
                            label="Remove"
                            fields={{ menteeId: member.id, groupId: group.id }}
                            confirm={`Remove ${member.name} from ${group.name}? They will be left without a council.`}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Delegations</CardTitle>
                <CardDescription>
                  A delegation is what lets a coach edit another coach&apos;s
                  mentee — their goals, tasks and check-ins. Without one, a coach
                  can see a colleague&apos;s mentees but not change anything.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                icon={<ShieldPlus />}
                onClick={() => setDialog({ kind: "grant" })}
                className="shrink-0"
              >
                Grant access
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {delegations.length === 0 ? (
              <EmptyState
                icon={KeySquare}
                title="No delegations"
                description="Every coach edits only their own mentees. Grant access when one coach needs to cover for another."
                action={
                  <Button
                    variant="outline"
                    icon={<ShieldPlus />}
                    onClick={() => setDialog({ kind: "grant" })}
                  >
                    Grant access
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Granted by</TH>
                    <TH>Granted to</TH>
                    <TH>Covers</TH>
                    <TH>Permission</TH>
                    <TH>Expires</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {delegations.map((row) => (
                    <TR key={row.id}>
                      <TD className="text-sm">{row.grantorName}</TD>
                      <TD className="text-sm font-medium">{row.granteeName}</TD>
                      <TD className="text-sm text-muted">{row.scopeLabel}</TD>
                      <TD>
                        <Badge size="sm" variant="info">
                          {row.permission}
                        </Badge>
                      </TD>
                      <TD>
                        <span
                          className={cn(
                            "text-sm",
                            row.isExpired
                              ? "text-rose-500 dark:text-rose-400"
                              : "text-muted",
                          )}
                        >
                          {row.expiresLabel}
                          {row.isExpired ? " · expired" : ""}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex justify-end">
                          <InlineAction
                            action={revokeDelegationAction}
                            title="Revoke delegation"
                            label="Revoke"
                            fields={{ delegationId: row.id }}
                            confirm={`Revoke ${row.granteeName}'s access to ${row.scopeLabel}?`}
                          />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Modal
        open={dialog?.kind === "create-group"}
        onClose={close}
        title="New council"
        description="Pick the coach who will lead it. Mentees are placed into the council afterwards."
      >
        <ActionForm
          action={createGroupAction}
          submitLabel="Create council"
          onSuccess={close}
          onCancel={close}
        >
          <FormField label="Name" required>
            <Input name="name" placeholder="Momentum" required />
          </FormField>

          <div className="mt-4">
            <FormField label="Coach" required>
              <Select
                name="coachId"
                options={coachOptions}
                placeholder="Choose a coach"
                required
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label="Description" hint="Optional.">
              <Textarea
                name="description"
                rows={3}
                placeholder="What this council is working toward."
              />
            </FormField>
          </div>
        </ActionForm>
      </Modal>

      <Modal
        open={dialog?.kind === "edit-group"}
        onClose={close}
        title="Edit council"
        description="Archiving a council leaves its members without an active council."
      >
        {dialog?.kind === "edit-group" ? (
          <ActionForm
            action={updateGroupAction}
            submitLabel="Save council"
            onSuccess={close}
            onCancel={close}
          >
            <input type="hidden" name="groupId" value={dialog.group.id} />

            <FormField label="Name" required>
              <Input name="name" defaultValue={dialog.group.name} required />
            </FormField>

            <div className="mt-4">
              <FormField label="Description">
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={dialog.group.description ?? ""}
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Status">
                <Select
                  name="isActive"
                  defaultValue={dialog.group.isActive ? "true" : "false"}
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Archived" },
                  ]}
                />
              </FormField>
            </div>
          </ActionForm>
        ) : null}
      </Modal>

      <Modal
        open={dialog?.kind === "assign"}
        onClose={close}
        title="Assign a mentee to a council"
        description="This MOVES the mentee. A mentee belongs to exactly one council, so any council they are currently in is closed out."
      >
        <ActionForm
          action={assignMenteeAction}
          submitLabel="Move mentee"
          onSuccess={close}
          onCancel={close}
        >
          <FormField label="Mentee" required>
            <Select
              name="menteeId"
              options={menteeOptions}
              placeholder="Choose a mentee"
              required
            />
          </FormField>

          <div className="mt-4">
            <FormField
              label="Council"
              required
              hint="Their previous membership is deactivated, not deleted — the history stays."
            >
              <Select
                name="groupId"
                options={groupOptions}
                placeholder="Choose a council"
                required
              />
            </FormField>
          </div>
        </ActionForm>
      </Modal>

      <Modal
        open={dialog?.kind === "grant"}
        onClose={close}
        title="Grant a delegation"
        description="The receiving coach will be able to edit the mentee — or every mentee in the council — as if they were their own."
      >
        <ActionForm
          action={grantDelegationAction}
          submitLabel="Grant access"
          onSuccess={close}
          onCancel={close}
        >
          <FormField label="Coach receiving access" required>
            <Select
              name="granteeId"
              options={coachOptions}
              placeholder="Choose a coach"
              required
            />
          </FormField>

          <div className="mt-4">
            <FormField
              label="Covers"
              required
              hint="A single mentee, or a whole council."
            >
              <Select
                name="target"
                options={delegationTargetOptions}
                placeholder="Choose a mentee or a council"
                required
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField
              label="Expires"
              hint="Optional. Leave empty for access that never lapses."
            >
              <Input name="expiresAt" type="date" />
            </FormField>
          </div>
        </ActionForm>
      </Modal>
    </div>
  );
}
