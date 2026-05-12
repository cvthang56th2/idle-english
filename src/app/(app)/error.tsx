"use client";

import { useEffect } from "react";

import { SHOW_STREAK_UI } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] text-center">
      <div className="space-y-2">
        <p className="text-lg font-semibold tracking-tight">This screen hit a snag</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message ||
            (SHOW_STREAK_UI
              ? "Try again — your streak and saves stay on this device."
              : "Try again — your saves stay on this device.")}
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        className="rounded-2xl"
        onClick={() => reset()}
      >
        Retry
      </Button>
    </main>
  );
}
