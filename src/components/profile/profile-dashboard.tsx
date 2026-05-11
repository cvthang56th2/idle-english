"use client";

import { startTransition, useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readLocalProgress } from "@/lib/offline-cache";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ProfileDashboard({
  remoteXp,
  remoteStreak,
  lastLearnedAt,
}: {
  remoteXp: number;
  remoteStreak: number;
  lastLearnedAt: string | null;
}) {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [local, setLocal] = useState({ xp: 0, streak: 0 });

  useEffect(() => {
    startTransition(() => {
      setLocal(readLocalProgress());
    });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const xp = Math.max(remoteXp, local.xp);
  const streak = Math.max(remoteStreak, local.streak);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-8">
      <section className="grid gap-4">
        <div className="rounded-[26px] border border-border/70 bg-gradient-to-br from-emerald-500/15 via-card to-background p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            XP
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{xp}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Earn +5 XP whenever a lesson fills your screen.
          </p>
        </div>

        <div className="rounded-[26px] border border-border/70 bg-card/70 p-6 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Daily streak
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{streak}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Learn at least once per day to keep the flame alive.
          </p>
        </div>

        {lastLearnedAt ? (
          <p className="text-center text-xs text-muted-foreground">
            Last synced session{" "}
            {new Date(lastLearnedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </section>

      <section className="rounded-[26px] border border-dashed border-primary/40 bg-primary/5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Install IdleEnglish</p>
            <p className="text-sm text-muted-foreground">
              Add to home screen for fullscreen micro-learning.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="rounded-2xl"
            disabled={!installEvent}
            onClick={() => void handleInstall()}
          >
            <Download />
            Install app
          </Button>
        </div>
        {!installEvent ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: Safari → Share → Add to Home Screen. Chrome → Install app from
            the address bar when offered.
          </p>
        ) : null}
      </section>
    </div>
  );
}
