import type { Metadata } from "next";

import { EmailAuthForm } from "@/components/auth/email-auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an IdleEnglish account.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            IdleEnglish
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
          <p className="text-sm text-muted-foreground">
            Sign in or sign up with email to sync your progress across devices.
          </p>
        </header>

        <div className="rounded-[26px] border border-border/70 bg-card/50 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <EmailAuthForm />
        </div>
      </div>
    </div>
  );
}
