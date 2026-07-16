"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, type SessionUser } from "@/lib/auth";
import { ROLE_KEYS } from "@/lib/domain";
import { ForbiddenError } from "@/lib/rbac";
import { persistSnapshots } from "@/lib/scoring";
import {
  assignMenteeToGroup,
  createGroup,
  createUser,
  grantDelegation,
  removeMenteeFromGroup,
  resetPassword,
  revokeDelegation,
  setUserRoles,
  updateGroup,
  updateUser,
  upsertCoreTask,
} from "@/server/admin";
import { captureLeaderboards } from "@/server/leaderboards";
import { runNotificationSweep } from "@/server/notifications";

/**
 * Every administrative write, in the shape `useActionState` wants.
 *
 * `requireAdmin()` is called *outside* the try/catch in each action on purpose:
 * it redirects, and `redirect()` signals by throwing. Catching that would turn a
 * bounce to /dashboard into a form error message.
 */

import type { AdminActionState as ActionState } from "../_lib/form-state";


const succeed = (message: string): ActionState => ({
  ok: true,
  message,
  error: null,
});

const fail = (error: string): ActionState => ({
  ok: false,
  message: null,
  error,
});

const USER_PATHS = ["/admin", "/admin/users"];
const GROUP_PATHS = ["/admin", "/admin/groups", "/admin/users"];
const CORE_TASK_PATHS = ["/admin", "/admin/core-tasks"];
const MAINTENANCE_PATHS = ["/admin", "/dashboard", "/leaderboards"];

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/** Anything a person should never read — a stack, a Prisma constraint — is replaced here. */
function friendly(error: unknown): string {
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the form and try again.";
  }
  if (hasCode(error, "P2002")) {
    return "That value is already taken. Email addresses and core-task keys must be unique.";
  }
  if (hasCode(error, "P2025")) return "That record no longer exists.";

  // The domain layer throws plain single-line Errors with copy that reads fine.
  if (error instanceof Error && error.message && !error.message.includes("\n")) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

async function run(
  work: () => Promise<string>,
  paths: string[],
): Promise<ActionState> {
  try {
    const message = await work();
    for (const path of paths) revalidatePath(path);
    return succeed(message);
  } catch (error) {
    return fail(friendly(error));
  }
}

// ---------------------------------------------------------------------------
// FormData readers
// ---------------------------------------------------------------------------

/** Present-but-empty collapses to undefined — an untouched optional field. */
function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Present-but-empty stays `""`, which the server layer turns into NULL. This is
 * what lets an edit form actually *clear* a headline or a description.
 */
