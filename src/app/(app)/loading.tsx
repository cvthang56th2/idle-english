import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="space-y-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 max-w-56 rounded-lg" />
        <Skeleton className="h-4 max-w-full rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8">
        <Skeleton
          className="min-h-[min(520px,calc(100dvh-8rem))] w-full flex-1 rounded-[28px]"
          aria-hidden
        />
        <Skeleton className="h-12 w-full rounded-2xl" aria-hidden />
      </div>
    </main>
  );
}
