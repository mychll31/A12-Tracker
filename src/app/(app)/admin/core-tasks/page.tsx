import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { listCoreTasks } from "@/server/admin";

import { CoreTasksClient, type CoreTaskView } from "./core-tasks-client";

export const metadata: Metadata = { title: "Core tasks" };

export default async function AdminCoreTasksPage() {
  const user = await requireAdmin();

  // The admin reader, not the one in @/server/core-tasks — that one hides
  // inactive tasks, and inactive rows are exactly what this screen manages.
  const tasks = await listCoreTasks(user, user.organizationId);

  const views: CoreTaskView[] = tasks.map((task) => ({
    id: task.id,
    key: task.key,
    name: task.name,
    description: task.description,
    icon: task.icon,
    points: task.points,
    sortOrder: task.sortOrder,
    isActive: task.isActive,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Core tasks</h1>
        <p className="mt-2 text-sm text-muted">
          The daily disciplines every member of the organization is measured
          against.
        </p>
      </header>

      <CoreTasksClient tasks={views} />
    </div>
  );
}
