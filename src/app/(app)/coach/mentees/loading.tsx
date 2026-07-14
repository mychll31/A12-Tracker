import { Skeleton, SkeletonCard } from "@/components/ui";

export default function MenteesLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading mentees"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
