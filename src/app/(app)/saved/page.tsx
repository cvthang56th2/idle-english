import { AppHeader } from "@/components/layout/app-header";
import { SavedLibraryTabs } from "@/components/saved/saved-library-tabs";
import { fetchSavedIds, fetchSavedShortRows } from "@/app/actions/saved";
import { fetchSavedNewsRows } from "@/app/actions/saved-news";

export const metadata = {
  title: "Saved · IdleEnglish",
  description: "Bookmarked cards, shorts, and saved reading.",
};

export default async function SavedPage() {
  const [remoteIds, remoteShorts, remoteNews] = await Promise.all([
    fetchSavedIds(),
    fetchSavedShortRows(),
    fetchSavedNewsRows(),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        eyebrow="Library"
        title="Saved"
        detail="Cards, shorts, reading — offline stash · sync when signed in"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SavedLibraryTabs
          remoteIds={remoteIds}
          remoteShorts={remoteShorts}
          remoteNews={remoteNews}
        />
      </div>
    </main>
  );
}
