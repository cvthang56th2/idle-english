"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Cloud, CloudOff, Download, LogOut, User } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthSyncSummary } from "@/lib/auth-sync";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { SHOW_STREAK_UI, SHOW_XP_UI } from "@/lib/feature-flags";
import { readLocalProgress } from "@/lib/offline-cache";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function syncCopy(summary: AuthSyncSummary): {
  title: string;
  body: string;
  icon: typeof Cloud;
} {
  switch (summary.state) {
    case "unconfigured":
      return {
        title: "Cloud backup off",
        body:
          SHOW_XP_UI && SHOW_STREAK_UI
            ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and enable Anonymous sign-ins in Supabase, to sync saves, XP, and streaks."
            : SHOW_XP_UI
              ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and enable Anonymous sign-ins in Supabase, to sync saves and XP."
              : SHOW_STREAK_UI
                ? "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and enable Anonymous sign-ins in Supabase, to sync saves and learning streak."
                : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and enable Anonymous sign-ins in Supabase, to sync saves.",
        icon: CloudOff,
      };
    case "no_client":
      return {
        title: "Could not reach auth",
        body: "Progress stays on this device until the auth service responds.",
        icon: CloudOff,
      };
    case "no_user":
      return {
        title: "Signing you in…",
        body: "We open an anonymous session on load. If this stays stuck, refresh once.",
        icon: Cloud,
      };
    case "anonymous":
      return {
        title: "Guest cloud session",
        body:
          SHOW_XP_UI && SHOW_STREAK_UI
            ? "XP, streaks, and saved cards sync for this browser. Sign in with email to recover progress on another device."
            : SHOW_XP_UI
              ? "XP and saved cards sync for this browser. Sign in with email to recover progress on another device."
              : SHOW_STREAK_UI
                ? "Daily streak and saved cards sync for this browser. Sign in with email to recover progress on another device."
                : "Saved cards sync for this browser. Sign in with email to recover progress on another device.",
        icon: Cloud,
      };
    case "signed_in":
      return {
        title: "Account",
        body: summary.email
          ? `${summary.email} — progress syncs with this account.`
          : "You’re logged in — progress syncs when you’re online.",
        icon: User,
      };
  }
}

export function ProfileDashboard({
  remoteXp,
  remoteStreak,
  lastLearnedAt,
  authSync,
}: {
  remoteXp: number;
  remoteStreak: number;
  lastLearnedAt: string | null;
  authSync: AuthSyncSummary;
}) {
  const router = useRouter();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [signingOut, setSigningOut] = useState(false);
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

  const sync = syncCopy(authSync);
  const SyncIcon = sync.icon;

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  async function handleSignOut() {
    const sb = getSupabaseBrowser();
    if (!sb || signingOut) return;
    setSigningOut(true);
    try {
      await sb.auth.signOut();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const showSignInLink =
    authSync.state === "anonymous" ||
    authSync.state === "no_user" ||
    authSync.state === "no_client";

  const showStatsGrid =
    SHOW_XP_UI || SHOW_STREAK_UI || Boolean(lastLearnedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-8">
      {showStatsGrid ? (
        <section className="grid gap-4">
        {SHOW_XP_UI ? (
          <div className="rounded-[26px] border border-border/70 bg-gradient-to-br from-emerald-500/15 via-card to-background p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              XP
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">
              {Math.max(remoteXp, local.xp)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Earn +5 XP whenever a lesson fills your screen.
            </p>
          </div>
        ) : null}

        {SHOW_STREAK_UI ? (
          <div className="rounded-[26px] border border-border/70 bg-card/70 p-6 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Daily streak
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">
              {Math.max(remoteStreak, local.streak)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Learn at least once per day to keep the flame alive.
            </p>
          </div>
        ) : null}

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
      ) : null}

      <section className="rounded-[26px] border border-border/70 bg-card/50 p-6 backdrop-blur-md">
        <div className="flex gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <SyncIcon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-snug">{sync.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {sync.body}
            </p>
            {showSignInLink ? (
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-4 flex h-11 w-full rounded-2xl text-base font-semibold",
                )}
                href="/login"
              >
                Sign in or create account
              </Link>
            ) : null}
            {authSync.state === "signed_in" ? (
              <Button
                className="mt-4 h-11 w-full rounded-2xl text-base font-semibold"
                disabled={signingOut}
                size="lg"
                type="button"
                variant="outline"
                onClick={() => void handleSignOut()}
              >
                <LogOut />
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            ) : null}
          </div>
        </div>
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
