"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import Link from "next/link";

import type { LessonCard } from "@/types/card";
import { toggleSaved } from "@/app/actions/saved";
import {
  readSavedEntries,
  removeSavedEntry,
  writeSavedEntries,
  type SavedEntry,
} from "@/lib/saved-storage";
import {
  LessonCardBody,
  LessonCardHeader,
} from "@/components/feed/lesson-card-content";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function mergeById(entries: SavedEntry[]): SavedEntry[] {
  const map = new Map<string, SavedEntry>();
  for (const e of entries) {
    const existing = map.get(e.id);
    if (!existing || e.savedAt > existing.savedAt) {
      map.set(e.id, e);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

export function SavedLibrary({ remoteIds }: { remoteIds: string[] }) {
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const local = readSavedEntries();
      const missing = remoteIds.filter(
        (id) => !local.some((entry) => entry.id === id),
      );

      if (!missing.length) {
        if (!cancelled) {
          setEntries(mergeById(local));
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/cards/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: missing }),
        });
        const data = (await res.json()) as { items?: LessonCard[] };
        const remoteEntries: SavedEntry[] =
          data.items?.map((card) => ({
            id: card.id,
            card,
            savedAt: Date.now(),
          })) ?? [];

        const merged = mergeById([...local, ...remoteEntries]);
        writeSavedEntries(merged);
        if (!cancelled) setEntries(merged);
      } catch {
        if (!cancelled) {
          setEntries(mergeById(local));
          toast.error("Could not sync cloud saves — showing local library.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [remoteIds]);

  const countLabel = useMemo(() => {
    if (!entries.length) return "Nothing saved yet";
    return `${entries.length} saved lesson${entries.length === 1 ? "" : "s"}`;
  }, [entries.length]);

  async function handleRemove(card: LessonCard) {
    removeSavedEntry(card.id);
    setEntries((prev) => prev.filter((e) => e.id !== card.id));
    const result = await toggleSaved(card.id, false);
    if (!result.ok) {
      toast.message("Removed locally — sync when you’re back online.");
    }
  }

  return (
    <>
      {!loading ? (
        <p className="px-4 pb-3 text-sm text-muted-foreground">{countLabel}</p>
      ) : null}
      {loading ? (
        <div className="space-y-4 px-4">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mx-4 mt-2 rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
          <p className="text-lg font-medium">Save lessons from the feed</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap the bookmark on any card — we optimistically stash it here.
          </p>
          <Link
            href="/feed"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-6 inline-flex rounded-2xl",
            )}
          >
            Jump to feed
          </Link>
        </div>
      ) : (
        <ScrollArea className="px-4">
          <div className="flex flex-col gap-4 pb-8 pt-1">
            {entries.map((entry) => (
              <SavedCard
                key={entry.id}
                entry={entry}
                onRemove={() => handleRemove(entry.card)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  );
}

function SavedCard({
  entry,
  onRemove,
}: {
  entry: SavedEntry;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-[24px] border border-border/70 bg-card/60 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <LessonCardHeader card={entry.card} />
      <div className="mt-3 max-h-[280px] overflow-hidden">
        <LessonCardBody card={entry.card} />
      </div>
      <div className="mt-4 flex justify-end border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </article>
  );
}
