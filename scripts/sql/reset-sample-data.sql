-- A12 Tracker / Turso sample-data reset.
--
-- This wipes the app data, then creates:
--   - 1 admin account
--   - 5 coach accounts
--   - 5 mentees per coach, 25 mentees total
--   - 3 goals per mentee: personal, professional, contribution
--   - deterministic mixed goal statuses
--
-- Paste this into Turso/Drizzle Studio or run it with `turso db shell`.
-- It is intentionally transaction-free because some SQL editors wrap execution
-- themselves and can fail on explicit BEGIN/COMMIT statements.
--
-- Login after running:
--   Email:    admin@abundancehub.io
--   Password: Abundance123!
--
-- Sample coach login:
--   Email:    coach01@abundancehub.io
--   Password: Abundance123!
--
-- Sample mentee login:
--   Email:    mentee0101@abundancehub.io
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
  'Sample organization for coach and mentee testing.',
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

INSERT INTO "goal_categories" (
  "id",
  "key",
  "name",
  "description",
  "accent",
  "weight",
  "isRequired",
  "sortOrder"
) VALUES
  (
    'cat_PERSONAL',
    'PERSONAL',
    'Personal',
    'Health, relationships, energy and personal discipline.',
    'emerald',
    1,
    1,
    1
  ),
  (
    'cat_PROFESSIONAL',
    'PROFESSIONAL',
    'Professional',
    'Career, craft, leadership and business outcomes.',
    'blue',
    1,
    1,
    2
  ),
  (
    'cat_CONTRIBUTION',
    'CONTRIBUTION',
    'Contribution',
    'Service, community, generosity and impact.',
    'amber',
    1,
    1,
    3
  );

INSERT INTO "core_tasks" (
  "id",
  "organizationId",
  "key",
  "name",
  "description",
  "icon",
  "points",
  "sortOrder",
  "isActive",
  "createdAt"
) VALUES
  (
    'task_morning_mindset',
    'org_abundance_12',
    'morning_mindset',
    'Morning Mindset',
    'Start the day with intention.',
    'sunrise',
    25,
    1,
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'task_deep_work',
    'org_abundance_12',
    'deep_work',
    'Deep Work',
    'Complete one focused work block.',
    'target',
    25,
    2,
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'task_movement',
    'org_abundance_12',
    'movement',
    'Movement',
    'Move your body with purpose.',
    'activity',
    25,
    3,
    1,
    CURRENT_TIMESTAMP
  ),
  (
    'task_reflection',
    'org_abundance_12',
    'reflection',
    'Reflection',
    'Close the day with a short review.',
    'notebook-pen',
    25,
    4,
    1,
    CURRENT_TIMESTAMP
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

WITH RECURSIVE coach_numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM coach_numbers WHERE n < 5
)
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
)
SELECT
  printf('user_coach_%02d', n),
  'org_abundance_12',
  printf('coach%02d@abundancehub.io', n),
  '$2b$12$D7PqDnUex3FUi7GMe/YSo.h6HtoI6qs8O/.5BgoJIl7nowRUZrSRG',
  CASE n
    WHEN 1 THEN 'Diana'
    WHEN 2 THEN 'Marcus'
    WHEN 3 THEN 'Elena'
    WHEN 4 THEN 'Jonas'
    ELSE 'Priya'
  END,
  CASE n
    WHEN 1 THEN 'Reyes'
    WHEN 2 THEN 'Cole'
    WHEN 3 THEN 'Vargas'
    WHEN 4 THEN 'Lim'
    ELSE 'Kapoor'
  END,
  NULL,
  printf('Council coach %02d', n),
  NULL,
  'UTC',
  1,
  datetime('now', printf('-%d days', 45 + n)),
  CURRENT_TIMESTAMP,
  datetime('now', printf('-%d days', 45 + n)),
  datetime('now', printf('-%d days', 45 + n)),
  CURRENT_TIMESTAMP
FROM coach_numbers;

