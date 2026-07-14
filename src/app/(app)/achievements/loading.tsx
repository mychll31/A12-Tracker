import { Card, Skeleton } from "@/components/ui";

export default function AchievementsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />

      <Card className="mt-6 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Card key={i} className="flex gap-4 p-5">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
