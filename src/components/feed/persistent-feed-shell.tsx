"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { LearnFeedShell } from "@/components/feed/learn-feed-shell";
import { ShortsFeed } from "@/components/shorts/shorts-feed";
import { cn } from "@/lib/utils";
import type { SavedShortSnapshot } from "@/types/saved-short";

export function PersistentFeedShell({
  initialSavedIds,
  initialRemoteSavedShorts,
  children,
}: {
  initialSavedIds: string[];
  initialRemoteSavedShorts: SavedShortSnapshot[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed";
  const isShorts = pathname === "/shorts";

  const [feedEverOpened, setFeedEverOpened] = useState(() => isFeed);
  const [shortsEverOpened, setShortsEverOpened] = useState(() => isShorts);

  useEffect(() => {
    if (isFeed) {
      startTransition(() => setFeedEverOpened(true));
    }
  }, [isFeed]);

  useEffect(() => {
    if (isShorts) {
      startTransition(() => setShortsEverOpened(true));
    }
  }, [isShorts]);

  const hideRouteChildren = isFeed || isShorts;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {feedEverOpened ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            !isFeed && "hidden",
          )}
          aria-hidden={!isFeed}
        >
          <AppHeader
            singleLine
            eyebrow="IdleEnglish"
            title="Learn in the gaps"
            detail="Cards swipe up · News reads from English sources"
            showFeedShortcut={false}
          />
          <LearnFeedShell initialSavedIds={initialSavedIds} />
        </div>
      ) : null}

      {shortsEverOpened ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            !isShorts && "hidden",
          )}
          aria-hidden={!isShorts}
        >
          <AppHeader
            singleLine
            eyebrow="IdleEnglish"
            title="English Shorts"
            showFeedShortcut
          />
          <ShortsFeed
            initialRemoteSavedShorts={initialRemoteSavedShorts}
            playbackActive={isShorts}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          hideRouteChildren && "hidden",
        )}
        aria-hidden={hideRouteChildren}
      >
        {children}
      </div>
    </div>
  );
}