WITH RECURSIVE
  coach_numbers(c) AS (
    SELECT 1
    UNION ALL
    SELECT c + 1 FROM coach_numbers WHERE c < 5
  ),
  mentee_numbers(m) AS (
    SELECT 1
    UNION ALL
    SELECT m + 1 FROM mentee_numbers WHERE m < 5
  )
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
)
SELECT
  printf('user_mentee_%02d_%02d', c, m),
  'org_abundance_12',
  printf('mentee%02d%02d@abundancehub.io', c, m),
  '$2b$12$D7PqDnUex3FUi7GMe/YSo.h6HtoI6qs8O/.5BgoJIl7nowRUZrSRG',
  printf('Mentee %02d-%02d', c, m),
  'Member',
  NULL,
  printf('Member of Council %02d', c),
  NULL,
  'UTC',
  1,
  datetime('now', printf('-%d days', 20 + c + m)),
  datetime('now', printf('-%d days', (c + m) % 6)),
  datetime('now', printf('-%d days', 20 + c + m)),
  datetime('now', printf('-%d days', 20 + c + m)),
  CURRENT_TIMESTAMP
FROM coach_numbers
CROSS JOIN mentee_numbers;

INSERT INTO "user_roles" ("id", "userId", "roleId", "grantedAt") VALUES
  ('urole_admin_ADMIN', 'user_admin', 'role_ADMIN', CURRENT_TIMESTAMP),
  ('urole_admin_COACH', 'user_admin', 'role_COACH', CURRENT_TIMESTAMP);

WITH RECURSIVE coach_numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM coach_numbers WHERE n < 5
)
INSERT INTO "user_roles" ("id", "userId", "roleId", "grantedAt")
SELECT
  printf('urole_coach_%02d_COACH', n),
  printf('user_coach_%02d', n),
  'role_COACH',
  CURRENT_TIMESTAMP
FROM coach_numbers;

WITH RECURSIVE
  coach_numbers(c) AS (
    SELECT 1
    UNION ALL
    SELECT c + 1 FROM coach_numbers WHERE c < 5
  ),
  mentee_numbers(m) AS (
    SELECT 1
    UNION ALL
    SELECT m + 1 FROM mentee_numbers WHERE m < 5
  )
INSERT INTO "user_roles" ("id", "userId", "roleId", "grantedAt")
SELECT
  printf('urole_mentee_%02d_%02d_MENTEE', c, m),
  printf('user_mentee_%02d_%02d', c, m),
  'role_MENTEE',
  CURRENT_TIMESTAMP
FROM coach_numbers
CROSS JOIN mentee_numbers;

