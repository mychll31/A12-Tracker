import { Card, Skeleton } from "@/components/ui";

export default function NotificationsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <div className="mt-6 flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="mt-4 space-y-6">
        {Array.from({ length: 2 }, (_, group) => (
          <section key={group}>
            <Skeleton className="mb-2 h-3 w-20" />
            <Card className="divide-y divide-border">
              {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="flex items-start gap-3 px-4 py-3.5">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
