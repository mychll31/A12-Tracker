import { Card, Skeleton } from "@/components/ui";

export default function NotesLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />

      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-6 w-36 rounded-full" />
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3 w-40" />
            </div>

            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
