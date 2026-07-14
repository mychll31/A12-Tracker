import { Skeleton } from "@/components/ui";

export default function AdminCoreTasksLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading core tasks"
      className="flex flex-col gap-6"
    >
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-10 w-36 shrink-0 rounded-xl" />
      </div>

      <div className="overflow-hidden rounded-card border border-border">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 bg-surface-raised p-4"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