WITH RECURSIVE coach_numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM coach_numbers WHERE n < 5
)
INSERT INTO "coach_groups" (
  "id",
  "organizationId",
  "coachId",
  "name",
  "description",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  printf('group_coach_%02d', n),
  'org_abundance_12',
  printf('user_coach_%02d', n),
  CASE n
    WHEN 1 THEN 'North Council'
    WHEN 2 THEN 'East Council'
    WHEN 3 THEN 'South Council'
    WHEN 4 THEN 'West Council'
    ELSE 'Central Council'
  END,
  printf('Sample council led by coach %02d.', n),
  1,
  datetime('now', printf('-%d days', 30 + n)),
  CURRENT_TIMESTAMP
FROM coach_numbers;

WITH RECURSIVE
  coach_numbers(c) AS (
    SELECT 1
    UNION ALL
    SELECT c + 1 FROM coach_numbers WHERE c < 5
  ),
  mentee_numbers(m) AS (
    SELECT 1
    UNION ALL
    SELECT m + 1 FROM mentee_numbers WHERE m < 5
  )
INSERT INTO "group_memberships" (
  "id",
  "groupId",
  "menteeId",
  "joinedAt",
  "leftAt",
  "isActive"
)
SELECT
  printf('membership_%02d_%02d', c, m),
  printf('group_coach_%02d', c),
  printf('user_mentee_%02d_%02d', c, m),
  datetime('now', printf('-%d days', 15 + c + m)),
  NULL,
  1
FROM coach_numbers
CROSS JOIN mentee_numbers;

WITH RECURSIVE
  coach_numbers(c) AS (
    SELECT 1
    UNION ALL
    SELECT c + 1 FROM coach_numbers WHERE c < 5
  ),
  mentee_numbers(m) AS (
    SELECT 1
    UNION ALL
    SELECT m + 1 FROM mentee_numbers WHERE m < 5
  ),
  categories(category_order, category_id, category_key, category_name) AS (
    VALUES
      (1, 'cat_PERSONAL', 'PERSONAL', 'Personal'),
      (2, 'cat_PROFESSIONAL', 'PROFESSIONAL', 'Professional'),
      (3, 'cat_CONTRIBUTION', 'CONTRIBUTION', 'Contribution')
  ),
  seeded_goals AS (
    SELECT
      c,
      m,
      category_order,
      category_id,
      category_key,
      category_name,
      ((c * 17 + m * 11 + category_order * 5) % 5) AS status_bucket
    FROM coach_numbers
    CROSS JOIN mentee_numbers
    CROSS JOIN categories
  )
INSERT INTO "goals" (
  "id",
  "userId",
  "categoryId",
  "title",
  "description",
  "status",
  "progress",
  "direction",
  "targetValue",
  "currentValue",
  "unit",
  "startDate",
  "targetDate",
  "completedAt",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  printf('goal_%02d_%02d_%s', c, m, lower(category_key)),
  printf('user_mentee_%02d_%02d', c, m),
  category_id,
  category_name || ' goal for ' || printf('Mentee %02d-%02d', c, m),
  'Sample ' || lower(category_name) || ' goal for testing coach and mentee screens.',
  CASE status_bucket
    WHEN 0 THEN 'NOT_STARTED'
    WHEN 1 THEN 'IN_PROGRESS'
    WHEN 2 THEN 'AT_RISK'
    WHEN 3 THEN 'COMPLETED'
    ELSE 'ABANDONED'
  END,
  CASE status_bucket
    WHEN 0 THEN 0
    WHEN 1 THEN 35 + ((c + m + category_order) % 40)
    WHEN 2 THEN 15 + ((c + m + category_order) % 20)
    WHEN 3 THEN 100
    ELSE 20 + ((c + category_order) % 30)
  END,
  'GAIN',
  100,
  CASE status_bucket
    WHEN 0 THEN 0
    WHEN 1 THEN 35 + ((c + m + category_order) % 40)
    WHEN 2 THEN 15 + ((c + m + category_order) % 20)
    WHEN 3 THEN 100
    ELSE 20 + ((c + category_order) % 30)
  END,
  '%',
  datetime('now', printf('-%d days', 14 + c + m + category_order)),
  CASE status_bucket
    WHEN 2 THEN datetime('now', printf('-%d days', 2 + m))
    WHEN 3 THEN datetime('now', printf('-%d days', 1 + category_order))
    WHEN 4 THEN datetime('now', printf('-%d days', 10 + m))
    ELSE datetime('now', printf('+%d days', 20 + c + m + category_order))
  END,
  CASE status_bucket
    WHEN 3 THEN CURRENT_TIMESTAMP
    ELSE NULL
  END,
  'Generated by reset-sample-data.sql.',
  datetime('now', printf('-%d days', 14 + c + m + category_order)),
  CURRENT_TIMESTAMP
FROM seeded_goals;

INSERT INTO "goal_tasks" (
  "id",
  "goalId",
  "title",
  "status",
  "isComplete",
  "dueDate",
  "completedAt",
  "sortOrder",
  "weight"
)
SELECT
  'task_' || "id" || '_first_action',
  "id",
  'Complete first action',
  CASE
    WHEN "status" = 'COMPLETED' THEN 'DONE'
    WHEN "status" = 'NOT_STARTED' THEN 'NOT_STARTED'
    ELSE 'IN_PROGRESS'
  END,
  CASE WHEN "status" = 'COMPLETED' THEN 1 ELSE 0 END,
  "targetDate",
  CASE WHEN "status" = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END,
  1,
  1
FROM "goals";
