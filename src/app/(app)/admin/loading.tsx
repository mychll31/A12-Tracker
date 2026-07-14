import { Card, Skeleton } from "@/components/ui";

export default function AdminOverviewLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading administration"
      className="flex flex-col gap-8"
    >
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-14" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="mt-4 h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-2/3" />
          </Card>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-3/4" />
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </Card>
    </div>
  );
}