function raw(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function strings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

const roleList = z.array(z.enum(ROLE_KEYS)).min(1, "Pick at least one role.");

const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

const flag = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

/** Delegation expiry arrives as an ISO `YYYY-MM-DD` date input. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password,
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  headline: z.string().optional(),
  roles: roleList,
  groupId: z.string().optional(),
});

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor: SessionUser = await requireAdmin();

  return run(async () => {
    const input = createUserSchema.parse({
      email: text(formData, "email"),
      password: text(formData, "password"),
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      headline: text(formData, "headline"),
      roles: strings(formData, "roles"),
      groupId: text(formData, "groupId"),
    });

    await createUser(actor, input);
    return `${input.firstName} ${input.lastName} was added.`;
  }, USER_PATHS);
}

const updateUserSchema = z.object({
  userId: z.string().min(1, "That member no longer exists."),
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  email: z.string().email("Enter a valid email address.").optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  isActive: flag,
});

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const { userId, ...input } = updateUserSchema.parse({
      userId: text(formData, "userId"),
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      email: text(formData, "email"),
      headline: raw(formData, "headline"),
      bio: raw(formData, "bio"),
      isActive: raw(formData, "isActive"),
    });

    await updateUser(actor, userId, input);

    if (input.isActive === false) return "That member was deactivated.";
    if (input.isActive === true) return "That member was reactivated.";
    return "Profile saved.";
  }, USER_PATHS);
}

const setRolesSchema = z.object({
  userId: z.string().min(1, "That member no longer exists."),
  roles: roleList,
});

export async function setUserRolesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const { userId, roles } = setRolesSchema.parse({
      userId: text(formData, "userId"),
      roles: strings(formData, "roles"),
    });

    await setUserRoles(actor, userId, roles);
    return "Roles updated.";
  }, USER_PATHS);
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1, "That member no longer exists."),
  password,
});

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = resetPasswordSchema.parse({
      userId: text(formData, "userId"),
      password: text(formData, "password"),
    });

    await resetPassword(actor, input.userId, input.password);
    return "Password reset. Share the new one with them directly.";
  }, USER_PATHS);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().min(1, "Give the council a name."),
  description: z.string().optional(),
  coachId: z.string().min(1, "Choose a coach to lead the council."),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = createGroupSchema.parse({
      name: text(formData, "name"),
      description: text(formData, "description"),
      coachId: text(formData, "coachId"),
    });

    await createGroup(actor, input);
    return `${input.name} was created.`;
  }, GROUP_PATHS);
}

const updateGroupSchema = z.object({
  groupId: z.string().min(1, "That council no longer exists."),
  name: z.string().min(1, "Give the council a name.").optional(),
  description: z.string().optional(),
  isActive: flag,
});

export async function updateGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const { groupId, ...input } = updateGroupSchema.parse({
      groupId: text(formData, "groupId"),
      name: text(formData, "name"),
      description: raw(formData, "description"),
      isActive: raw(formData, "isActive"),
    });

    await updateGroup(actor, groupId, input);
    return "Council saved.";
  }, GROUP_PATHS);
}

const assignMenteeSchema = z.object({
  menteeId: z.string().min(1, "Choose a mentee."),
  groupId: z.string().min(1, "Choose a council."),
});

export async function assignMenteeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = assignMenteeSchema.parse({
      menteeId: text(formData, "menteeId"),
      groupId: text(formData, "groupId"),
    });

    await assignMenteeToGroup(actor, input.menteeId, input.groupId);
    // The server closes any prior membership, so this is a move, not a copy.
    return "Mentee moved into the council. Any previous membership was closed.";
  }, GROUP_PATHS);
}

export async function removeMenteeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = assignMenteeSchema.parse({
      menteeId: text(formData, "menteeId"),
      groupId: text(formData, "groupId"),
    });

    await removeMenteeFromGroup(actor, input.menteeId, input.groupId);
    return "Member removed from the council.";
  }, GROUP_PATHS);
}

// ---------------------------------------------------------------------------
// Delegations
// ---------------------------------------------------------------------------

const grantDelegationSchema = z.object({
  granteeId: z.string().min(1, "Choose the coach receiving access."),
  // One control, two kinds of target — a delegation is never both at once.
  target: z
    .string()
    .regex(/^(mentee|group):.+$/, "Choose a mentee or a council."),
  expiresAt: isoDate.optional(),
});

export async function grantDelegationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = grantDelegationSchema.parse({
      granteeId: text(formData, "granteeId"),
      target: text(formData, "target"),
      expiresAt: text(formData, "expiresAt"),
    });

    const separator = input.target.indexOf(":");
    const kind = input.target.slice(0, separator);
    const id = input.target.slice(separator + 1);

    await grantDelegation(actor, {
      granteeId: input.granteeId,
      ...(kind === "mentee" ? { menteeId: id } : { groupId: id }),
      permission: "EDIT",
      expiresAt: input.expiresAt ?? null,
    });

    return "Delegation granted.";
  }, GROUP_PATHS);
}

const revokeDelegationSchema = z.object({
  delegationId: z.string().min(1, "That delegation no longer exists."),
});

export async function revokeDelegationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = revokeDelegationSchema.parse({
      delegationId: text(formData, "delegationId"),
    });

    await revokeDelegation(actor, input.delegationId);
    return "Delegation revoked.";
  }, GROUP_PATHS);
}

// ---------------------------------------------------------------------------
// Core tasks
// ---------------------------------------------------------------------------

const upsertCoreTaskSchema = z.object({
  id: z.string().optional(),
  key: z
    .string()
    .min(1, "A key is required.")
    .regex(
      /^[A-Z0-9_]+$/,
      "Use uppercase letters, numbers and underscores only.",
    ),
  name: z.string().min(1, "A name is required."),
  description: z.string().optional(),
  icon: z.string().optional(),
  points: z.coerce.number().int().min(0, "Points cannot be negative."),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
  isActive: z.boolean(),
});

export async function upsertCoreTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const input = upsertCoreTaskSchema.parse({
      id: text(formData, "id"),
      key: text(formData, "key"),
      name: text(formData, "name"),
      description: raw(formData, "description"),
      icon: text(formData, "icon"),
      points: text(formData, "points") ?? "0",
      sortOrder: text(formData, "sortOrder") ?? "0",
      isActive: checkbox(formData, "isActive"),
    });

    await upsertCoreTask(actor, {
      ...input,
      organizationId: actor.organizationId,
    });

    return input.id ? `${input.name} was saved.` : `${input.name} was created.`;
  }, CORE_TASK_PATHS);
}

// ---------------------------------------------------------------------------
// System maintenance — the nightly cron, on demand
// ---------------------------------------------------------------------------

export async function recalculateAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const snapshots = await persistSnapshots(actor.organizationId);
    const rows = await captureLeaderboards(actor.organizationId);

    return `Snapshotted ${snapshots.users} members, ${snapshots.coaches} coaches and ${snapshots.groups} councils, and captured ${rows} leaderboard rows.`;
  }, MAINTENANCE_PATHS);
}

export async function notificationSweepAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  return run(async () => {
    const created = await runNotificationSweep(actor.organizationId);

    return created === 0
      ? "Sweep complete. Everybody is already up to date."
      : `Sweep complete. ${created} ${created === 1 ? "notification" : "notifications"} created.`;
  }, [...MAINTENANCE_PATHS, "/notifications"]);
}
