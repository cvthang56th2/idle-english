"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import type { LessonCard } from "@/types/card";
import { pingLearnSession } from "@/app/actions/progress";
import {
  bumpLocalProgress,
  persistRecentCards,
  readRecentCards,
} from "@/lib/offline-cache";
import { LessonSlide } from "@/components/feed/lesson-slide";
import { FeedSkeleton } from "@/components/feed/feed-skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type FeedResponse = {
  items: LessonCard[];
  nextOffset: number;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rewardedRef = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const fetchPage = useCallback(async (nextOffset: number) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards?offset=${nextOffset}&limit=8`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as FeedResponse;
      setCards((prev) => [...prev, ...data.items]);
      setOffset(data.nextOffset);
    } catch {
      const cached = readRecentCards();
      if (cached?.length) {
        setCards((prev) => (prev.length ? prev : cached));
        toast.message("You’re offline — replaying cached lessons.");
      } else {
        toast.error("Could not load lessons. Check your connection.");
      }
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void fetchPage(0);
    });
  }, [fetchPage]);

  useEffect(() => {
    persistRecentCards(cards);
  }, [cards]);

  useEffect(() => {
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
        void fetchPage(offsetRef.current);
      },
      { root, threshold: 0.15 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchPage]);

  const handleExplain = useCallback(async (card: LessonCard) => {
    setExplainTarget(card);
    setExplainOpen(true);
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
  }, []);

  const rewardProgress = useCallback((cardId: string) => {
    if (rewardedRef.current.has(cardId)) return;
    rewardedRef.current.add(cardId);
    void pingLearnSession().then((res) => {
      if (res.ok && res.persisted === "remote") {
        toast.success(
          `+5 XP${typeof res.streak === "number" ? ` · ${res.streak} day streak` : ""}`,
        );
      } else {
        const local = bumpLocalProgress();
        toast.success(`+5 XP · ${local.streak} day streak`);
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

  if (initialLoading && cards.length === 0) {
    return <FeedSkeleton />;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
        style={{
          height: "calc(100dvh - 5.5rem)",
          scrollSnapStop: "always",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.map((card, index) => (
          <section
            key={`${card.id}-${index}`}
            data-feed-slide
            data-card-id={`${card.id}-${index}`}
            className="snap-start snap-always px-3 pt-3"
            style={{ minHeight: "calc(100dvh - 5.5rem)" }}
          >
            <LessonSlide
              card={card}
              saved={savedIds.has(card.id)}
              onToggleSave={(next) => updateSaved(card.id, next)}
              onExplain={handleExplain}
            />
          </section>
        ))}
        <div
          ref={sentinelRef}
          className="snap-start px-3 pt-3"
          style={{ minHeight: "40vh" }}
        >
          <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {loading ? (
              <>
                <Skeleton className="mx-auto h-4 w-40 rounded-full" />
                <Skeleton className="mx-auto h-4 w-56 rounded-full" />
              </>
            ) : (
              <p>Keep swiping — more micro-lessons incoming.</p>
            )}
          </div>
        </div>
      </div>

      <Sheet open={explainOpen} onOpenChange={setExplainOpen}>
        <SheetContent side="bottom" className="h-[70dvh] rounded-t-3xl border-border/80">
          <SheetHeader>
            <SheetTitle className="text-left text-2xl">
              {explainTarget?.title ?? "AI coach"}
            </SheetTitle>
            <SheetDescription className="text-left text-base">
              Short breakdown tuned for busy builders.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[48dvh] pr-3">
            {explainLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-muted-foreground">
                {explainText}
              </p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
