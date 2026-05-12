"use client";

import { useState } from "react";

import type { SavedShortSnapshot } from "@/types/saved-short";
import type { SavedNewsSnapshot } from "@/types/saved-news";
import { cn } from "@/lib/utils";

import { SavedLibrary } from "./saved-library";
import { SavedShortsLibrary } from "./saved-shorts-library";
import { SavedNewsLibrary } from "./saved-news-library";

type SavedTab = "cards" | "shorts" | "news";

export function SavedLibraryTabs({
  remoteIds,
  remoteShorts,
  remoteNews,
}: {
  remoteIds: string[];
  remoteShorts: SavedShortSnapshot[];
  remoteNews: SavedNewsSnapshot[];
}) {
  const [tab, setTab] = useState<SavedTab>("cards");

  return (
    <>
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        role="tablist"
        aria-label="Saved library"
      >
        <div className="flex gap-0.5 rounded-[min(var(--radius-lg),14px)] border border-border bg-muted/50 p-1">
          <button
            type="button"
            role="tab"
            id="saved-tab-cards"
            aria-selected={tab === "cards"}
            aria-controls="saved-panel-cards"
            tabIndex={tab === "cards" ? 0 : -1}
            className={cn(
              "min-h-9 min-w-0 flex-1 rounded-md px-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2 sm:text-sm",
              tab === "cards"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("cards")}
          >
            Cards
          </button>
          <button
            type="button"
            role="tab"
            id="saved-tab-shorts"
            aria-selected={tab === "shorts"}
            aria-controls="saved-panel-shorts"
            tabIndex={tab === "shorts" ? 0 : -1}
            className={cn(
              "min-h-9 min-w-0 flex-1 rounded-md px-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2 sm:text-sm",
              tab === "shorts"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("shorts")}
          >
            Shorts
          </button>
          <button
            type="button"
            role="tab"
            id="saved-tab-news"
            aria-selected={tab === "news"}
            aria-controls="saved-panel-news"
            tabIndex={tab === "news" ? 0 : -1}
            className={cn(
              "min-h-9 min-w-0 flex-1 rounded-md px-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2 sm:text-sm",
              tab === "news"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("news")}
          >
            News
          </button>
        </div>
      </div>

      <div
        id="saved-panel-cards"
        role="tabpanel"
        aria-labelledby="saved-tab-cards"
        className={cn(tab !== "cards" && "hidden")}
      >
        <SavedLibrary remoteIds={remoteIds} />
      </div>

      <div
        id="saved-panel-shorts"
        role="tabpanel"
        aria-labelledby="saved-tab-shorts"
        className={cn(tab !== "shorts" && "hidden")}
      >
        <SavedShortsLibrary
          key={remoteShorts.map((r) => r.videoId).join("|")}
          remoteShorts={remoteShorts}
        />
      </div>

      <div
        id="saved-panel-news"
        role="tabpanel"
        aria-labelledby="saved-tab-news"
        className={cn(tab !== "news" && "hidden")}
      >
        <SavedNewsLibrary
          key={remoteNews.map((r) => r.articleUrl).join("|")}
          remoteRows={remoteNews}
        />
      </div>
    </>
  );
}
