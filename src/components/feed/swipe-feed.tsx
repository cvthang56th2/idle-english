"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Layers, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { LessonCard } from "@/types/card";
import { readGenerateSessionPrefs } from "@/lib/generate-session-prefs";
import { pingLearnSession } from "@/app/actions/progress";
import {
  bumpLocalProgress,
  persistRecentCards,
  readRecentCards,
} from "@/lib/offline-cache";
import {
  IDLE_SAVED_ENTRIES_CHANGED,
  type IdleSavedEntriesChangedDetail,
} from "@/lib/saved-storage";
import { LessonSlide } from "@/components/feed/lesson-slide";
import { GenerateSessionSheet } from "@/components/feed/generate-session-sheet";
import { FeedSkeleton } from "@/components/feed/feed-skeleton";
import { LessonCardHeader } from "@/components/feed/lesson-card-content";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SHOW_STREAK_UI } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type FeedResponse = {
  items: LessonCard[];
  nextOffset: number;
};

type FeedGenResponse = {
  items?: LessonCard[];
  error?: string;
};

export function SwipeFeed({
  initialSavedIds,
}: {
  initialSavedIds: string[];
}) {
  const [savedIds, setSavedIds] = useState(
    () => new Set(initialSavedIds),
  );
  const [cards, setCards] = useState<LessonCard[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainTarget, setExplainTarget] = useState<LessonCard | null>(null);
  const [explainText, setExplainText] = useState<string>("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rewardedRef = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<IdleSavedEntriesChangedDetail>).detail;
      if (!detail) return;
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (detail.removedId) next.delete(detail.removedId);
        if (detail.addedId) next.add(detail.addedId);
        return next;
      });
    };
    window.addEventListener(IDLE_SAVED_ENTRIES_CHANGED, handler);
    return () =>
      window.removeEventListener(IDLE_SAVED_ENTRIES_CHANGED, handler);
  }, []);

  const applyOfflineFallback = useCallback(() => {
    const cached = readRecentCards();
    if (cached?.length) {
      setCards((prev) => (prev.length ? prev : cached));
      toast.message("You’re offline — replaying cached lessons.");
    } else {
      toast.error("Could not load lessons. Check your connection.");
    }
  }, []);

  const fetchCuratedAppend = useCallback(async (nextOffset: number) => {
    const res = await fetch(`/api/cards?offset=${nextOffset}&limit=8`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error("bad response");
    const data = (await res.json()) as FeedResponse;
    setCards((prev) => [...prev, ...data.items]);
    setOffset(data.nextOffset);
  }, []);

  const fetchPage = useCallback(async (nextOffset: number) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    try {
      await fetchCuratedAppend(nextOffset);
    } catch {
      applyOfflineFallback();
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, [applyOfflineFallback, fetchCuratedAppend]);

  const tryAppendAiBatch = useCallback(async (): Promise<boolean> => {
    try {
      const prefs = readGenerateSessionPrefs();
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds: prefs.categoryIds,
          level: prefs.level,
          count: 8,
          notes: prefs.notes.trim() || undefined,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json()) as FeedGenResponse;
      const batch = data.items;
      if (res.ok && batch?.length) {
        const currentScrollTop = containerRef.current?.scrollTop;
        setCards((prev) => [...prev, ...batch]);
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({ top: currentScrollTop });
          }
        }, 100);
        return true;
      }
    } catch {
      /* fall through to curated */
    }
    return false;
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    try {
      const aiOk = await tryAppendAiBatch();
      if (!aiOk) {
        await fetchCuratedAppend(offsetRef.current);
      }
    } catch {
      applyOfflineFallback();
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, [applyOfflineFallback, fetchCuratedAppend, tryAppendAiBatch]);

  const showInitialSkeleton = initialLoading && cards.length === 0;

  const loadInitialDeck = useCallback(async () => {
    setLoading(true);
    let aiLoaded = false;
    try {
      const prefs = readGenerateSessionPrefs();
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds: prefs.categoryIds,
          level: prefs.level,
          count: 8,
          notes: prefs.notes.trim() || undefined,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json()) as FeedGenResponse;
      if (res.ok && data.items?.length) {
        setCards(data.items);
        setOffset(0);
        aiLoaded = true;
      }
    } catch {
      /* fall through to curated feed */
    }
    if (!aiLoaded) {
      await fetchPage(0);
    } else {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    startTransition(() => {
      void loadInitialDeck();
    });
  }, [loadInitialDeck]);

  useEffect(() => {
    persistRecentCards(cards);
  }, [cards]);

  useEffect(() => {
    if (showInitialSkeleton) return;
    const root = containerRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (loadingMoreRef.current) return;
        if (Date.now() < cooldownUntilRef.current) return;
        cooldownUntilRef.current = Date.now() + 1100;
        void loadMore();
      },
      { root, threshold: 0.15 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, showInitialSkeleton]);

  const openExplainSheet = useCallback((card: LessonCard) => {
    setExplainTarget(card);
    setExplainText("");
    setExplainLoading(false);
    setExplainOpen(true);
  }, []);

  const runExplain = useCallback(async () => {
    const card = explainTarget;
    if (!card) return;
    setExplainLoading(true);
    setExplainText("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      const payload = (await res.json()) as { text?: string };
      setExplainText(payload.text ?? "Here is a quick recap.");
    } catch {
      setExplainText("We couldn’t reach the AI coach — try again shortly.");
    } finally {
      setExplainLoading(false);
    }
  }, [explainTarget]);

  const handleExplainOpenChange = useCallback((open: boolean) => {
    setExplainOpen(open);
    if (!open) {
      setExplainTarget(null);
      setExplainText("");
      setExplainLoading(false);
    }
  }, []);

  const rewardProgress = useCallback((cardId: string) => {
    if (rewardedRef.current.has(cardId)) return;
    rewardedRef.current.add(cardId);
    void pingLearnSession().then((res) => {
      if (!res.ok || res.persisted !== "remote") {
        bumpLocalProgress();
      }
    });
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.72) {
            const id = entry.target.getAttribute("data-card-id");
            if (id) rewardProgress(id);
          }
        });
      },
      { root, threshold: [0.72] },
    );

    const slides = root.querySelectorAll("[data-feed-slide]");
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [cards, rewardProgress]);

  const updateSaved = useCallback((cardId: string, next: boolean) => {
    setSavedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(cardId);
      else copy.delete(cardId);
      return copy;
    });
  }, []);

  const prependGenerated = useCallback((incoming: LessonCard[]) => {
    if (!incoming.length) return;
    setCards((prev) => [...incoming, ...prev]);
    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="pointer-events-auto fixed bottom-[calc(4.85rem+env(safe-area-inset-bottom))] left-4 z-40 rounded-full px-4 py-2 shadow-lg shadow-black/25 sm:gap-2"
        onClick={() => setGenerateOpen(true)}
        aria-expanded={generateOpen}
        aria-label="Build custom card session"
      >
        <Layers className="size-4 shrink-0" aria-hidden />
        <span className="max-sm:hidden">Custom session</span>
      </Button>

      <GenerateSessionSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={prependGenerated}
      />

      {showInitialSkeleton ? (
        <FeedSkeleton />
      ) : (
        <>
          <div
            ref={containerRef}
            className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
            style={{
              scrollSnapStop: "always",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {cards.map((card, index) => (
              <section
                key={`${card.id}-${index}`}
                data-feed-slide
                data-card-id={`${card.id}-${index}`}
                className="box-border flex h-full shrink-0 snap-start snap-always flex-col px-3 pt-3"
              >
                <LessonSlide
                  card={card}
                  saved={savedIds.has(card.id)}
                  onToggleSave={(next) => updateSaved(card.id, next)}
                  onExplain={openExplainSheet}
                />
              </section>
            ))}
            <div
              ref={sentinelRef}
              className="shrink-0 snap-start px-3 pt-3"
              style={{ minHeight: "40vh" }}
            >
              <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {loading ? (
                  <>
                    <Skeleton className="mx-auto h-4 w-40 rounded-full" />
                    <Skeleton className="mx-auto h-4 w-56 rounded-full" />
                  </>
                ) : (
                  <p>
                    Keep swiping — we&apos;ll generate more cards, or fall back
                    to the curated deck if needed.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Sheet open={explainOpen} onOpenChange={handleExplainOpenChange}>
            <SheetContent
              side="bottom"
              className="flex h-[min(88dvh,640px)] flex-col gap-0 overflow-hidden rounded-t-3xl border-border/80 px-0 pb-0 pt-0"
            >
              <div className="flex flex-1 flex-col gap-0 px-6 pb-4 pt-3">
                <div
                  className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
                  aria-hidden
                />

                <SheetHeader className="shrink-0 space-y-4 p-0 text-left">
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                        "bg-primary/12 ring-1 ring-primary/20",
                      )}
                      aria-hidden
                    >
                      <Sparkles className="size-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        AI coach
                      </p>
                      <SheetTitle className="text-balance text-xl font-semibold leading-snug sm:text-2xl">
                        {explainTarget?.title ?? "Break it down"}
                      </SheetTitle>
                      <SheetDescription className="text-base leading-relaxed">
                        {explainText
                          ? explainText.includes("try again shortly")
                            ? "We couldn’t load this one — you can retry below."
                            : "Here’s what stood out for this lesson."
                          : "Plain-English help for this card. Nothing runs until you tap explain."}
                      </SheetDescription>
                    </div>
                  </div>

                  {explainTarget ? (
                    <div
                      className={cn(
                        "rounded-2xl border border-border/80 bg-linear-to-b from-card/70 to-muted/25",
                        "p-4 shadow-inner shadow-black/5",
                      )}
                    >
                      <LessonCardHeader card={explainTarget} className="px-0" />
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {explainTarget.example}
                      </p>
                    </div>
                  ) : null}
                </SheetHeader>

                <ScrollArea
                  className={cn(
                    "mt-1 min-h-0 flex-1",
                    !(explainText || explainLoading) && "max-h-[min(32dvh,220px)]",
                  )}
                >
                  <div className="pr-3 pt-2">
                    {explainLoading ? (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Loader2
                            className="size-4 shrink-0 animate-spin text-primary"
                            aria-hidden
                          />
                          <span>Coaching you up…</span>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                          <Skeleton className="h-3.5 w-full rounded-full" />
                          <Skeleton className="h-3.5 w-[94%] rounded-full" />
                          <Skeleton className="h-3.5 w-[78%] rounded-full" />
                          <Skeleton className="h-3.5 w-[88%] rounded-full" />
                        </div>
                      </div>
                    ) : explainText ? (
                      <div
                        className={cn(
                          "rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm",
                          explainText.includes("try again shortly") &&
                            "border-amber-500/35 bg-amber-500/8",
                        )}
                      >
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/95">
                          {explainText}
                        </p>
                        {!explainText.includes("try again shortly") ? (
                          <p className="mt-4 text-xs text-muted-foreground">
                            {SHOW_STREAK_UI ? (
                              <>
                                Tip: close anytime — your streak still counts
                                while you skim the feed.
                              </>
                            ) : (
                              "Tip: close anytime — you can keep skimming the feed."
                            )}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border/80">
                          <Sparkles
                            className="size-7 text-muted-foreground"
                            aria-hidden
                          />
                        </div>
                        <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                          Ready when you are. One tap sends only this card to
                          the coach — no background calls.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {!explainLoading && !explainText ? (
                <SheetFooter className="shrink-0 border-t border-border/70 bg-muted/20 px-6 py-4">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full rounded-2xl gap-2"
                    onClick={() => void runExplain()}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    Explain this card
                  </Button>
                </SheetFooter>
              ) : null}

              {explainLoading ? (
                <SheetFooter className="shrink-0 border-t border-border/70 bg-muted/15 px-6 py-3">
                  <p className="w-full text-center text-xs text-muted-foreground">
                    Usually a few seconds
                  </p>
                </SheetFooter>
              ) : null}

              {explainText && !explainLoading ? (
                <SheetFooter className="shrink-0 gap-2 border-t border-border/70 bg-muted/20 px-6 py-4 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl sm:flex-1"
                    onClick={() => {
                      setExplainText("");
                    }}
                  >
                    Ask again
                  </Button>
                  <Button
                    type="button"
                    className="w-full rounded-2xl sm:flex-1"
                    onClick={() => void runExplain()}
                  >
                    Refresh explain
                  </Button>
                </SheetFooter>
              ) : null}
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
}
