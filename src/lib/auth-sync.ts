import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthSyncSummary =
  | { state: "unconfigured" }
  | { state: "no_client" }
  | { state: "no_user" }
  | { state: "anonymous" }
  | { state: "signed_in"; email: string | null };

export async function getAuthSyncSummary(): Promise<AuthSyncSummary> {
  if (!isSupabaseConfigured()) return { state: "unconfigured" };
  const supabase = await createServerSupabase();
  if (!supabase) return { state: "no_client" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "no_user" };
  if (user.is_anonymous) return { state: "anonymous" };
  return { state: "signed_in", email: user.email ?? null };
}
