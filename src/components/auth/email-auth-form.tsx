"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

function inputClass(): string {
  return "focus-visible:border-primary h-11 w-full rounded-2xl border border-border bg-card/70 px-4 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/35";
}

export function EmailAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error(
        "Supabase isn’t configured (missing URL or anon key env vars).",
      );
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      toast.error("Couldn’t initialize Supabase.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "sign_up") {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              `${origin}/auth/callback?next=${encodeURIComponent("/feed")}`,
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (data.session) {
          toast.success("Account created — taking you to the feed.");
          router.push("/feed");
          router.refresh();
          return;
        }
        toast.success("Check your email and confirm your account.");
        return;
      }

      const { error } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in.");
      router.push("/feed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-5" noValidate onSubmit={(e) => void submit(e)}>
      <fieldset className="grid gap-2">
        <legend className="sr-only">
          Sign in or sign up for IdleEnglish with email
        </legend>
        <div className="flex gap-2 rounded-[14px] border border-border/80 bg-muted/35 p-1">
          <Button
            type="button"
            variant={mode === "sign_in" ? "secondary" : "ghost"}
            className={`flex-1 rounded-xl ${mode === "sign_in" ? "shadow-sm" : ""}`}
            onClick={() => setMode("sign_in")}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === "sign_up" ? "secondary" : "ghost"}
            className={`flex-1 rounded-xl ${mode === "sign_up" ? "shadow-sm" : ""}`}
            onClick={() => setMode("sign_up")}
          >
            Sign up
          </Button>
        </div>

        <label className="mt-3 grid gap-2 text-sm font-medium leading-none">
          <span className="text-muted-foreground">Email</span>
          <input
            autoComplete="email"
            className={inputClass()}
            inputMode="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium leading-none">
          <span className="text-muted-foreground">Password</span>
          <input
            autoComplete={
              mode === "sign_up" ? "new-password" : "current-password"
            }
            className={inputClass()}
            minLength={6}
            name="password"
            placeholder={mode === "sign_up" ? "At least 6 characters" : "••••••"}
            required
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </label>
      </fieldset>

      <Button
        className="h-11 rounded-2xl text-base font-semibold"
        disabled={busy}
        size="lg"
        type="submit"
      >
        {mode === "sign_in" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/feed"
        >
          Back to feed
        </Link>
      </p>
    </form>
  );
}
