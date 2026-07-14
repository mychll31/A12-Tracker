import { Card, CardContent, Skeleton } from "@/components/ui";

export default function MenteeDrilldownLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the mentee"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="size-24 shrink-0 rounded-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-xl" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent>
            <Skeleton className="h-[280px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
