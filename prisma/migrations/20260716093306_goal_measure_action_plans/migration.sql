-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_goal_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "goal_tasks_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Backfill action-plan status from the old checkbox: a done task is DONE,
-- everything else NOT_STARTED.
INSERT INTO "new_goal_tasks" ("completedAt", "dueDate", "goalId", "id", "isComplete", "sortOrder", "status", "title", "weight") SELECT "completedAt", "dueDate", "goalId", "id", "isComplete", "sortOrder", CASE WHEN "isComplete" THEN 'DONE' ELSE 'NOT_STARTED' END, "title", "weight" FROM "goal_tasks";
DROP TABLE "goal_tasks";
ALTER TABLE "new_goal_tasks" RENAME TO "goal_tasks";
CREATE INDEX "goal_tasks_goalId_idx" ON "goal_tasks"("goalId");
CREATE TABLE "new_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL DEFAULT 'GAIN',
    "targetValue" REAL NOT NULL DEFAULT 0,
    "currentValue" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goals_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "goal_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Backfill the measure so existing goals keep their current score: put the old
-- progress into currentValue against a target of 100, i.e. measure = progress.
INSERT INTO "new_goals" ("categoryId", "completedAt", "createdAt", "currentValue", "description", "id", "notes", "progress", "startDate", "status", "targetDate", "targetValue", "title", "updatedAt", "userId") SELECT "categoryId", "completedAt", "createdAt", "progress", "description", "id", "notes", "progress", "startDate", "status", "targetDate", 100, "title", "updatedAt", "userId" FROM "goals";
DROP TABLE "goals";
ALTER TABLE "new_goals" RENAME TO "goals";
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");
CREATE INDEX "goals_categoryId_idx" ON "goals"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
