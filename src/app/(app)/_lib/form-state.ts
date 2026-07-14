/**
 * The idle state every `useActionState` form starts from.
 *
 * These live here, rather than beside the actions they belong to, for one hard
 * reason: a `"use server"` module may export ONLY async functions. Exporting a
 * plain object from one is a runtime error at module evaluation —
 * "A 'use server' file can only export async functions, found object."
 *
 * The action modules import the *types* from here (types are erased, so that is
 * safe); the client forms import the constants.
 */

export type GoalFormState = { error: string | null };
export const initialGoalState: GoalFormState = { error: null };

export type CheckInState = { error: string | null; saved: boolean };
export const initialCheckInState: CheckInState = { error: null, saved: false };

export type ProfileState = { error: string | null; success: string | null };
export const initialProfileState: ProfileState = { error: null, success: null };

/** Coach-side actions: did it work, and if not, why. */
export type ActionState = { error: string | null; ok: boolean };
export const INITIAL_ACTION_STATE: ActionState = { error: null, ok: false };

/** Admin actions also report *what* happened, for the maintenance toasts. */
export type AdminActionState = {
  ok: boolean;
  message: string | null;
  error: string | null;
};
export const IDLE_ACTION_STATE: AdminActionState = {
  ok: false,
  message: null,
  error: null,
};
