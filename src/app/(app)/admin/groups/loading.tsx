import { Card, Skeleton } from "@/components/ui";

export default function AdminGroupsLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading coach groups"
      className="flex flex-col gap-6"
    >
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 sm:p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-32" />
            <div className="mt-5 flex gap-6">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-6 w-4/6" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-3/4" />
        <Skeleton className="mt-5 h-40 w-full rounded-card" />
      </Card>
    </div>
  );
}
