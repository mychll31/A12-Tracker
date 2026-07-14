import { Skeleton } from "@/components/ui";

export default function AdminUsersLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading users"
      className="flex flex-col gap-6"
    >
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3 sm:max-w-xl">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      <div className="overflow-hidden rounded-card border border-border">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-surface-raised p-4"
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
