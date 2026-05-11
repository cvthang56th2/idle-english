import { fetchSavedIds } from "@/app/actions/saved";
import { AppHeader } from "@/components/layout/app-header";
import { SavedLibrary } from "@/components/saved/saved-library";

export const metadata = {
  title: "Saved · IdleEnglish",
  description: "Cards you bookmarked for quick review.",
};

export default async function SavedPage() {
  const remoteIds = await fetchSavedIds();

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        eyebrow="Library"
        title="Saved cards"
        detail="Offline-ready stash · syncs with Supabase when signed in"
      />
      <SavedLibrary remoteIds={remoteIds} />
    </main>
  );
}
