"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

import { toggleSavedNews } from "@/app/actions/saved-news";
import type { SavedNewsSnapshot } from "@/types/saved-news";
import {
  removeSavedNewsSnapshot,
  syncSavedNewsFromRemote,
} from "@/lib/saved-news-storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SavedNewsLibrary({
  remoteRows,
}: {
  remoteRows: SavedNewsSnapshot[];
}) {
  const [entries, setEntries] = useState(() =>
    syncSavedNewsFromRemote(remoteRows),
  );

  const countLabel = useMemo(() => {
    if (!entries.length) return "No articles saved yet";
    return `${entries.length} saved article${entries.length === 1 ? "" : "s"}`;
  }, [entries.length]);

  async function handleRemove(row: SavedNewsSnapshot) {
    removeSavedNewsSnapshot(row.articleUrl);
    setEntries((prev) =>
      [...prev.filter((e) => e.articleUrl !== row.articleUrl)].sort(
        (a, b) => b.savedAt - a.savedAt,
      ),
    );
    const result = await toggleSavedNews(
      {
        articleUrl: row.articleUrl,
        title: row.title,
        sourceId: row.sourceId,
        sourceLabel: row.sourceLabel,
        publishedAt: row.publishedAt,
      },
      false,
    );
    if (!result.ok) {
      toast.message("Removed locally — sync resumes when you're online.");
    }
  }

  return (
    <>
      <p className="px-4 pb-2 text-sm text-muted-foreground">{countLabel}</p>
      {entries.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
          <p className="font-medium">Nothing in your reading stash</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Save pieces from Feed → News. Everything stays here on-device and
            syncs when signed in with Supabase configured.
          </p>
          <Link
            href="/feed"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 rounded-xl px-4 py-2 text-sm font-medium",
            )}
          >
            Open Feed · News tab
          </Link>
        </div>
      ) : (
        <ScrollArea className="px-4">
          <ul className="flex flex-col gap-3 pb-6 pt-1">
            {entries.map((e) => (
              <li key={e.articleUrl}>
                <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/50 p-3 shadow-sm backdrop-blur-sm">
                  <div>
                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                      {e.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                      {e.sourceLabel}
                      {e.publishedAt ? (
                        <>
                          <span className="mx-1 opacity-60" aria-hidden>
                            ·
                          </span>
                          {new Date(e.publishedAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={e.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-8 rounded-lg px-2 text-xs",
                      )}
                    >
                      <ExternalLink className="mr-1 size-3.5" aria-hidden />
                      Open
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                      onClick={() => void handleRemove(e)}
                    >
                      Remove
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </>
  );
}
