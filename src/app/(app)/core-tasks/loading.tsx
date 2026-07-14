import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoreTasksLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your core tasks"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-7 w-16" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-64 rounded-xl" />
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[3.75rem] rounded-xl" />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-6 h-56 w-full rounded-xl" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-4 w-44" />
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
