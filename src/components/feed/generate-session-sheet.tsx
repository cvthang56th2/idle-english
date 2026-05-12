"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CARD_CATEGORIES, type CardCategoryId } from "@/data/card-categories";
import type { LearnerLevel, LessonCard } from "@/types/card";
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

const LS_CATEGORIES = "idle_generate_categories_v1";
const LS_LEVEL = "idle_generate_level_v1";
const LS_NOTES = "idle_generate_notes_v1";

const NOTES_MAX = 500;

const LEVELS: LearnerLevel[] = ["beginner", "intermediate", "advanced"];

type FeedGenResponse = {
  items?: LessonCard[];
  error?: string;
};

function readStoredCategories(): CardCategoryId[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_CATEGORIES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(CARD_CATEGORIES.map((c) => c.id));
    return parsed.filter(
      (id): id is CardCategoryId => typeof id === "string" && allowed.has(id as CardCategoryId),
    );
  } catch {
    return null;
  }
}

function readStoredLevel(): LearnerLevel | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LS_LEVEL);
  if (v && (LEVELS as string[]).includes(v)) return v as LearnerLevel;
  return null;
}

function readStoredNotes(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(LS_NOTES);
    if (typeof v !== "string") return "";
    return v.slice(0, NOTES_MAX);
  } catch {
    return "";
  }
}

type GenerateSessionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (cards: LessonCard[]) => void;
};

export function GenerateSessionSheet({
  open,
  onOpenChange,
  onGenerated,
}: GenerateSessionSheetProps) {
  const [selected, setSelected] = useState<Set<CardCategoryId>>(() => {
    const stored = readStoredCategories();
    if (stored?.length) return new Set(stored);
    return new Set<CardCategoryId>(["fluent_dev_daily", "behavioral_interviews"]);
  });
  const [level, setLevel] = useState<LearnerLevel>(() => readStoredLevel() ?? "intermediate");
  const [notes, setNotes] = useState<string>(() => readStoredNotes());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const storedCats = readStoredCategories();
      if (storedCats?.length) {
        setSelected(new Set(storedCats));
      }
      const storedLevel = readStoredLevel();
      if (storedLevel) setLevel(storedLevel);
      setNotes(readStoredNotes());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const persistCategories = useCallback((next: Set<CardCategoryId>) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_CATEGORIES, JSON.stringify([...next]));
  }, []);

  const persistLevel = useCallback((next: LearnerLevel) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_LEVEL, next);
  }, []);

  const persistNotes = useCallback((next: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_NOTES, next.slice(0, NOTES_MAX));
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
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds: [...selected],
          level,
          count: 6,
          notes: notes.trim() || undefined,
        }),
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
  }, [level, notes, onGenerated, onOpenChange, selected]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[min(88dvh,640px)] rounded-t-3xl border-border/80 px-6">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl">Build a mini session</SheetTitle>
          <SheetDescription className="text-base">
            Pick focus areas — add optional notes so the batch can lean your way (AI path).
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
              {notes.length}/{NOTES_MAX} · used when <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> is set
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
            Hand-tuned starters work without keys;{" "}
            <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> unlocks fuller blends on the
            server.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
