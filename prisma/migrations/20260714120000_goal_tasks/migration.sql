-- Goal to-do items were modelled as "milestones". They are a task list, and the
-- goal's score is computed from them, so the model now says so.
--
-- Written by hand rather than generated: Prisma renders a rename as DROP +
-- CREATE, which would throw away every existing to-do item. RENAME keeps them.

ALTER TABLE "goal_milestones" RENAME TO "goal_tasks";

DROP INDEX IF EXISTS "goal_milestones_goalId_idx";
CREATE INDEX "goal_tasks_goalId_idx" ON "goal_tasks"("goalId");

-- Lets a heavy task count for more than a trivial one. Default 1 means an
-- unweighted goal scores as a plain percentage of its tasks completed.
ALTER TABLE "goal_tasks" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;
