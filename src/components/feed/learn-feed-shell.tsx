"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { NewsFeedPanel } from "./news-feed-panel";
import { SwipeFeed } from "./swipe-feed";

type LearnTab = "cards" | "news";

export function LearnFeedShell({
  initialSavedIds,
}: {
  initialSavedIds: string[];
}) {
  const [tab, setTab] = useState<LearnTab>("news");
  /** Remount swipe feed when returning from News so Cards opens with a freshly fetched deck. */
  const [cardsFeedKey, setCardsFeedKey] = useState(0);

  const selectTab = (next: LearnTab) => {
    if (next === "cards" && tab === "news") {
      setCardsFeedKey((k) => k + 1);
    }
    setTab(next);
  };

  return (
    <>
      <div
        className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        role="tablist"
        aria-label="Learn feed mode"
      >
        <div className="flex gap-1 rounded-[min(var(--radius-lg),14px)] border border-border bg-muted/50 p-1">
          <button
            type="button"
            role="tab"
            id="learn-tab-news"
            aria-selected={tab === "news"}
            aria-controls="learn-panel-news"
            tabIndex={tab === "news" ? 0 : -1}
            className={cn(
              "min-h-9 flex-1 rounded-md px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              tab === "news"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => selectTab("news")}
          >
            News
          </button>
          <button
            type="button"
            role="tab"
            id="learn-tab-cards"
            aria-selected={tab === "cards"}
            aria-controls="learn-panel-cards"
            tabIndex={tab === "cards" ? 0 : -1}
            className={cn(
              "min-h-9 flex-1 rounded-md px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              tab === "cards"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => selectTab("cards")}
          >
            Cards
          </button>
        </div>
      </div>

      <div
        id="learn-panel-news"
        role="tabpanel"
        aria-labelledby="learn-tab-news"
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          tab !== "news" && "hidden",
        )}
      >
        <NewsFeedPanel />
      </div>

      <div
        id="learn-panel-cards"
        role="tabpanel"
        aria-labelledby="learn-tab-cards"
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          tab !== "cards" && "hidden",
        )}
      >
        <SwipeFeed
          key={cardsFeedKey}
          initialSavedIds={initialSavedIds}
        />
      </div>
    </>
  );
}
