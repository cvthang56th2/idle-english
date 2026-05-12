"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { Bookmark, ExternalLink, Loader2, Newspaper, RotateCw } from "lucide-react";
import { toast } from "sonner";

import type { SavedNewsSnapshot } from "@/types/saved-news";
import { toggleSavedNews } from "@/app/actions/saved-news";
import type { ParsedFeedItem } from "@/lib/rss-parse";
import {
  IDLE_NEWS_PREFS_CHANGED,
  readNewsPreferences,
} from "@/lib/news-preferences-storage";
import {
  readSavedNewsSnapshots,
  IDLE_SAVED_NEWS_CHANGED,
  removeSavedNewsSnapshot,
  upsertSavedNewsSnapshot,
  type IdleSavedNewsChangedDetail,
} from "@/lib/saved-news-storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type FeedNewsArticle = ParsedFeedItem & {
  sourceId: string;
  sourceLabel: string;
  publishedAt: number | null;
};

export function NewsFeedPanel() {
  const [prefs, setPrefs] = useState(() => readNewsPreferences());
  const sourceQuery =
    prefs.enabledIds.length > 0
      ? `?sources=${encodeURIComponent(prefs.enabledIds.join(","))}`
      : "";

  const [items, setItems] = useState<FeedNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [failHints, setFailHints] = useState<string | null>(null);
  const [, startFetch] = useTransition();

  useEffect(() => {
    function onPrefs() {
      setPrefs(readNewsPreferences());
    }
    window.addEventListener(IDLE_NEWS_PREFS_CHANGED, onPrefs);
    return () => window.removeEventListener(IDLE_NEWS_PREFS_CHANGED, onPrefs);
  }, []);

  const [savedUrls, setSavedUrls] = useState(() =>
    new Set(
      readSavedNewsSnapshots()
        .map((s) => canonArticleUrlSafe(s.articleUrl))
        .filter((u): u is string => Boolean(u)),
    ),
  );

  useEffect(() => {
    function handler(e: Event) {
      const d = (e as CustomEvent<IdleSavedNewsChangedDetail>).detail;
      if (!d) return;
      setSavedUrls((prev) => {
        const n = new Set(prev);
        if (d.removedUrl) {
          const c = canonArticleUrlSafe(d.removedUrl);
          if (c) n.delete(c);
        }
        if (d.addedUrl) {
          const c = canonArticleUrlSafe(d.addedUrl);
          if (c) n.add(c);
        }
        return n;
      });
    }
    window.addEventListener(IDLE_SAVED_NEWS_CHANGED, handler);
    return () => window.removeEventListener(IDLE_SAVED_NEWS_CHANGED, handler);
  }, []);

  const loadNews = useCallback(() => {
    startFetch(async () => {
      setLoading(true);
      setFailHints(null);
      try {
        const res = await fetch(`/api/news${sourceQuery}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(22_000),
        });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as {
          items: FeedNewsArticle[];
          failures?: Record<string, string>;
        };
        setItems(data.items ?? []);
        if (data.failures && Object.keys(data.failures).length > 0) {
          const n = Object.keys(data.failures).length;
          setFailHints(
            n === 1
              ? "One source timed out."
              : `${n} sources could not refresh.`,
          );
        }
      } catch {
        setItems([]);
        toast.error("Could not load reading list.");
      } finally {
        setLoading(false);
      }
    });
  }, [sourceQuery]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const handleToggleSaved = useCallback((article: FeedNewsArticle) => {
    const canon = canonArticleUrlSafe(article.link);
    if (!canon) return;
    const snapshot: Omit<SavedNewsSnapshot, "savedAt"> = {
      articleUrl: canon,
      title: article.title,
      sourceId: article.sourceId,
      sourceLabel: article.sourceLabel,
      publishedAt: article.publishedAt,
    };

    const next = !savedUrls.has(canon);
    setSavedUrls((prev) => {
      const n = new Set(prev);
      if (next) n.add(canon);
      else n.delete(canon);
      return n;
    });

    startTransition(async () => {
      if (next) {
        upsertSavedNewsSnapshot(snapshot);
      } else {
        removeSavedNewsSnapshot(canon);
      }

      const result = await toggleSavedNews(snapshot, next);
      if (!result.ok) {
        toast.error("Could not sync save.");
        setSavedUrls((prev) => {
          const nu = new Set(prev);
          if (next) nu.delete(canon);
          else nu.add(canon);
          return nu;
        });
        if (next) {
          removeSavedNewsSnapshot(canon);
        } else {
          upsertSavedNewsSnapshot(snapshot);
        }
      }
    });
  }, [savedUrls]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Newspaper className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            Sources in Profile · open to read · save for offline list
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs"
          disabled={loading}
          onClick={() => loadNews()}
        >
          <RotateCw
            className={cn("size-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {failHints ? (
        <p className="shrink-0 px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400">
          {failHints} Try again shortly.
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-24 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" aria-hidden />
          <span className="text-sm">Loading articles…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-4 mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
          <p className="font-medium">No stories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable sources under Profile → News reading, then tap Refresh above.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 rounded-xl"
            onClick={() => loadNews()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-2 px-3 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-3">
            {items.map((a) => {
              const canon = canonArticleUrlSafe(a.link);
              const saved = canon ? savedUrls.has(canon) : false;
              const dateLabel =
                a.publishedAt != null && Number.isFinite(a.publishedAt)
                  ? new Date(a.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;

              return (
                <li key={`${a.sourceId}:${a.link}`}>
                  <article className="flex gap-2 rounded-2xl border border-border/70 bg-card/50 p-3 shadow-sm backdrop-blur-sm">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">
                        {a.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        {a.sourceLabel}
                        {dateLabel ? (
                          <>
                            <span aria-hidden className="mx-1 opacity-60">
                              ·
                            </span>
                            {dateLabel}
                          </>
                        ) : null}
                      </p>
                      {a.summary ? (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {a.summary}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-8 rounded-lg px-2 text-xs",
                          )}
                        >
                          <ExternalLink className="mr-1 size-3.5" />
                          Read
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-pressed={saved}
                      aria-label={
                        saved ? "Saved — tap to unsave article" : "Save article"
                      }
                      onClick={() => handleToggleSaved(a)}
                      className={cn(
                        "mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground transition-colors",
                        saved &&
                          "border-primary bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(34,197,94,0.25)]",
                      )}
                    >
                      <Bookmark className={cn("size-5", saved && "fill-current")} />
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function canonArticleUrlSafe(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}
