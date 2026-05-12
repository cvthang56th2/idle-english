import { AppHeader } from "@/components/layout/app-header";
import { SavedLibraryTabs } from "@/components/saved/saved-library-tabs";
import { fetchSavedIds, fetchSavedShortRows } from "@/app/actions/saved";

export const metadata = {
  title: "Saved · IdleEnglish",
  description: "Cards you bookmarked for quick review.",
};

export default async function SavedPage() {
  const [remoteIds, remoteShorts] = await Promise.all([
    fetchSavedIds(),
    fetchSavedShortRows(),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        eyebrow="Library"
        title="Saved"
        detail="Cards and shorts in tabs · offline stash · sync when signed in"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SavedLibraryTabs remoteIds={remoteIds} remoteShorts={remoteShorts} />
      </div>
    </main>
  );
}
