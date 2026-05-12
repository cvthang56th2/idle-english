"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedShort } from "@/app/actions/saved";
import {
  removeSavedShortEntry,
  syncSavedShortsFromRemote,
  type SavedShortEntry,
} from "@/lib/saved-shorts-storage";
import type { SavedShortSnapshot } from "@/types/saved-short";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function mergeByVideoId(entries: SavedShortEntry[]): SavedShortEntry[] {
  const map = new Map<string, SavedShortEntry>();
  for (const e of entries) {
    const existing = map.get(e.videoId);
    if (!existing || e.savedAt > existing.savedAt) map.set(e.videoId, e);
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

export function SavedShortsLibrary({
  remoteShorts,
}: {
  remoteShorts: SavedShortSnapshot[];
}) {
  const [entries, setEntries] = useState(() =>
    syncSavedShortsFromRemote(remoteShorts),
  );

  const countLabel = useMemo(() => {
    if (!entries.length) return "No shorts saved yet";
    return `${entries.length} saved short${entries.length === 1 ? "" : "s"}`;
  }, [entries.length]);

  async function handleRemove(entry: SavedShortEntry) {
    removeSavedShortEntry(entry.videoId);
    setEntries((prev) =>
      mergeByVideoId(prev.filter((e) => e.videoId !== entry.videoId)),
    );
    const result = await toggleSavedShort(
      {
        videoId: entry.videoId,
        title: entry.title,
        channelTitle: entry.channelTitle,
        thumbnailUrl: entry.thumbnailUrl,
      },
      false,
    );
    if (!result.ok) {
      toast.message("Removed locally — sync when you’re back online.");
    }
  }

  return (
    <>
      <p className="px-4 pb-2 text-sm text-muted-foreground">{countLabel}</p>
      {entries.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
          <p className="font-medium">Save clips from Shorts</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tap the bookmark on any video while you scroll — it stays on this device,
            and syncs to your account when signed in.
          </p>
          <Link
            href="/shorts"
            className={cn(
              "mt-4 inline-flex rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary",
            )}
          >
            Open Shorts
          </Link>
        </div>
      ) : (
        <ScrollArea className="px-4">
          <ul className="flex flex-col gap-3 pb-6 pt-1">
            {entries.map((entry) => (
              <li key={entry.videoId}>
                <SavedShortRow entry={entry} onRemove={() => handleRemove(entry)} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </>
  );
}

function SavedShortRow({
  entry,
  onRemove,
}: {
  entry: SavedShortEntry;
  onRemove: () => void;
}) {
  const thumb =
    entry.thumbnailUrl ||
    `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${entry.videoId}`;

  return (
    <article className="flex gap-3 rounded-2xl border border-border/70 bg-card/50 p-3 shadow-sm backdrop-blur-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
      <img
        src={thumb}
        alt=""
        className="size-[4.5rem] shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{entry.title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{entry.channelTitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={watchUrl}
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 rounded-lg px-2 text-xs",
            )}
          >
            <ExternalLink className="mr-1 size-3.5" aria-hidden />
            Watch
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </article>
  );
}
