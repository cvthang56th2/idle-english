import { Skeleton } from "@/components/ui/skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-3">
      <div className="flex h-full min-h-0 flex-col gap-4 rounded-[28px] border border-border/70 bg-card/40 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-3/4 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-3xl" />
        <div className="mt-auto flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-2xl" />
          <Skeleton className="h-11 flex-1 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
