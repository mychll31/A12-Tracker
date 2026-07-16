/**
 * The wizard's `useActionState` shape.
 *
 * It lives here rather than in actions.ts for one hard reason: a `"use server"`
 * module may export ONLY async functions. Exporting a plain object from one is a
 * runtime crash at module evaluation.
 */

export type OnboardingFormState = { error: string | null };

export const INITIAL_ONBOARDING_STATE: OnboardingFormState = { error: null };
