import { Card, Skeleton } from "@/components/ui";

export default function AnalyticsLoading() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-56 rounded-xl" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-[260px] w-full rounded-xl" />
        </Card>

        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-[220px] w-full rounded-xl" />
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
