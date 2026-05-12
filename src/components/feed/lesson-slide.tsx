"use client";

import { useState, useTransition } from "react";
import {
  Bookmark,
  ChevronRight,
  EllipsisVertical,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import type { LessonCard } from "@/types/card";
import { Button } from "@/components/ui/button";
import {
  LessonCardBody,
  LessonCardHeader,
} from "@/components/feed/lesson-card-content";
import { toggleSaved } from "@/app/actions/saved";
import { removeSavedEntry, upsertSavedEntry } from "@/lib/saved-storage";
import { cn } from "@/lib/utils";

type LessonSlideProps = {
  card: LessonCard;
  saved: boolean;
  onToggleSave: (next: boolean) => void;
  onExplain: (card: LessonCard) => void;
};

function speak(card: LessonCard) {
  if (typeof window === "undefined") return;
  if (card.audio_url) {
    const audio = new Audio(card.audio_url);
    void audio.play().catch(() => {
      toast.error("Could not play audio");
    });
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(card.example);
  utter.lang = "en-US";
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export function LessonSlide({
  card,
  saved,
  onToggleSave,
  onExplain,
}: LessonSlideProps) {
  const [pending, startTransition] = useTransition();
  const [railOpen, setRailOpen] = useState(true);

  const handleSave = () => {
    const next = !saved;
    onToggleSave(next);
    startTransition(async () => {
      const result = await toggleSaved(card.id, next);
      if (!result.ok) {
        toast.error("Could not sync save yet — kept locally");
        onToggleSave(!next);
        return;
      }
      if (next) {
        upsertSavedEntry(card);
      } else {
        removeSavedEntry(card.id);
      }
    });
  };

  return (
    <article
      className={cn(
        "relative flex h-full min-h-0 max-h-full flex-col gap-4 rounded-[28px] border border-border/70 bg-linear-to-b from-card/90 to-background/80 p-5 pb-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/5 backdrop-blur-md",
        "animate-in fade-in zoom-in-95 duration-300 ease-out fill-mode-both",
      )}
    >
      <div
        className="pointer-events-auto absolute right-3 bottom-20 z-10 flex flex-col items-end gap-2.5"
        role="toolbar"
        aria-label="Card actions"
      >
        {railOpen ? (
          <div
            id="card-action-rail"
            className="flex flex-col gap-2.5"
          >
            <Button
              type="button"
              size="icon-lg"
              variant={saved ? "default" : "outline"}
              className={cn(
                "rounded-full shadow-md",
                saved &&
                "bg-primary text-primary-foreground shadow-[0_10px_40px_rgba(34,197,94,0.35)]",
              )}
              onClick={handleSave}
              disabled={pending}
              aria-pressed={saved}
              aria-label={saved ? "Saved — tap to remove" : "Save"}
            >
              <Bookmark className={cn("size-5", saved && "fill-current")} />
            </Button>
            <Button
              type="button"
              size="icon-lg"
              variant="secondary"
              className="rounded-full shadow-md"
              onClick={() => speak(card)}
              aria-label="Listen"
            >
              <Volume2 className="size-5" />
            </Button>
            <Button
              type="button"
              size="icon-lg"
              variant="ghost"
              className="rounded-full bg-background/80 shadow-md ring-1 ring-border/80 backdrop-blur-sm"
              onClick={() => onExplain(card)}
              aria-label="AI explain"
            >
              <Sparkles className="size-5" />
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          className="rounded-full shadow-md"
          aria-expanded={railOpen}
          aria-controls="card-action-rail"
          aria-label={railOpen ? "Hide card actions" : "Show card actions"}
          onClick={() => setRailOpen((o) => !o)}
        >
          {railOpen ? (
            <ChevronRight className="size-5" aria-hidden />
          ) : (
            <EllipsisVertical className="size-5" aria-hidden />
          )}
        </Button>
      </div>

      <LessonCardBody card={card} className="min-h-0 flex-1 overflow-y-auto" />

      <div className="mt-auto min-w-0 flex flex-col gap-3 border-t border-border/60 pt-4">
        <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
          <LessonCardHeader card={card} className="w-max flex-nowrap" />
        </div>
      </div>
    </article>
  );
}
