"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { SwipeFeed } from "@/components/feed/swipe-feed";
import { cn } from "@/lib/utils";

export function PersistentFeedShell({
  initialSavedIds,
  children,
}: {
  initialSavedIds: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed";

  const [feedEverOpened, setFeedEverOpened] = useState(() => isFeed);

  useEffect(() => {
    if (isFeed) {
      startTransition(() => setFeedEverOpened(true));
    }
  }, [isFeed]);

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
            detail="Vertical micro-lessons · swipe up"
            showFeedShortcut={false}
          />
          <SwipeFeed initialSavedIds={initialSavedIds} />
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          isFeed && "hidden",
        )}
        aria-hidden={isFeed}
      >
        {children}
      </div>
    </div>
  );
}
