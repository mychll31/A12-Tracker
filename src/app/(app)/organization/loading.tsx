import { Card, CardContent, Skeleton } from "@/components/ui";

export default function OrganizationLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the organization dashboard"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <Skeleton className="size-36 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-16" />
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-[240px] w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
