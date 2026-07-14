import { Card, Skeleton } from "@/components/ui";

export default function LeaderboardsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />

      <Skeleton className="mt-6 h-10 w-full rounded-xl" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />

      <Card className="mt-4 divide-y divide-border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </Card>
    </div>
  );
}
