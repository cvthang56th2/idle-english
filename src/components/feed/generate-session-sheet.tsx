"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CARD_CATEGORIES, type CardCategoryId } from "@/data/card-categories";
import type { LearnerLevel, LessonCard } from "@/types/card";
import {
  LS_GENERATE_CATEGORIES,
  LS_GENERATE_LEVEL,
  LS_GENERATE_NOTES,
  NOTES_MAX,
  readGenerateSessionPrefs,
} from "@/lib/generate-session-prefs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const LEVELS: LearnerLevel[] = ["beginner", "intermediate", "advanced"];

type FeedGenResponse = {
  items?: LessonCard[];
  error?: string;
};

type GenerateSessionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (cards: LessonCard[]) => void;
  /** Titles already visible on the feed — server avoids duplicates when generating. */
  excludeTitles?: string[];
};

export function GenerateSessionSheet({
  open,
  onOpenChange,
  onGenerated,
  excludeTitles = [],
}: GenerateSessionSheetProps) {
  const [selected, setSelected] = useState<Set<CardCategoryId>>(() => {
    const { categoryIds } = readGenerateSessionPrefs();
    return new Set(categoryIds);
  });
  const [level, setLevel] = useState<LearnerLevel>(
    () => readGenerateSessionPrefs().level,
  );
  const [notes, setNotes] = useState<string>(() => readGenerateSessionPrefs().notes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const prefs = readGenerateSessionPrefs();
      setSelected(new Set(prefs.categoryIds));
      setLevel(prefs.level);
      setNotes(prefs.notes);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const persistCategories = useCallback((next: Set<CardCategoryId>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_GENERATE_CATEGORIES,
      JSON.stringify([...next]),
    );
  }, []);

  const persistLevel = useCallback((next: LearnerLevel) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_GENERATE_LEVEL, next);
  }, []);

  const persistNotes = useCallback((next: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_GENERATE_NOTES,
      next.slice(0, NOTES_MAX),
    );
  }, []);

  const toggle = useCallback(
    (id: CardCategoryId) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistCategories(next);
        return next;
      });
    },
    [persistCategories],
  );

  const handleLevel = useCallback(
    (next: LearnerLevel) => {
      setLevel(next);
      persistLevel(next);
    },
    [persistLevel],
  );

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) {
      toast.error("Pick at least one focus area.");
      return;
    }
    setBusy(true);
    try {
      const variationSeed =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds: [...selected],
          level,
          count: 6,
          notes: notes.trim() || undefined,
          randomize: true,
          variationSeed,
          ...(excludeTitles.length ? { excludeTitles } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json()) as FeedGenResponse;
      if (!res.ok) {
        toast.error(
          data.error === "no_valid_categories"
            ? "Those categories are not available — refresh and try again."
            : "Could not generate cards right now.",
        );
        return;
      }
      const items = data.items;
      if (!items?.length) {
        toast.error("No cards came back — try again.");
        return;
      }
      onGenerated(items);
      onOpenChange(false);
      toast.success(`Loaded ${items.length} custom cards at the top of your feed.`);
    } catch {
      toast.error("Network hiccup — try again when you’re online.");
    } finally {
      setBusy(false);
    }
  }, [excludeTitles, level, notes, onGenerated, onOpenChange, selected]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[min(88dvh,640px)] rounded-t-3xl border-border/80 px-6">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">Build a mini session</SheetTitle>
          <SheetDescription className="text-base">
            Checked areas form a pool — each run randomly mixes 2–4 of them so batches stay fresh (fallback packs shuffle too).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-5">
          <div className="space-y-2">
            <label htmlFor="gen-level" className="text-sm font-medium">
              Difficulty skew
            </label>
            <select
              id="gen-level"
              className={cn(
                "w-full rounded-2xl border border-border bg-background px-4 py-3 text-base",
                "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35",
              )}
              value={level}
              disabled={busy}
              onChange={(e) => handleLevel(e.target.value as LearnerLevel)}
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="gen-notes" className="text-sm font-medium">
              Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="gen-notes"
              rows={3}
              maxLength={NOTES_MAX}
              placeholder="e.g. upcoming Google loop, nervous about small talk, want more STAR examples…"
              className={cn(
                "min-h-22 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-base",
                "placeholder:text-muted-foreground/70",
                "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35",
              )}
              value={notes}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value.slice(0, NOTES_MAX);
                setNotes(v);
                persistNotes(v);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/{NOTES_MAX} · used when the server has an AI key configured (OpenAI, Groq, etc.).
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Focus areas</p>
            <ScrollArea className="mt-2 h-[min(38dvh,280px)] pr-3">
              <div className="flex flex-col gap-2 pb-2">
                {CARD_CATEGORIES.map((c) => {
                  const checked = selected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 transition-colors",
                        checked
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/70 bg-card/40 hover:border-border",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggle(c.id)}
                      />
                      <span>
                        <span className="block font-medium leading-snug">{c.label}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {c.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full rounded-2xl"
            disabled={busy || selected.size === 0}
            onClick={() => void handleGenerate()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              "Generate & prepend"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Hand-tuned starters work without keys; configure <code className="rounded bg-muted px-1">AI_PROVIDER</code>{" "}
            and the matching API key on the server for fuller blends.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
