import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your check-in"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-7 w-16" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />

        <div className="mt-6 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-6 h-12 w-56 rounded-xl" />
      </Card>

      <Card className="p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-6 h-52 w-full rounded-xl" />
      </Card>
    </div>
  );
}
