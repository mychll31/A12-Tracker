-- A12 Tracker / Turso cleanup: leave one administrator account only.
--
-- Paste this into Turso/Drizzle Studio or run it with `turso db shell`.
-- It is intentionally transaction-free because some SQL editors wrap execution
-- themselves and can fail on explicit BEGIN/COMMIT statements.
--
-- Login after running:
--   Email:    admin@abundancehub.io
--   Password: Abundance123!

PRAGMA foreign_keys = ON;

DELETE FROM "attachments";
DELETE FROM "note_action_items";
DELETE FROM "coaching_notes";
DELETE FROM "check_in_reviews";
DELETE FROM "daily_check_ins";
DELETE FROM "core_task_completions";
DELETE FROM "goal_comments";
DELETE FROM "goal_updates";
DELETE FROM "goal_tasks";
DELETE FROM "goals";
DELETE FROM "leaderboard_entries";
DELETE FROM "score_snapshots";
DELETE FROM "coach_score_snapshots";
DELETE FROM "group_score_snapshots";
DELETE FROM "org_score_snapshots";
DELETE FROM "user_streaks";
DELETE FROM "user_achievements";
DELETE FROM "achievements";
DELETE FROM "notification_preferences";
DELETE FROM "notifications";
DELETE FROM "activity_logs";
DELETE FROM "coach_delegations";
DELETE FROM "group_memberships";
DELETE FROM "coach_groups";
DELETE FROM "user_roles";
DELETE FROM "users";
DELETE FROM "core_tasks";
DELETE FROM "goal_categories";
DELETE FROM "roles";
DELETE FROM "organizations";

INSERT INTO "organizations" (
  "id",
  "name",
  "slug",
  "description",
  "createdAt",
  "updatedAt"
) VALUES (
  'org_abundance_12',
  'Abundance 12',
  'abundance-12',
  'Clean production baseline.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "roles" ("id", "key", "name", "description") VALUES
  (
    'role_ADMIN',
    'ADMIN',
    'Administrator',
    'Full access to the organization, its people and its settings.'
  ),
  (
    'role_COACH',
    'COACH',
    'Coach',
    'Leads a coaching group, reviews mentees and writes notes.'
  ),
  (
    'role_MENTEE',
    'MENTEE',
    'Mentee',
    'Sets goals in all three categories and logs the daily disciplines.'
  );

INSERT INTO "users" (
  "id",
  "organizationId",
  "email",
  "passwordHash",
  "firstName",
  "lastName",
  "avatarUrl",
  "headline",
  "bio",
  "timezone",
  "isActive",
  "joinedAt",
  "lastActiveAt",
  "onboardedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  'user_admin',
  'org_abundance_12',
  'admin@abundancehub.io',
  '$2b$12$D7PqDnUex3FUi7GMe/YSo.h6HtoI6qs8O/.5BgoJIl7nowRUZrSRG',
  'Avery',
  'Stone',
  NULL,
  'Platform administrator',
  NULL,
  'UTC',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- The only user is still an admin account. The COACH role is included so the
-- same account can open coach screens while production data is empty.
INSERT INTO "user_roles" ("id", "userId", "roleId", "grantedAt") VALUES
  ('urole_admin_ADMIN', 'user_admin', 'role_ADMIN', CURRENT_TIMESTAMP),
  ('urole_admin_COACH', 'user_admin', 'role_COACH', CURRENT_TIMESTAMP);
