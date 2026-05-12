"use client";

import { useState } from "react";

import type { SavedShortSnapshot } from "@/types/saved-short";
import { cn } from "@/lib/utils";

import { SavedLibrary } from "./saved-library";
import { SavedShortsLibrary } from "./saved-shorts-library";

type SavedTab = "cards" | "shorts";

export function SavedLibraryTabs({
  remoteIds,
  remoteShorts,
}: {
  remoteIds: string[];
  remoteShorts: SavedShortSnapshot[];
}) {
  const [tab, setTab] = useState<SavedTab>("cards");

  return (
    <>
      <div
        className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        role="tablist"
        aria-label="Saved library"
      >
        <div className="flex gap-1 rounded-[min(var(--radius-lg),14px)] border border-border bg-muted/50 p-1">
          <button
            type="button"
            role="tab"
            id="saved-tab-cards"
            aria-selected={tab === "cards"}
            aria-controls="saved-panel-cards"
            tabIndex={tab === "cards" ? 0 : -1}
            className={cn(
              "min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
              "min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              tab === "shorts"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("shorts")}
          >
            Shorts
          </button>
        </div>
      </div>

      <div
        id="saved-panel-cards"
        role="tabpanel"
        aria-labelledby="saved-tab-cards"
        hidden={tab !== "cards"}
      >
        <SavedLibrary remoteIds={remoteIds} />
      </div>

      <div
        id="saved-panel-shorts"
        role="tabpanel"
        aria-labelledby="saved-tab-shorts"
        hidden={tab !== "shorts"}
      >
        <SavedShortsLibrary
          key={remoteShorts.map((r) => r.videoId).join("|")}
          remoteShorts={remoteShorts}
        />
      </div>
    </>
  );
}
