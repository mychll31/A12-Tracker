import { Card, CardContent, Skeleton, SkeletonCard } from "@/components/ui";

export default function CoachNotesLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading coaching notes"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
