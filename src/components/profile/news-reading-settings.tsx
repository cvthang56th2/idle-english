"use client";

import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";

import { NEWS_SOURCES } from "@/lib/news-sources";
import {
  IDLE_NEWS_PREFS_CHANGED,
  readNewsPreferences,
  toggleNewsSourceInPrefs,
} from "@/lib/news-preferences-storage";
import { cn } from "@/lib/utils";

export function NewsReadingSettings() {
  const [enabledIds, setEnabledIds] = useState<string[]>(() =>
    readNewsPreferences().enabledIds,
  );

  useEffect(() => {
    function bump() {
      setEnabledIds([...readNewsPreferences().enabledIds]);
    }
    window.addEventListener(IDLE_NEWS_PREFS_CHANGED, bump);
    return () =>
      window.removeEventListener(IDLE_NEWS_PREFS_CHANGED, bump);
  }, []);

  const singleLeft =
    enabledIds.length === 1
      ? enabledIds[0]
      : undefined;

  return (
    <section className="rounded-[26px] border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Reading
      </p>
      <p className="mt-2 text-lg font-semibold leading-snug">News sources</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tick which RSS feeds appear in Feed → News. Articles open in your
        browser; saves sync when you use a cloud profile.
      </p>
      <ul className="mt-5 flex flex-col gap-4">
        {NEWS_SOURCES.map((src) => {
          const on = enabledIds.includes(src.id);
          return (
            <li key={src.id} className="flex gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={singleLeft === src.id}
                aria-labelledby={`news-src-caption-${src.id}`}
                onClick={() =>
                  startTransition(() => {
                    const nextWant = !on;
                    const ok = toggleNewsSourceInPrefs(src.id, nextWant);
                    if (!ok) {
                      toast.message("Keep at least one English source.");
                      return;
                    }
                    setEnabledIds([...readNewsPreferences().enabledIds]);
                  })
                }
                className={cn(
                  "relative mt-1 h-[22px] w-10 shrink-0 rounded-full bg-muted outline-none ring-offset-background transition-colors after:absolute after:top-[2px] after:left-[2px] after:size-[18px] after:rounded-full after:bg-background after:shadow-sm after:transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  on &&
                    "bg-primary text-primary after:translate-x-[18px]",
                  singleLeft === src.id && "opacity-60",
                )}
              />
              <div id={`news-src-caption-${src.id}`} className="min-w-0">
                <span className="block text-sm font-medium leading-snug">
                  {src.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {src.hint}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
