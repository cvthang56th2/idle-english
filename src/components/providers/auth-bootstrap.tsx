"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function AuthBootstrap() {
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;

    void sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        void sb.auth.signInAnonymously();
      }
    });
  }, []);

  return null;
}
