import { AppHeader } from "@/components/layout/app-header";
import { SavedLibrary } from "@/components/saved/saved-library";
import { SavedShortsLibrary } from "@/components/saved/saved-shorts-library";
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
        detail="Lesson cards and YouTube shorts · offline stash · sync when signed in"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="pb-6">
          <h2 className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Lesson cards
          </h2>
          <SavedLibrary remoteIds={remoteIds} />
        </section>
        <section className="border-t border-border/50 pb-8 pt-4">
          <h2 className="px-4 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Shorts
          </h2>
          <SavedShortsLibrary
            key={remoteShorts.map((r) => r.videoId).join("|")}
            remoteShorts={remoteShorts}
          />
        </section>
      </div>
    </main>
  );
}
