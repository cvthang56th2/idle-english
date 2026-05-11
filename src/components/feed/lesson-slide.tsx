"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Bookmark, Sparkles, Volume2 } from "lucide-react";
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
    <motion.article
      layout
      initial={{ opacity: 0.9, scale: 0.987 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.55 }}
      className="flex h-full min-h-0 max-h-full flex-col gap-4 rounded-[28px] border border-border/70 bg-gradient-to-b from-card/90 to-background/80 p-5 pb-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/5 backdrop-blur-md"
    >
      <LessonCardHeader card={card} />
      <LessonCardBody card={card} className="min-h-0 overflow-y-auto" />
      <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            variant={saved ? "default" : "outline"}
            className={cn(
              "rounded-2xl px-4",
              saved &&
                "bg-primary text-primary-foreground shadow-[0_10px_40px_rgba(34,197,94,0.35)]",
            )}
            onClick={handleSave}
            disabled={pending}
            aria-pressed={saved}
          >
            <Bookmark className={cn("size-4", saved && "fill-current")} />
            {saved ? "Saved" : "Save"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="rounded-2xl px-4"
            onClick={() => speak(card)}
          >
            <Volume2 />
            Listen
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            className="rounded-2xl px-4"
            onClick={() => onExplain(card)}
          >
            <Sparkles />
            AI explain
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Swipe up for next</p>
      </div>
    </motion.article>
  );
}
