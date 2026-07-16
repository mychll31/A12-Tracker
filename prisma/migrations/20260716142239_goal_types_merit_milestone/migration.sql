-- CreateTable
CREATE TABLE "merit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merit_logs_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "goalType" TEXT NOT NULL DEFAULT 'MERIT',
    "targetPeriod" TEXT NOT NULL DEFAULT 'NONE',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "goals_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "goal_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Existing goals are numeric measures, so they become MERIT (the column default).
-- Per the product decision, they also get a DAILY period so a per-period target
-- appears in Core Tasks straight away, filling the gap from their current value.
INSERT INTO "new_goals" ("categoryId", "completedAt", "createdAt", "currentValue", "description", "direction", "id", "notes", "progress", "startDate", "status", "targetDate", "targetValue", "title", "unit", "updatedAt", "userId", "targetPeriod") SELECT "categoryId", "completedAt", "createdAt", "currentValue", "description", "direction", "id", "notes", "progress", "startDate", "status", "targetDate", "targetValue", "title", "unit", "updatedAt", "userId", 'DAILY' FROM "goals";
DROP TABLE "goals";
ALTER TABLE "new_goals" RENAME TO "goals";
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");
CREATE INDEX "goals_categoryId_idx" ON "goals"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "merit_logs_userId_date_idx" ON "merit_logs"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "merit_logs_goalId_date_key" ON "merit_logs"("goalId", "date");
