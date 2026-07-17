"use client";

import { useActionState } from "react";
import { AlertCircle, CircleCheck } from "lucide-react";

import {
  Button,
  FormField,
  Input,
  PasswordInput,
  Textarea,
} from "@/components/ui";

import { changePassword, updateProfile } from "./actions";
import { initialProfileState } from "../_lib/form-state";
import type { ProfileState } from "../_lib/form-state";

function Feedback({ state }: { state: ProfileState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {state.success}
      </p>
    );
  }

  return null;
}

export type ProfileDefaults = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  avatarUrl: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialProfileState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="First name" required>
          <Input
            name="firstName"
            defaultValue={defaults.firstName}
            autoComplete="given-name"
            required
          />
        </FormField>

        <FormField label="Last name" required>
          <Input
            name="lastName"
            defaultValue={defaults.lastName}
            autoComplete="family-name"
            required
          />
        </FormField>
      </div>

      <FormField
        label="Declaration"
        hint="One line that says what you're working towards."
      >
        <Input
          name="Declaration"
          defaultValue={defaults.headline}
          placeholder="Building a business that outlives me"
          maxLength={120}
        />
      </FormField>

      <FormField label="Bio">
        <Textarea
          name="bio"
          defaultValue={defaults.bio}
          rows={4}
          maxLength={1000}
          placeholder="A little about you — where you are, and where you're heading."
        />
      </FormField>

      <FormField label="Avatar URL" hint="A link to an image, http(s) only.">
        <Input
          name="avatarUrl"
          type="url"
          defaultValue={defaults.avatarUrl}
          placeholder="https://…"
        />
      </FormField>

      <Feedback state={state} />

      <Button type="submit" isLoading={pending}>
        Save changes
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialProfileState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Current password" required>
        <PasswordInput
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </FormField>

      <FormField
        label="New password"
        hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number."
        required
      >
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          required
        />
      </FormField>

      <Feedback state={state} />

      <Button type="submit" variant="secondary" isLoading={pending}>
        Change password
      </Button>
    </form>
  );
}
