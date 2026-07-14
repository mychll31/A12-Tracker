import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your dashboard"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-6 lg:w-64">
          <Skeleton className="size-36 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-20" />
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-6 flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[3.75rem] rounded-xl" />
            ))}
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-44" />
          <Skeleton className="mt-2 h-10 w-40 rounded-xl" />
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-2 w-full rounded-full" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
      </Card>
    </div>
  );
}
