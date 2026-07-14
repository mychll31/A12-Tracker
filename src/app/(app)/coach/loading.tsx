import { Card, CardContent, Skeleton } from "@/components/ui";

export default function CoachDashboardLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the coach dashboard"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-16" />
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
