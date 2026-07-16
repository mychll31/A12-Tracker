import type { Metadata } from "next";
import { CalendarDays, Mail, UsersRound } from "lucide-react";

import { Avatar, Badge, Card, ScoreRing } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/domain";
import { scoreTone } from "@/lib/utils";
import { getMenteeProfile, listCouncilsForMember } from "@/server/mentees";

import { AccessNotice, guard } from "../_components/guard";
import { CouncilPicker } from "./council-picker";
import { PasswordForm, ProfileForm, type ProfileDefaults } from "./forms";

export const metadata: Metadata = { title: "Profile" };

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Who you are here, and the settings that keep the account yours.
      </p>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();

  // Reading your own profile is always permitted — but it goes through the same
  // guarded path as any other member, so there is no second code path that could
  // drift out of step with the visibility rules.
  const loaded = await guard(() => getMenteeProfile(user, user.id));

  if (!loaded.ok) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <AccessNotice message={loaded.message} />
        </div>
      </div>
    );
  }

  const { user: profile, score, group, joinedAt } = loaded.data;

  const councils = await listCouncilsForMember(user);

  const defaults: ProfileDefaults = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
  };

  return (
    <div className="animate-slide-up">
      <Header />

      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar
            src={profile.avatarUrl}
            firstName={profile.firstName}
            lastName={profile.lastName}
            size="lg"
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {profile.firstName} {profile.lastName}
            </h2>

            {profile.headline ? (
              <p className="mt-0.5 text-sm text-muted-strong">
                {profile.headline}
              </p>
            ) : null}

            {/* Every role the account holds — a coach who is also a mentee shows
                both, rather than being made to pick an identity. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <Badge key={role} variant="primary">
                  {ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>

            <dl className="mt-4 space-y-1.5 text-xs text-muted">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Email</dt>
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <dd className="truncate">{profile.email}</dd>
              </div>

              <div className="flex items-center gap-2">
                <dt className="sr-only">Joined</dt>
                <CalendarDays
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <dd>Joined {formatDate(joinedAt)}</dd>
              </div>

              {group ? (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Council and coach</dt>
                  <UsersRound
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <dd>
                    {group.name} · coached by {group.coach.firstName}{" "}
                    {group.coach.lastName}
                  </dd>
                </div>
              ) : null}
            </dl>

            {profile.bio ? (
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-strong">
                {profile.bio}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 sm:pl-2">
            <ScoreRing
              score={score.overallScore}
              tone={scoreTone(score.overallScore)}
              label="Overall"
              sublabel={`${score.currentStreak}-day streak`}
            />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <CouncilPicker councils={councils} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight">
            Edit profile
          </h2>
          <p className="mb-5 mt-0.5 text-sm text-muted">
            How you appear to your coach and your council.
          </p>

          <ProfileForm defaults={defaults} />
        </Card>

        <Card className="h-fit p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight">
            Change password
          </h2>
          <p className="mb-5 mt-0.5 text-sm text-muted">
            You&apos;ll need your current password to set a new one.
          </p>

          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}
