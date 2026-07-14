import { Card, Skeleton } from "@/components/ui";

export default function ProfileLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Skeleton className="size-14 shrink-0 rounded-full" />

          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>

          <Skeleton className="size-28 shrink-0 rounded-full" />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, card) => (
          <Card key={card} className="p-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-56" />

            <div className="mt-6 space-y-5">
              {Array.from({ length: 3 }, (_, field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
